use ow_audio::{SttEngine, SttStatus};
use ow_detect::pipeline::DetectionPipeline;
use ow_display::ContentEvent;
use ow_search::SearchEngine;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

/// Central application state managed by Tauri.
pub struct AppState {
    pub search: Arc<SearchEngine>,
    pub display_tx: broadcast::Sender<ContentEvent>,
    pub stt: Mutex<SttEngine>,
    pub pipeline: DetectionPipeline,
}

impl AppState {
    pub fn stt_status(&self) -> SttStatus {
        self.stt.lock().unwrap().status()
    }
}
