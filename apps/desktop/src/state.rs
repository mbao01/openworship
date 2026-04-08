use ow_audio::{SttEngine, SttStatus};
use ow_core::{DetectionMode, QueueItem};
use ow_display::ContentEvent;
use ow_search::SearchEngine;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::broadcast;

/// Central application state managed by Tauri.
pub struct AppState {
    pub search: Arc<SearchEngine>,
    pub display_tx: broadcast::Sender<ContentEvent>,
    pub stt: Mutex<SttEngine>,
    /// Current detection mode (Auto / Copilot / Airplane / Offline).
    pub detection_mode: Arc<RwLock<DetectionMode>>,
    /// FIFO content queue of detected verses.
    pub queue: Arc<Mutex<VecDeque<QueueItem>>>,
}

impl AppState {
    pub fn stt_status(&self) -> SttStatus {
        self.stt.lock().unwrap().status()
    }
}
