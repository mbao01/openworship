use crate::identity::ChurchIdentity;
use crate::service::{ContentBankEntry, ServiceProject};
use crate::settings::AudioSettings;
use crate::slides::{AnnouncementItem, SermonNote};
use crate::songs::{SongSemanticIndex, SongsDb};
use crate::summaries::{EmailSettings, EmailSubscriber, ServiceSummary};
use ow_audio::{SttEngine, SttStatus};
use ow_core::{DetectionMode, QueueItem, SongRef};
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
    /// FIFO content queue of detected content items.
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
    /// Scripture semantic index — `None` until the background embedding task
    /// completes (or when Ollama is not available).
    pub semantic_index: Arc<RwLock<Option<SemanticIndex>>>,
    /// Ollama client used for real-time query embedding during detection.
    pub ollama: Arc<OllamaClient>,
    /// Song library database.
    pub songs_db: Arc<Mutex<SongsDb>>,
    /// Semantic index over song lyric phrases.
    pub song_semantic_index: Arc<RwLock<Option<SongSemanticIndex>>>,
    /// Cached song title list for the detection loop (refreshed on add/delete).
    pub song_refs: Arc<RwLock<Vec<SongRef>>>,
    /// Currently selected Bible translation for live display and detection.
    /// Defaults to "KJV"; updated by `switch_live_translation`.
    pub active_translation: Arc<RwLock<String>>,
    /// Stored announcements and custom slides, persisted to disk.
    pub announcements: Arc<RwLock<Vec<AnnouncementItem>>>,
    /// Sermon note decks, persisted to disk.
    pub sermon_notes: Arc<RwLock<Vec<SermonNote>>>,
    /// Active sermon note state: `(note_id, current_slide_index)`.
    /// `None` when no sermon note is currently in use.
    pub active_sermon_note: Arc<RwLock<Option<(String, u32)>>>,
    /// Generated service summaries, persisted to `~/.openworship/summaries.json`.
    pub summaries: Arc<RwLock<Vec<ServiceSummary>>>,
    /// Email subscribers per church, persisted to `~/.openworship/subscribers.json`.
    pub subscribers: Arc<RwLock<Vec<EmailSubscriber>>>,
    /// SMTP settings + auto-send config.
    pub email_settings: Arc<RwLock<EmailSettings>>,
    /// Anthropic API key for Claude summary generation (from keychain).
    pub anthropic_api_key: Arc<RwLock<String>>,
}

impl AppState {
    pub fn stt_status(&self) -> SttStatus {
        self.stt.lock().unwrap().status()
    }
}
