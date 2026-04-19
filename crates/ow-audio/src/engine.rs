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

/// Compute the new words in `current` that weren't in `prev`.
/// Uses a simple longest-common-prefix diff on whitespace-split words.
fn diff_new_words(prev: &str, current: &str) -> String {
    let prev_words: Vec<&str> = prev.split_whitespace().collect();
    let curr_words: Vec<&str> = current.split_whitespace().collect();
    let common = prev_words
        .iter()
        .zip(curr_words.iter())
        .take_while(|(a, b)| a == b)
        .count();
    curr_words[common..].join(" ")
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
    pub fn start<T: Transcriber>(&mut self, transcriber: T, config: AudioConfig) -> Result<()> {
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

        // Sliding-window transcription thread: accumulates 200ms micro-chunks
        // into a 1.5s ring buffer, transcribes after each new chunk, and diffs
        // the output to emit only new words. This gives ~200ms perceived latency
        // while still feeding Whisper enough audio (≥1.01s).
        let sample_rate = config.sample_rate;
        thread::spawn(move || {
            let capturer = capturer;
            // 1.5s sliding window — enough for Whisper to produce segments
            let window_samples = (sample_rate as usize * 1500) / 1000; // 24,000
            let min_samples: usize = 16_160; // Whisper minimum
            let mut ring: Vec<f32> = Vec::with_capacity(window_samples);
            let mut prev_text = String::new();
            let mut consecutive_empty: u32 = 0;

            loop {
                if !running_worker.load(Ordering::Acquire) {
                    break;
                }
                match capturer.rx.recv_timeout(std::time::Duration::from_millis(500)) {
                    Ok(samples) => {
                        // Append new micro-chunk to ring buffer
                        ring.extend_from_slice(&samples);
                        // Trim to last 1.5s
                        if ring.len() > window_samples {
                            let excess = ring.len() - window_samples;
                            ring.drain(..excess);
                        }
                        // Wait until we have enough audio for Whisper
                        if ring.len() < min_samples {
                            continue;
                        }

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
