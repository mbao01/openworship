use crate::capture::{AudioCapturer, AudioConfig};
use crate::event::TranscriptEvent;
use crate::transcribe::Transcriber;
use anyhow::Result;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;
use tokio::sync::broadcast;

/// Number of consecutive empty-text chunks before emitting a warning event.
const EMPTY_CHUNK_WARN_THRESHOLD: u32 = 5;

/// RMS energy threshold below which audio is considered silence (~-46 dBFS).
/// Avoids feeding quiet noise to Whisper which causes hallucinations.
const VAD_RMS_THRESHOLD: f32 = 0.005;

/// Minimum interval between transcription calls (milliseconds).
/// Prevents redundant work when chunks arrive faster than Whisper can process.
const TRANSCRIBE_CADENCE_MS: u64 = 1000;

/// Find new words in `current` that weren't in `prev` using suffix-anchored diff.
///
/// Finds the longest suffix of `prev` words that matches a prefix of `current`
/// words, then returns everything in `current` after that match. This is more
/// robust than a simple longest-common-prefix when Whisper re-transcribes
/// overlapping audio slightly differently.
fn diff_new_words(prev: &str, current: &str) -> String {
    let prev_words: Vec<&str> = prev.split_whitespace().collect();
    let curr_words: Vec<&str> = current.split_whitespace().collect();

    if prev_words.is_empty() {
        return current.trim().to_string();
    }
    if curr_words.is_empty() {
        return String::new();
    }

    // Try to find the longest suffix of prev that matches a prefix of current.
    let max_check = prev_words.len().min(curr_words.len());
    let mut best_match_len = 0;

    for suffix_start in (prev_words.len().saturating_sub(max_check))..prev_words.len() {
        let suffix = &prev_words[suffix_start..];
        if curr_words.len() >= suffix.len()
            && curr_words[..suffix.len()]
                .iter()
                .zip(suffix.iter())
                .all(|(a, b)| a.to_lowercase() == b.to_lowercase())
        {
            let candidate = suffix.len();
            if candidate > best_match_len {
                best_match_len = candidate;
            }
        }
    }

    curr_words[best_match_len..].join(" ")
}

/// Whether the STT engine is currently active.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SttStatus {
    Stopped,
    Running,
    /// Model not found or audio device error.
    Error(String),
}

/// Orchestrates audio capture → transcription → event emission.
///
/// Audio capture stays on the calling thread (cpal streams are `!Send` on
/// macOS CoreAudio). A worker thread receives audio chunks via a channel and
/// drives transcription.
pub struct SttEngine {
    tx: broadcast::Sender<TranscriptEvent>,
    status: Arc<Mutex<SttStatus>>,
    running: Arc<AtomicBool>,
    /// RMS level of the most-recent audio chunk, stored as f32 bits.
    /// Updated by the capture callback while the engine is running.
    audio_level: Arc<AtomicU32>,
}

impl SttEngine {
    pub fn new() -> (Self, broadcast::Receiver<TranscriptEvent>) {
        let (tx, rx) = broadcast::channel(64);
        (
            Self {
                tx,
                status: Arc::new(Mutex::new(SttStatus::Stopped)),
                running: Arc::new(AtomicBool::new(false)),
                audio_level: Arc::new(AtomicU32::new(0)),
            },
            rx,
        )
    }

    /// Return the most-recent RMS audio level `[0.0, 1.0]`.
    /// Returns `0.0` when the engine is stopped.
    pub fn audio_level_rms(&self) -> f32 {
        f32::from_bits(self.audio_level.load(Ordering::Relaxed))
    }

    pub fn status(&self) -> SttStatus {
        self.status.lock().unwrap().clone()
    }

