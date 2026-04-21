use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, SampleRate, Stream, StreamConfig};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::{self, Receiver};

/// An enumerated audio input device.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AudioInputDevice {
    pub name: String,
    pub is_default: bool,
}

/// List all available audio input devices on the default host.
pub fn list_input_devices() -> Result<Vec<AudioInputDevice>> {
    let host = cpal::default_host();
    let default_name = host.default_input_device().and_then(|d| d.name().ok());
    let devices = host
        .input_devices()
        .context("Failed to enumerate audio input devices")?;
    Ok(devices
        .filter_map(|d| {
            d.name().ok().map(|name| AudioInputDevice {
                is_default: Some(name.as_str()) == default_name.as_deref(),
                name,
            })
        })
        .collect())
}

/// Audio capture configuration.
#[derive(Debug, Clone)]
pub struct AudioConfig {
    /// Target sample rate fed into Whisper (16 kHz required).
    pub sample_rate: u32,
    /// Audio chunk size in milliseconds (how often we flush to the channel).
    pub chunk_ms: u32,
    /// Rolling context window in seconds (retained in the ring buffer).
    pub context_window_secs: u32,
    /// Preferred audio input device name. `None` uses the system default.
    /// Falls back to default if the named device is not found.
    pub device_name: Option<String>,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16_000,
            // 500ms chunks balance responsiveness with giving Whisper
            // meaningful audio. The engine accumulates these into a 5s
            // sliding window before transcribing.
            chunk_ms: 500,
            context_window_secs: 10,
            device_name: None,
        }
    }
}

/// Captures mono 16 kHz f32 audio and sends chunks over an internal channel.
///
/// The `Stream` is kept alive inside this struct; the `Receiver<Vec<f32>>`
/// can be moved to a worker thread to process audio chunks without requiring
/// the stream itself to be `Send`.
pub struct AudioCapturer {
    /// Keeps the audio stream alive.
    _stream: Stream,
    /// Receives captured audio chunks (each chunk is ~`config.chunk_ms` ms of audio).
    pub rx: Receiver<Vec<f32>>,
    /// Kept alive here; also referenced by the capture callback closure.
    _acc: std::sync::Arc<std::sync::Mutex<Vec<f32>>>,
    /// Most-recent RMS level stored as `f32::to_bits`. Read with `f32::from_bits`.
    /// Updated by the capture callback on every flushed chunk.
    pub level_rms: std::sync::Arc<AtomicU32>,
}

// SAFETY: cpal marks CoreAudio streams as !Send conservatively, but the
// underlying CoreAudio API is thread-safe. We own this struct exclusively and
// never share it across threads — we only move it into a single keeper thread.
unsafe impl Send for AudioCapturer {}

impl AudioCapturer {
    pub fn new(config: AudioConfig) -> Result<Self> {
        let host = cpal::default_host();

        // Pick device by name if specified; fall back to system default.
        let device = if let Some(ref name) = config.device_name {
            let found = host
                .input_devices()
                .context("Failed to enumerate audio devices")?
                .find(|d| d.name().ok().as_deref() == Some(name.as_str()));
            match found {
                Some(d) => d,
                None => {
                    eprintln!("[ow-audio] device '{name}' not found, falling back to system default");
                    host.default_input_device()
                        .context("No default audio input device")?
                }
            }
        } else {
            host.default_input_device()
                .context("No default audio input device")?
        };

        let supported = device
            .supported_input_configs()
            .context("Failed to enumerate input configs")?;

        let stream_config = find_best_config(supported, config.sample_rate)?;
        let acc: std::sync::Arc<std::sync::Mutex<Vec<f32>>> =
            std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let acc_cb = acc.clone();

        let level_rms = std::sync::Arc::new(AtomicU32::new(0));
        let level_sink = level_rms.clone();

        let (tx, rx) = mpsc::sync_channel::<Vec<f32>>(32);
        let target_sr = config.sample_rate;
        let device_sr = stream_config.sample_rate.0;
        let chunk_samples = (target_sr * config.chunk_ms / 1000) as usize;

        let stream = device
            .build_input_stream(
                &stream_config,
                move |data: &[f32], _info| {
                    let resampled = if device_sr != target_sr {
                        resample(data, device_sr, target_sr)
                    } else {
                        data.to_vec()
                    };
                    let mut buf = acc_cb.lock().unwrap();
                    buf.extend_from_slice(&resampled);
                    // Flush complete chunks.
                    while buf.len() >= chunk_samples {
                        let chunk: Vec<f32> = buf.drain(..chunk_samples).collect();
                        // Update RMS level for VU meter.
                        if !chunk.is_empty() {
                            let rms = (chunk.iter().map(|&s| s * s).sum::<f32>()
                                / chunk.len() as f32)
                                .sqrt();
                            level_sink.store(rms.to_bits(), Ordering::Release);
                        }
                        let _ = tx.try_send(chunk);
                    }
                },
                |err| eprintln!("[ow-audio] capture error: {err}"),
                None,
            )
            .context("Failed to build input stream")?;

        stream.play().context("Failed to start audio stream")?;

        Ok(Self {
            _stream: stream,
            rx,
            _acc: acc,
            level_rms,
        })
    }
}

/// Pick the best `StreamConfig` from supported configs.
fn find_best_config(
    supported: impl Iterator<Item = cpal::SupportedStreamConfigRange>,
    target_sr: u32,
) -> Result<StreamConfig> {
    let mut best: Option<cpal::SupportedStreamConfigRange> = None;
    for cfg in supported {
        if cfg.sample_format() == SampleFormat::F32 {
            match best {
                None => best = Some(cfg),
                Some(ref b) => {
                    if cfg.channels() < b.channels() {
                        best = Some(cfg);
                    }
                }
            }
        }
    }
    let chosen = best.context("No f32 input config available")?;
    let sr = target_sr.clamp(chosen.min_sample_rate().0, chosen.max_sample_rate().0);
    Ok(chosen.with_sample_rate(SampleRate(sr)).into())
}

/// Linear-interpolation resample from `from_sr` to `to_sr` (mono).
fn resample(input: &[f32], from_sr: u32, to_sr: u32) -> Vec<f32> {
    if from_sr == to_sr {
        return input.to_vec();
    }
    let ratio = from_sr as f64 / to_sr as f64;
    let out_len = (input.len() as f64 / ratio).ceil() as usize;
    (0..out_len)
        .map(|i| {
            let src = i as f64 * ratio;
            let lo = src.floor() as usize;
            let hi = (lo + 1).min(input.len() - 1);
            let t = src - lo as f64;
            input[lo] * (1.0 - t) as f32 + input[hi] * t as f32
        })
        .collect()
}
