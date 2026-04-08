use serde::{Deserialize, Serialize};

/// A single transcript segment emitted by the STT engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptEvent {
    /// Plain-text transcript for this segment.
    pub text: String,
    /// Milliseconds since the STT engine was started.
    pub offset_ms: u64,
    /// Duration of the audio chunk that produced this segment, in milliseconds.
    pub duration_ms: u32,
    /// Whether the mic input is currently active.
    pub mic_active: bool,
}
