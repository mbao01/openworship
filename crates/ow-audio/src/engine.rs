use crate::capture::{AudioCapturer, AudioConfig};
use crate::event::TranscriptEvent;
use crate::transcribe::Transcriber;
use anyhow::Result;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;
use tokio::sync::broadcast;

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

        // Single keeper+worker thread: keeps the cpal Stream alive AND drives
        // transcription. Since we use unsafe impl Send for AudioCapturer this
        // is safe — we move it into exactly one thread and never share it.
        thread::spawn(move || {
            let capturer = capturer;
            loop {
                if !running_worker.load(Ordering::Acquire) {
                    break;
                }
                match capturer.rx.recv_timeout(std::time::Duration::from_millis(chunk_ms as u64 * 2)) {
                    Ok(samples) => {
                        let offset_ms = start.elapsed().as_millis() as u64;
                        match transcriber.transcribe(&samples) {
                            Ok(text) if !text.is_empty() => {
                                let _ = tx.send(TranscriptEvent {
                                    text,
                                    offset_ms,
                                    duration_ms: chunk_ms,
                                    mic_active: true,
                                });
                            }
                            Ok(_) => {}
                            Err(e) => eprintln!("[ow-audio] transcription error: {e}"),
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