    /// Start capturing and transcribing.
    ///
    /// - `AudioCapturer` (which holds the cpal `Stream`) stays alive in the
    ///   current thread via a dedicated keeper thread.
    /// - A separate worker thread reads from the internal channel and calls the
    ///   transcriber, keeping the transcription latency independent of capture.
    pub fn start(&mut self, transcriber: Box<dyn Transcriber>, config: AudioConfig) -> Result<()> {
        if *self.status.lock().unwrap() == SttStatus::Running {
            return Ok(());
        }

        let capturer = AudioCapturer::new(config.clone())?;
        // Wire up the capturer's level atomic so get_audio_level() reflects live input.
        self.audio_level = capturer.level_rms.clone();

        let tx = self.tx.clone();
        let status = self.status.clone();
        let running_worker = self.running.clone();
        running_worker.store(true, Ordering::Release);
        *self.status.lock().unwrap() = SttStatus::Running;

        let mut transcriber = transcriber;
        let start = Instant::now();
        let chunk_ms = config.chunk_ms;

        // Sliding-window transcription thread: accumulates 500ms micro-chunks
        // into a 5s ring buffer, transcribes at most once per second, and diffs
        // the output to emit only new words. Energy-based VAD skips silence.
        let sample_rate = config.sample_rate;
        thread::spawn(move || {
            let capturer = capturer;
            // 5s sliding window — gives Whisper full sentence context
            let window_samples = (sample_rate as usize * 5000) / 1000; // 80,000
            let min_samples: usize = 32_000; // 2s minimum before transcribing
            let mut ring: Vec<f32> = Vec::with_capacity(window_samples);
            let mut prev_text = String::new();
            let mut consecutive_empty: u32 = 0;
            let mut last_transcribe = Instant::now() - std::time::Duration::from_secs(10);

            loop {
                if !running_worker.load(Ordering::Acquire) {
                    break;
                }
                match capturer.rx.recv_timeout(std::time::Duration::from_millis(500)) {
                    Ok(samples) => {
                        // Append new micro-chunk to ring buffer
                        ring.extend_from_slice(&samples);
                        // Trim to last 5s
                        if ring.len() > window_samples {
                            let excess = ring.len() - window_samples;
                            ring.drain(..excess);
                        }
                        // Wait until we have enough audio for Whisper
                        if ring.len() < min_samples {
                            continue;
                        }

                        // Cadence gate: don't transcribe more than once per second
                        if last_transcribe.elapsed().as_millis() < TRANSCRIBE_CADENCE_MS as u128 {
                            continue;
                        }

                        // Energy-based VAD: skip transcription on silence
                        let rms = (ring.iter().map(|&s| s * s).sum::<f32>()
                            / ring.len() as f32)
                            .sqrt();
                        if rms < VAD_RMS_THRESHOLD {
                            // Reset context on silence to avoid stale carry-over
                            if !prev_text.is_empty() {
                                prev_text.clear();
                            }
                            continue;
                        }

                        last_transcribe = Instant::now();
                        let offset_ms = start.elapsed().as_millis() as u64;
                        match transcriber.transcribe(&ring) {
                            Ok(text) if !text.is_empty() => {
                                // Diff: emit only new words
                                let new_text = diff_new_words(&prev_text, &text);
                                if !new_text.is_empty() {
                                    consecutive_empty = 0;
                                    let _ = tx.send(TranscriptEvent {
                                        text: new_text,
                                        offset_ms,
                                        duration_ms: chunk_ms,
                                        mic_active: true,
                                    });
                                }
                                prev_text = text;
                            }
                            Ok(_) => {
                                consecutive_empty += 1;
                                if consecutive_empty == EMPTY_CHUNK_WARN_THRESHOLD {
                                    eprintln!(
                                        "[stt] {} consecutive chunks produced no text — \
                                         model may need re-download (Settings → Audio)",
                                        consecutive_empty,
                                    );
                                }
                            }
                            Err(e) => eprintln!("[stt] transcription error: {e}"),
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
            drop(capturer); // stops the audio stream
            *status.lock().unwrap() = SttStatus::Stopped;
        });

        Ok(())
    }

    /// Stop the capture/transcription loop.
    pub fn stop(&mut self) {
        self.running.store(false, Ordering::Release);
        self.audio_level.store(0u32, Ordering::Release);
    }

    pub fn sender(&self) -> broadcast::Sender<TranscriptEvent> {
        self.tx.clone()
    }
}

impl Default for SttEngine {
    fn default() -> Self {
        Self::new().0
    }
}

/// Lightweight audio-only capture for VU meter / mic check.
///
/// Opens the mic directly via cpal and computes RMS on every callback,
/// without running any transcription or chunk buffering. Updates ~20×
/// per second for smooth VU meter rendering.
pub struct AudioMonitor {
    level: Arc<AtomicU32>,
    running: Arc<AtomicBool>,
}

impl AudioMonitor {
    pub fn new() -> Self {
        Self {
            level: Arc::new(AtomicU32::new(0)),
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Current RMS audio level [0.0, 1.0].
    pub fn level_rms(&self) -> f32 {
        f32::from_bits(self.level.load(Ordering::Relaxed))
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    /// Start capturing audio purely for level metering.
    pub fn start(&self, device_name: Option<String>) -> Result<()> {
        if self.running.load(Ordering::Relaxed) {
            return Ok(());
        }

        let level = self.level.clone();
        let running = self.running.clone();
        running.store(true, Ordering::Release);

        let level_clear = self.level.clone();
        let running_check = self.running.clone();

        // Build and own the cpal stream on a dedicated thread — cpal
        // streams are !Send on macOS CoreAudio, so we must create AND
        // keep them alive on the same thread.
        thread::spawn(move || {
            use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

            let host = cpal::default_host();
            let device = (|| {
                if let Some(ref name) = device_name {
                    if let Ok(mut devs) = host.input_devices() {
                        if let Some(d) = devs.find(|d| d.name().ok().as_deref() == Some(name.as_str())) {
                            return Some(d);
                        }
                    }
                }
                host.default_input_device()
            })();

            let device = match device {
                Some(d) => d,
                None => {
                    eprintln!("[audio-monitor] no audio input device available");
                    running_check.store(false, Ordering::Release);
                    return;
                }
            };

            let config = match device.default_input_config() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("[audio-monitor] no default input config: {e}");
                    running_check.store(false, Ordering::Release);
                    return;
                }
            };
            let stream_config: cpal::StreamConfig = config.into();

            let stream = device.build_input_stream(
                &stream_config,
                move |data: &[f32], _info| {
                    if data.is_empty() {
                        return;
                    }
                    let sum_sq: f32 = data.iter().map(|&s| s * s).sum();
                    let rms = (sum_sq / data.len() as f32).sqrt();
                    level.store(rms.to_bits(), Ordering::Release);
                },
                |err| eprintln!("[audio-monitor] stream error: {err}"),
                None,
            );

            let stream = match stream {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("[audio-monitor] failed to build stream: {e}");
                    running_check.store(false, Ordering::Release);
                    return;
                }
            };

            if let Err(e) = stream.play() {
                eprintln!("[audio-monitor] failed to start stream: {e}");
                running_check.store(false, Ordering::Release);
                return;
            }

            eprintln!("[audio-monitor] stream started");

            // Keep the stream alive until told to stop
            while running_check.load(Ordering::Acquire) {
                thread::sleep(std::time::Duration::from_millis(100));
            }

            drop(stream);
            level_clear.store(0u32, Ordering::Release);
            eprintln!("[audio-monitor] stream stopped");
        });

        Ok(())
    }

    /// Stop the audio monitor.
    pub fn stop(&self) {
        self.running.store(false, Ordering::Release);
        self.level.store(0u32, Ordering::Release);
    }
}

impl Default for AudioMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diff_new_words_returns_only_new_words() {
        let result = diff_new_words("hello world", "hello world foo bar");
        assert_eq!(result, "foo bar");
    }

    #[test]
    fn diff_new_words_handles_empty_previous() {
        let result = diff_new_words("", "hello world");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn diff_new_words_handles_identical_strings() {
        let result = diff_new_words("hello world", "hello world");
        assert_eq!(result, "");
    }

    #[test]
    fn diff_new_words_handles_both_empty() {
        let result = diff_new_words("", "");
        assert_eq!(result, "");
    }

    #[test]
    fn diff_new_words_handles_completely_different() {
        let result = diff_new_words("alpha beta", "gamma delta");
        assert_eq!(result, "gamma delta");
    }

    #[test]
    fn diff_new_words_handles_partial_overlap() {
        let result = diff_new_words("the quick", "the quick brown fox");
        assert_eq!(result, "brown fox");
    }

    #[test]
    fn diff_new_words_suffix_anchor_sliding_window() {
        // Simulates a sliding window: prev had "A B C D", new window starts mid-overlap
        // with "C D E F" — suffix "C D" of prev matches prefix of current.
        let result = diff_new_words("A B C D", "C D E F");
        assert_eq!(result, "E F");
    }

    #[test]
    fn diff_new_words_suffix_anchor_case_insensitive() {
        // Whisper may capitalize differently between runs
        let result = diff_new_words("the Lord is", "The Lord is my shepherd");
        assert_eq!(result, "my shepherd");
    }

    #[test]
    fn diff_new_words_no_overlap_returns_all() {
        let result = diff_new_words("hello world", "completely different text");
        assert_eq!(result, "completely different text");
    }

    #[test]
    fn audio_monitor_new_starts_not_running() {
        let monitor = AudioMonitor::new();
        assert!(!monitor.is_running());
        assert_eq!(monitor.level_rms(), 0.0);
    }

    #[test]
    fn audio_monitor_default_starts_not_running() {
        let monitor = AudioMonitor::default();
        assert!(!monitor.is_running());
    }

    #[test]
    fn stt_engine_new_starts_stopped() {
        let (engine, _rx) = SttEngine::new();
        assert_eq!(engine.status(), SttStatus::Stopped);
        assert_eq!(engine.audio_level_rms(), 0.0);
    }

    #[test]
    fn stt_engine_default_starts_stopped() {
        let engine = SttEngine::default();
        assert_eq!(engine.status(), SttStatus::Stopped);
    }

    #[test]
    fn stt_status_variants_are_distinct() {
        assert_ne!(SttStatus::Stopped, SttStatus::Running);
        assert_ne!(SttStatus::Stopped, SttStatus::Error("test".into()));
        assert_ne!(SttStatus::Running, SttStatus::Error("test".into()));
    }
}
