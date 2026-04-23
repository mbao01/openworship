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

/// Connection state changes emitted by [`crate::DeepgramTranscriber`].
///
/// Forward these as Tauri events (e.g. `"stt://deepgram-connection"`) so the
/// frontend can surface reconnection status in the UI.
#[cfg(feature = "deepgram")]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum DeepgramConnectionEvent {
    /// Reconnection is in progress after an unexpected WebSocket disconnect.
    Reconnecting {
        /// Which reconnection attempt this is (1-based).
        attempt: u32,
        /// How many seconds we wait before this attempt (exponential backoff).
        delay_secs: u64,
    },
    /// The WebSocket session was successfully restored after a disconnect.
    Restored,
}
