//! STT pipeline — offline Whisper.cpp transcription via whisper-rs.
//!
//! # Feature flags
//! - `whisper`  — enables the real `WhisperTranscriber` backed by whisper.cpp.
//!   Requires a ggml model file at runtime (see `resolve_model_path`).
//! - `coreml`   — enables Apple CoreML acceleration on macOS (implies `whisper`).
//!
//! Without the `whisper` feature the public API is still fully available;
//! only `WhisperTranscriber::new` will return an error.

mod capture;
mod engine;
pub mod event;
mod transcribe;

pub use capture::AudioConfig;
pub use engine::{SttEngine, SttStatus};
pub use event::TranscriptEvent;
pub use transcribe::MockTranscriber;
#[cfg(feature = "whisper")]
pub use transcribe::WhisperTranscriber;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transcribe::Transcriber;

    // ─── MockTranscriber ──────────────────────────────────────────────────────

    #[test]
    fn test_mock_transcriber_increments() {
        let mut t = MockTranscriber::new();
        let r1 = t.transcribe(&[0.0_f32; 100]).unwrap();
        let r2 = t.transcribe(&[0.0_f32; 100]).unwrap();
        assert!(r1.contains('1'), "first call should contain counter 1: {r1}");
        assert!(r2.contains('2'), "second call should contain counter 2: {r2}");
    }

    #[test]
    fn test_mock_transcriber_default() {
        let mut t = MockTranscriber::default();
        let result = t.transcribe(&[]).unwrap();
        assert!(!result.is_empty());
    }

    // ─── AudioConfig ──────────────────────────────────────────────────────────

    #[test]
    fn test_audio_config_defaults() {
        let cfg = AudioConfig::default();
        assert_eq!(cfg.sample_rate, 16_000, "Whisper requires 16 kHz");
        assert_eq!(cfg.chunk_ms, 500);
        assert_eq!(cfg.context_window_secs, 10);
    }

    #[test]
    fn test_audio_config_clone() {
        let cfg = AudioConfig::default();
        let cfg2 = cfg.clone();
        assert_eq!(cfg.sample_rate, cfg2.sample_rate);
    }

    // ─── SttStatus ────────────────────────────────────────────────────────────

    #[test]
    fn test_stt_status_default_is_stopped() {
        let (engine, _rx) = SttEngine::new();
        assert_eq!(engine.status(), SttStatus::Stopped);
    }

    #[test]
    fn test_stt_status_error_variant() {
        let err = SttStatus::Error("model not found".into());
        // Ensure the variant serializes (used in Tauri command return values).
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("model not found"), "error message should be in JSON: {json}");
    }

    // ─── TranscriptEvent ──────────────────────────────────────────────────────

    #[test]
    fn test_transcript_event_round_trip() {
        let evt = TranscriptEvent {
            text: "Hello world".into(),
            offset_ms: 1500,
            duration_ms: 500,
            mic_active: true,
        };
        let json = serde_json::to_string(&evt).unwrap();
        let back: TranscriptEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(back.text, "Hello world");
        assert_eq!(back.offset_ms, 1500);
        assert_eq!(back.duration_ms, 500);
        assert!(back.mic_active);
    }

    // ─── SttEngine broadcast ─────────────────────────────────────────────────

    #[test]
    fn test_stt_engine_sender_can_broadcast() {
        let (engine, mut rx) = SttEngine::new();
        let tx = engine.sender();
        let evt = TranscriptEvent {
            text: "test".into(),
            offset_ms: 0,
            duration_ms: 500,
            mic_active: false,
        };
        tx.send(evt.clone()).unwrap();
        let received = rx.try_recv().unwrap();
        assert_eq!(received.text, evt.text);
    }
}
