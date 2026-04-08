use crate::identity::ChurchIdentity;
use crate::service::{ContentBankEntry, ServiceProject};
use crate::settings::AudioSettings;
use ow_audio::{SttEngine, SttStatus};
use ow_core::{DetectionMode, QueueItem};
use ow_display::ContentEvent;
use ow_embed::{OllamaClient, SemanticIndex};
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
    /// Operator audio/STT settings, persisted to disk.
    pub audio_settings: Arc<RwLock<AudioSettings>>,
    /// Church + branch identity. `None` until onboarding completes.
    pub identity: Arc<RwLock<Option<ChurchIdentity>>>,
    /// All service projects, persisted to `~/.openworship/projects.json`.
    pub projects: Arc<RwLock<Vec<ServiceProject>>>,
    /// Currently open project ID, if any.
    pub active_project_id: Arc<RwLock<Option<String>>>,
    /// Global content bank, persisted to `~/.openworship/content_bank.json`.
    pub content_bank: Arc<RwLock<Vec<ContentBankEntry>>>,
    /// Semantic scripture index — `None` until the background embedding task
    /// completes (or when Ollama is not available).
    pub semantic_index: Arc<RwLock<Option<SemanticIndex>>>,
    /// Ollama client used for real-time query embedding during detection.
    pub ollama: Arc<OllamaClient>,
}

impl AppState {
    pub fn stt_status(&self) -> SttStatus {
        self.stt.lock().unwrap().status()
    }
}
