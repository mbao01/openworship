use ow_display::ContentEvent;
use ow_search::SearchEngine;
use tokio::sync::broadcast;

/// Central application state managed by Tauri.
pub struct AppState {
    pub search: SearchEngine,
    pub display_tx: broadcast::Sender<ContentEvent>,
}
