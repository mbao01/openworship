use crate::service::{ContentBankEntry, ProjectItem, ServiceProject};
use crate::settings::AudioSettings;
#[cfg(feature = "deepgram")]
use crate::settings::SttBackend;
use crate::slides::{AnnouncementItem, SermonNote};
use crate::slides::{save_announcements, save_sermon_notes};
use crate::songs::Song;
use crate::state::AppState;
use ow_audio::{AudioConfig, MockTranscriber, SttStatus};
use ow_core::{DetectionMode, QueueItem, QueueStatus, ScriptureDetector};
use ow_display::ContentEvent;
use ow_search::VerseResult;
use std::collections::VecDeque;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::broadcast::Sender as BroadcastSender;

/// Search scripture by reference ("John 3:16") or free-text keywords.
/// Pass `translation` to filter results (e.g. "KJV", "WEB", "BSB").
#[tauri::command]
pub fn search_scriptures(
    query: String,
    translation: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<VerseResult>, String> {
    state
        .search
        .search(&query, translation.as_deref(), 25)
        .map_err(|e| e.to_string())
}

/// Push a verse to the fullscreen display via WebSocket.
///
/// Side-effects:
/// - Adds/updates the entry in the global content bank.
/// - If a service project is currently open, appends the item (no-op if already
///   present by reference).
/// - Emits `service://project-updated` when the project changes.
#[tauri::command]
pub fn push_to_display(
    reference: String,
    text: String,
    translation: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let event = ContentEvent::scripture(reference.clone(), text.clone(), translation.clone());
    // Ignore send errors when no display client is connected.
    let _ = state.display_tx.send(event);

    // ── Update content bank ───────────────────────────────────────────────────
    {
        let mut bank = state.content_bank.write().map_err(|e| e.to_string())?;
        let now = crate::service::now_ms();
        if let Some(entry) = bank.iter_mut().find(|e| e.reference == reference) {
            entry.last_used_ms = now;
            entry.use_count += 1;
        } else {
            bank.push(ContentBankEntry {
                id: crate::service::new_id(),
                reference: reference.clone(),
                text: text.clone(),
                translation: translation.clone(),
                last_used_ms: now,
                use_count: 1,
            });
        }
        crate::service::save_content_bank(&bank).map_err(|e| e.to_string())?;
    }

    // ── Append to active project (if open) ────────────────────────────────────
    let active_id = state
        .active_project_id
        .read()
        .map_err(|e| e.to_string())?
        .clone();

    if let Some(id) = active_id {
        let updated = {
            let mut projects = state.projects.write().map_err(|e| e.to_string())?;
            if let Some(p) = projects.iter_mut().find(|p| p.id == id && p.is_open()) {
                if !p.items.iter().any(|i| i.reference == reference) {
                    let position = p.items.len();
                    p.items.push(ProjectItem {
                        id: crate::service::new_id(),
                        reference,
                        text,
                        translation,
                        position,
                        added_at_ms: crate::service::now_ms(),
                    });
                    let p = p.clone();
                    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
                    Some(p)
                } else {
                    None
                }
            } else {
                None
            }
        };
        if let Some(project) = updated {
            let _ = app.emit("service://project-updated", &project);
        }
    }

    Ok(())
}

/// Return the list of available Bible translations.
#[tauri::command]
pub fn list_translations() -> Vec<TranslationInfo> {
    vec![
        TranslationInfo {
            id: "KJV".into(),
            name: "King James Version".into(),
            abbreviation: "KJV".into(),
        },
        TranslationInfo {
            id: "WEB".into(),
            name: "World English Bible".into(),
            abbreviation: "WEB".into(),
        },
        TranslationInfo {
            id: "BSB".into(),
            name: "Berean Standard Bible".into(),
            abbreviation: "BSB".into(),
        },
    ]
}

#[derive(serde::Serialize)]
pub struct TranslationInfo {
    pub id: String,
    pub name: String,
    pub abbreviation: String,
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to OpenWorship.", name)
}

// ─── STT commands ─────────────────────────────────────────────────────────────

/// Start the STT engine using the backend selected in `AudioSettings`.
///
/// Backend selection (in priority order):
/// 1. Online (Deepgram) — when operator chose Online AND a valid API key is stored.
///    Falls back to offline if the Deepgram connection fails.
/// 2. Offline (Whisper.cpp) — when `whisper` feature is compiled in and model exists.
/// 3. Mock — always available; used in CI and when no model/key is present.
///
/// Scripture detection is handled by the background loop spawned at startup
/// (see `lib.rs`). This command's subscriber only forwards raw transcript
/// events to the operator UI.
#[tauri::command]
pub fn start_stt(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let config = AudioConfig::default();
    let settings = state
        .audio_settings
        .read()
        .map_err(|e| e.to_string())?
        .clone();
    let mut engine = state.stt.lock().map_err(|e| e.to_string())?;

    start_stt_with_settings(&mut engine, config, &settings, &app).map_err(|e| e.to_string())?;

    // Subscribe to the broadcast channel and forward events to the UI only.
    // Detection is handled by the background `detection::run_loop` task.
    let tx = engine.sender();
    let mut rx = tx.subscribe();
    tauri::async_runtime::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(evt) => {
                    let _ = app.emit("stt://transcript", &evt);
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
            }
        }
    });

    Ok(())
}

/// Internal: choose and start the right transcriber based on settings.
fn start_stt_with_settings(
    engine: &mut ow_audio::SttEngine,
    config: AudioConfig,
    #[cfg_attr(not(feature = "deepgram"), allow(unused_variables))]
    settings: &AudioSettings,
    #[cfg_attr(not(feature = "deepgram"), allow(unused_variables))]
    app: &AppHandle,
) -> anyhow::Result<()> {
    // Try online (Deepgram) backend first.
    #[cfg(feature = "deepgram")]
    if settings.backend == SttBackend::Online {
        if settings.deepgram_api_key.is_empty() {
            eprintln!("[stt] Deepgram selected but API key not configured, falling back to offline");
            let _ = app.emit(
                "stt://error",
                "Deepgram unavailable: API key not configured — fell back to offline",
            );
        } else {
            use ow_audio::DeepgramTranscriber;
            match DeepgramTranscriber::new(&settings.deepgram_api_key) {
                Ok(t) => {
                    eprintln!("[stt] starting Deepgram online transcriber");
                    return engine.start(t, config);
                }
                Err(e) => {
                    eprintln!("[stt] Deepgram init failed ({e}), falling back to offline");
                    let _ = app.emit(
                        "stt://error",
                        format!("Deepgram unavailable: {e} — fell back to offline"),
                    );
                }
            }
        }
    }

    // Offline Whisper.cpp (requires `whisper` feature + model file).
    #[cfg(feature = "whisper")]
    {
        use ow_audio::WhisperTranscriber;
        match WhisperTranscriber::from_env() {
            Ok(t) => {
                eprintln!("[stt] starting Whisper.cpp offline transcriber");
                return engine.start(t, config);
            }
            Err(e) => {
                eprintln!("[stt] Whisper model unavailable ({e}), falling back to mock");
            }
        }
    }

    // Always-available mock fallback.
    eprintln!("[stt] starting mock transcriber (no model/key available)");
    engine.start(MockTranscriber::new(), config)
}

/// Stop the STT engine.
#[tauri::command]
pub fn stop_stt(state: State<'_, AppState>) {
    state.stt.lock().unwrap().stop();
}

/// Return the current STT engine status.
#[tauri::command]
pub fn get_stt_status(state: State<'_, AppState>) -> SttStatus {
    state.stt_status()
}

// ─── Audio settings commands ──────────────────────────────────────────────────

/// Return the current audio settings, with the Deepgram API key populated from
/// the OS keychain (never from disk).
#[tauri::command]
pub fn get_audio_settings(state: State<'_, AppState>) -> Result<AudioSettings, String> {
    let mut settings = state
        .audio_settings
        .read()
        .map(|s| s.clone())
        .map_err(|e| e.to_string())?;
    // Always refresh from keychain so the UI sees the current stored value.
    settings.deepgram_api_key = crate::keychain::get_deepgram_api_key().unwrap_or_default();
    Ok(settings)
}

/// Persist updated audio settings.
///
/// The Deepgram API key is saved to the OS keychain; all other fields go to
/// `~/.openworship/settings.json` (the key is excluded from that file).
#[tauri::command]
pub fn set_audio_settings(
    settings: AudioSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Save the key to the keychain before updating shared state.
    crate::keychain::set_deepgram_api_key(&settings.deepgram_api_key)
        .map_err(|e| format!("keychain error: {e}"))?;

    let mut s = state
        .audio_settings
        .write()
        .map_err(|e| e.to_string())?;
    *s = settings.clone();
    drop(s);
    settings.save().map_err(|e| e.to_string())
}

// ─── Detection commands ───────────────────────────────────────────────────────

/// Run the scripture detector on arbitrary text and route results to the queue.
///
/// Intended for manual operator input or testing. Unlike the background loop,
/// this does not apply the rolling window or cooldown dedup.
#[tauri::command]
pub fn detect_in_transcript(
    text: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<QueueItem>, String> {
    let mode = *state
        .detection_mode
        .read()
        .map_err(|e| e.to_string())?;

    if mode == DetectionMode::Airplane {
        let q = state.queue.lock().map_err(|e| e.to_string())?;
        return Ok(q.iter().cloned().collect());
    }

    detect_and_queue(
        &text,
        mode,
        &state.search,
        &state.queue,
        &state.display_tx,
        &app,
    );

    let q = state.queue.lock().map_err(|e| e.to_string())?;
    Ok(q.iter().cloned().collect())
}

/// Set the current detection mode.
#[tauri::command]
pub fn set_detection_mode(
    mode: DetectionMode,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut m = state.detection_mode.write().map_err(|e| e.to_string())?;
    *m = mode;
    Ok(())
}

/// Get the current detection mode.
#[tauri::command]
pub fn get_detection_mode(state: State<'_, AppState>) -> Result<DetectionMode, String> {
    state
        .detection_mode
        .read()
        .map(|m| *m)
        .map_err(|e| e.to_string())
}

/// Return a snapshot of the content queue (FIFO order).
#[tauri::command]
pub fn get_queue(state: State<'_, AppState>) -> Result<Vec<QueueItem>, String> {
    state
        .queue
        .lock()
        .map(|q| q.iter().cloned().collect())
        .map_err(|e| e.to_string())
}

/// Approve a pending item in Copilot mode — pushes to display and marks Live.
#[tauri::command]
pub fn approve_item(
    id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut q = state.queue.lock().map_err(|e| e.to_string())?;

    // Retire any currently Live items before promoting this one.
    for item in q.iter_mut() {
        if item.status == QueueStatus::Live {
            item.status = QueueStatus::Dismissed;
        }
    }

    if let Some(item) = q.iter_mut().find(|i| i.id == id) {
        item.status = QueueStatus::Live;
        let _ = state.display_tx.send(ContentEvent::scripture(
            item.reference.clone(),
            item.text.clone(),
            item.translation.clone(),
        ));
    } else {
        return Err(format!("item {id} not found in queue"));
    }

    let snapshot: Vec<QueueItem> = q.iter().cloned().collect();
    drop(q);
    let _ = app.emit("detection://queue-updated", snapshot);
    Ok(())
}

/// Dismiss a pending item from the queue.
#[tauri::command]
pub fn dismiss_item(
    id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut q = state.queue.lock().map_err(|e| e.to_string())?;

    if let Some(item) = q.iter_mut().find(|i| i.id == id) {
        item.status = QueueStatus::Dismissed;
    } else {
        return Err(format!("item {id} not found in queue"));
    }

    let snapshot: Vec<QueueItem> = q.iter().cloned().collect();
    drop(q);
    let _ = app.emit("detection://queue-updated", snapshot);
    Ok(())
}

/// Clear all items from the content queue.
#[tauri::command]
pub fn clear_queue(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    state
        .queue
        .lock()
        .map_err(|e| e.to_string())?
        .clear();
    let _ = app.emit("detection://queue-updated", Vec::<QueueItem>::new());
    Ok(())
}

// ─── Shared detection helper ──────────────────────────────────────────────────

/// Detect scripture references in `text`, look them up, and push results to the
/// queue (and display in Auto/Offline mode). Emits `detection://queue-updated`.
pub(crate) fn detect_and_queue(
    text: &str,
    mode: DetectionMode,
    search: &ow_search::SearchEngine,
    queue: &Mutex<VecDeque<QueueItem>>,
    display_tx: &BroadcastSender<ContentEvent>,
    app: &AppHandle,
) {
    let detector = ScriptureDetector::new();
    let detected = detector.detect(text);
    if detected.is_empty() {
        return;
    }

    let mut new_items: Vec<QueueItem> = Vec::new();

    for query in &detected {
        // Prefer KJV; fall back to any translation.
        let result = search
            .search(query, Some("KJV"), 1)
            .ok()
            .and_then(|mut r| r.pop())
            .or_else(|| search.search(query, None, 1).ok().and_then(|mut r| r.pop()));

        let Some(r) = result else { continue };

        // Skip if this reference is already active in the queue.
        {
            let q = queue.lock().unwrap_or_else(|e| e.into_inner());
            let already_active = q.iter().any(|i| {
                i.reference == r.reference
                    && matches!(i.status, QueueStatus::Pending | QueueStatus::Live)
            });
            if already_active {
                continue;
            }
        }

        let mut item = QueueItem::new(r.reference.clone(), r.text.clone(), r.translation.clone());

        match mode {
            DetectionMode::Auto | DetectionMode::Offline => {
                item.status = QueueStatus::Live;
                let _ = display_tx.send(ContentEvent::scripture(
                    r.reference,
                    r.text,
                    r.translation,
                ));
            }
            DetectionMode::Copilot => { /* leave Pending */ }
            DetectionMode::Airplane => unreachable!("guarded by caller"),
        }

        new_items.push(item);
    }

    if new_items.is_empty() {
        return;
    }

    let snapshot = {
        let mut q = queue.lock().unwrap_or_else(|e| e.into_inner());
        // In Auto/Offline mode, retire previous Live items.
        if matches!(mode, DetectionMode::Auto | DetectionMode::Offline) {
            for it in q.iter_mut() {
                if it.status == QueueStatus::Live {
                    it.status = QueueStatus::Dismissed;
                }
            }
        }
        for it in new_items {
            q.push_back(it);
        }
        // Cap queue at 50 items: evict oldest dismissed entries first.
        while q.len() > 50 {
            if let Some(pos) = q.iter().position(|i| i.status == QueueStatus::Dismissed) {
                q.remove(pos);
            } else {
                q.pop_front();
            }
        }
        q.iter().cloned().collect::<Vec<_>>()
    };

    let _ = app.emit("detection://queue-updated", snapshot);
}

// ─── Service project commands ─────────────────────────────────────────────────

/// Create a new named service project and make it the active project.
#[tauri::command]
pub fn create_service_project(
    name: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let project = ServiceProject {
        id: crate::service::new_id(),
        name,
        created_at_ms: crate::service::now_ms(),
        closed_at_ms: None,
        items: vec![],
    };

    {
        let mut projects = state.projects.write().map_err(|e| e.to_string())?;
        projects.push(project.clone());
        crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
    }

    {
        let mut active = state.active_project_id.write().map_err(|e| e.to_string())?;
        *active = Some(project.id.clone());
    }

    let _ = app.emit("service://project-updated", &project);
    Ok(project)
}

/// Return all service projects, newest first.
#[tauri::command]
pub fn list_service_projects(state: State<'_, AppState>) -> Result<Vec<ServiceProject>, String> {
    let projects = state.projects.read().map_err(|e| e.to_string())?;
    let mut list: Vec<ServiceProject> = projects.iter().cloned().collect();
    list.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
    Ok(list)
}

/// Return the currently active service project, if any.
#[tauri::command]
pub fn get_active_project(state: State<'_, AppState>) -> Result<Option<ServiceProject>, String> {
    let active_id = state
        .active_project_id
        .read()
        .map_err(|e| e.to_string())?
        .clone();
    let Some(id) = active_id else {
        return Ok(None);
    };
    let projects = state.projects.read().map_err(|e| e.to_string())?;
    Ok(projects.iter().find(|p| p.id == id).cloned())
}

/// Load an existing project as the active project.
///
/// The project's content is ready for the live service.  Closed projects are
/// loaded as read-only (the UI must enforce this based on `closed_at_ms`).
#[tauri::command]
pub fn open_service_project(
    id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let project = {
        let projects = state.projects.read().map_err(|e| e.to_string())?;
        projects
            .iter()
            .find(|p| p.id == id)
            .cloned()
            .ok_or_else(|| format!("project {id} not found"))?
    };

    {
        let mut active = state.active_project_id.write().map_err(|e| e.to_string())?;
        *active = Some(id);
    }

    let _ = app.emit("service://project-updated", &project);
    Ok(project)
}

/// End the active service — marks it read-only and clears the active slot.
#[tauri::command]
pub fn close_active_project(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let active_id = state
        .active_project_id
        .read()
        .map_err(|e| e.to_string())?
        .clone();

    let Some(id) = active_id else {
        return Ok(());
    };

    let project = {
        let mut projects = state.projects.write().map_err(|e| e.to_string())?;
        let p = projects
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| format!("project {id} not found"))?;
        if p.is_open() {
            p.closed_at_ms = Some(crate::service::now_ms());
        }
        let p = p.clone();
        crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
        p
    };

    {
        let mut active = state.active_project_id.write().map_err(|e| e.to_string())?;
        *active = None;
    }

    let _ = app.emit("service://project-updated", &project);
    Ok(())
}

/// Add a scripture item to the active (open) project.
///
/// Silently skips duplicates (same reference already in the project).
#[tauri::command]
pub fn add_item_to_active_project(
    reference: String,
    text: String,
    translation: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let active_id = state
        .active_project_id
        .read()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("no active project")?;

    let project = {
        let mut projects = state.projects.write().map_err(|e| e.to_string())?;
        let p = projects
            .iter_mut()
            .find(|p| p.id == active_id)
            .ok_or_else(|| format!("active project {active_id} not found"))?;

        if !p.is_open() {
            return Err("cannot modify a closed project".into());
        }

        if !p.items.iter().any(|i| i.reference == reference) {
            let position = p.items.len();
            p.items.push(ProjectItem {
                id: crate::service::new_id(),
                reference,
                text,
                translation,
                position,
                added_at_ms: crate::service::now_ms(),
            });
        }

        let p = p.clone();
        crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
        p
    };

    let _ = app.emit("service://project-updated", &project);
    Ok(project)
}

/// Remove an item from the active (open) project.
#[tauri::command]
pub fn remove_item_from_active_project(
    item_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let active_id = state
        .active_project_id
        .read()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("no active project")?;

    let project = {
        let mut projects = state.projects.write().map_err(|e| e.to_string())?;
        let p = projects
            .iter_mut()
            .find(|p| p.id == active_id)
            .ok_or_else(|| format!("active project {active_id} not found"))?;

        if !p.is_open() {
            return Err("cannot modify a closed project".into());
        }

        p.items.retain(|i| i.id != item_id);
        for (i, item) in p.items.iter_mut().enumerate() {
            item.position = i;
        }

        let p = p.clone();
        crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
        p
    };

    let _ = app.emit("service://project-updated", &project);
    Ok(project)
}

/// Reorder items in the active (open) project.
///
/// `item_ids` must contain the IDs of every item in the desired new order.
/// Items whose ID is absent from `item_ids` are silently dropped.
#[tauri::command]
pub fn reorder_active_project_items(
    item_ids: Vec<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let active_id = state
        .active_project_id
        .read()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("no active project")?;

    let project = {
        let mut projects = state.projects.write().map_err(|e| e.to_string())?;
        let p = projects
            .iter_mut()
            .find(|p| p.id == active_id)
            .ok_or_else(|| format!("active project {active_id} not found"))?;

        if !p.is_open() {
            return Err("cannot modify a closed project".into());
        }

        let mut reordered: Vec<ProjectItem> = Vec::with_capacity(p.items.len());
        for (pos, id) in item_ids.iter().enumerate() {
            if let Some(item) = p.items.iter().find(|i| &i.id == id) {
                let mut item = item.clone();
                item.position = pos;
                reordered.push(item);
            }
        }
        p.items = reordered;

        let p = p.clone();
        crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
        p
    };

    let _ = app.emit("service://project-updated", &project);
    Ok(project)
}

/// Search the content bank by reference or verse text.
///
/// Empty query returns the 20 most-recently-used entries.
#[tauri::command]
pub fn search_content_bank(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<ContentBankEntry>, String> {
    let bank = state.content_bank.read().map_err(|e| e.to_string())?;
    let q = query.to_lowercase();
    let results: Vec<ContentBankEntry> = if q.is_empty() {
        let mut entries: Vec<ContentBankEntry> = bank.iter().cloned().collect();
        entries.sort_by(|a, b| b.last_used_ms.cmp(&a.last_used_ms));
        entries.truncate(20);
        entries
    } else {
        bank.iter()
            .filter(|e| {
                e.reference.to_lowercase().contains(&q) || e.text.to_lowercase().contains(&q)
            })
            .cloned()
            .collect()
    };
    Ok(results)
}

// ─── Semantic search status ───────────────────────────────────────────────────

/// Status of the background semantic index.
#[derive(serde::Serialize)]
pub struct SemanticStatus {
    /// `true` when the embedding index is fully built and ready.
    pub ready: bool,
    /// Number of verses currently indexed (0 when not ready).
    pub verse_count: usize,
    /// Whether semantic search is enabled in current settings.
    pub enabled: bool,
}

/// Return the current state of the semantic scripture index.
///
/// The frontend can poll this (or wait for the `semantic://index-ready` event)
/// to know when paraphrase/story matching becomes available.
#[tauri::command]
pub fn get_semantic_status(state: State<'_, AppState>) -> Result<SemanticStatus, String> {
    let enabled = state
        .audio_settings
        .read()
        .map(|s| s.semantic_enabled)
        .unwrap_or(true);

    let (ready, verse_count) = state
        .semantic_index
        .read()
        .map(|guard| match guard.as_ref() {
            Some(idx) => (true, idx.len()),
            None => (false, 0),
        })
        .unwrap_or((false, 0));

    Ok(SemanticStatus {
        ready,
        verse_count,
        enabled,
    })
}

/// Perform an on-demand semantic scripture search against the embedded index.
///
/// Embeds `query` via Ollama and returns the top semantically similar verses.
/// Returns an empty list when the index is not ready or Ollama is unavailable.
#[tauri::command]
pub async fn search_semantic(
    query: String,
    threshold: Option<f32>,
    state: State<'_, AppState>,
) -> Result<Vec<VerseResult>, String> {
    let enabled = state
        .audio_settings
        .read()
        .map(|s| s.semantic_enabled)
        .unwrap_or(true);

    if !enabled {
        return Ok(vec![]);
    }

    let index_ready = state
        .semantic_index
        .read()
        .map(|g| g.is_some())
        .unwrap_or(false);

    if !index_ready {
        return Ok(vec![]);
    }

    let embedding = state
        .ollama
        .embed(&query)
        .await
        .map_err(|e| format!("embed failed: {e}"))?;

    let effective_threshold = threshold.unwrap_or(0.75);

    let results = state
        .semantic_index
        .read()
        .map_err(|e| e.to_string())?
        .as_ref()
        .map(|idx| {
            idx.search(&embedding, effective_threshold, 10)
                .into_iter()
                .map(|m| m.verse)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(results)
}

// ─── Song library commands ─────────────────────────────────────────────────────

/// Return all songs ordered by title.
#[tauri::command]
pub fn list_songs(state: State<'_, AppState>) -> Result<Vec<Song>, String> {
    state
        .songs_db
        .lock()
        .map_err(|e| e.to_string())?
        .list_songs()
        .map_err(|e| e.to_string())
}

/// Full-text search the song library (title, artist, lyrics).
///
/// Empty query returns all songs (up to `limit`).
#[tauri::command]
pub fn search_songs(
    query: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<Song>, String> {
    state
        .songs_db
        .lock()
        .map_err(|e| e.to_string())?
        .search(&query, limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}

/// Fetch a single song by ID.
#[tauri::command]
pub fn get_song(id: i64, state: State<'_, AppState>) -> Result<Option<Song>, String> {
    state
        .songs_db
        .lock()
        .map_err(|e| e.to_string())?
        .get_song(id)
        .map_err(|e| e.to_string())
}

/// Add a song manually and refresh the detection index.
#[tauri::command]
pub fn add_song(
    title: String,
    artist: Option<String>,
    lyrics: String,
    state: State<'_, AppState>,
) -> Result<Song, String> {
    let song = state
        .songs_db
        .lock()
        .map_err(|e| e.to_string())?
        .add_song(&title, artist.as_deref(), &lyrics, Some("manual"), None)
        .map_err(|e| e.to_string())?;

    refresh_song_refs(&state);
    Ok(song)
}

/// Update an existing song's title, artist, and lyrics.
#[tauri::command]
pub fn update_song(
    id: i64,
    title: String,
    artist: Option<String>,
    lyrics: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .songs_db
        .lock()
        .map_err(|e| e.to_string())?
        .update_song(id, &title, artist.as_deref(), &lyrics)
        .map_err(|e| e.to_string())?;
    refresh_song_refs(&state);
    Ok(())
}

/// Delete a song from the library.
#[tauri::command]
pub fn delete_song(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .songs_db
        .lock()
        .map_err(|e| e.to_string())?
        .delete_song(id)
        .map_err(|e| e.to_string())?;
    refresh_song_refs(&state);
    Ok(())
}

/// Import songs from a CCLI SongSelect plain-text export.
///
/// Returns the songs that were actually inserted (skips exact-title duplicates).
#[tauri::command]
pub fn import_songs_ccli(text: String, state: State<'_, AppState>) -> Result<Vec<Song>, String> {
    let imports = crate::songs::parse_ccli_text(&text).map_err(|e| e.to_string())?;
    let inserted = state
        .songs_db
        .lock()
        .map_err(|e| e.to_string())?
        .import_batch(&imports)
        .map_err(|e| e.to_string())?;
    if !inserted.is_empty() {
        refresh_song_refs(&state);
    }
    Ok(inserted)
}

/// Import songs from an OpenLP 2.x XML export.
///
/// Returns the songs that were actually inserted (skips exact-title duplicates).
#[tauri::command]
pub fn import_songs_openlp(xml: String, state: State<'_, AppState>) -> Result<Vec<Song>, String> {
    let imports = crate::songs::parse_openlp_xml(&xml).map_err(|e| e.to_string())?;
    let inserted = state
        .songs_db
        .lock()
        .map_err(|e| e.to_string())?
        .import_batch(&imports)
        .map_err(|e| e.to_string())?;
    if !inserted.is_empty() {
        refresh_song_refs(&state);
    }
    Ok(inserted)
}

/// Push a song to the fullscreen display.
///
/// Side-effects (same as `push_to_display` for scripture):
/// - Updates the content bank.
/// - Appends to the active service project.
/// - Emits `service://project-updated`.
#[tauri::command]
pub fn push_song_to_display(
    id: i64,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let song = state
        .songs_db
        .lock()
        .map_err(|e| e.to_string())?
        .get_song(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("song {id} not found"))?;

    let artist = song.artist.clone().unwrap_or_default();
    let event = ContentEvent::song(song.title.clone(), song.lyrics.clone(), artist.clone());
    let _ = state.display_tx.send(event);

    // ── Update content bank ──────────────────────────────────────────────────
    let reference = song.title.clone();
    let text = song.lyrics.clone();
    let translation = artist.clone();
    {
        let mut bank = state.content_bank.write().map_err(|e| e.to_string())?;
        let now = crate::service::now_ms();
        if let Some(entry) = bank.iter_mut().find(|e| e.reference == reference) {
            entry.last_used_ms = now;
            entry.use_count += 1;
        } else {
            bank.push(ContentBankEntry {
                id: crate::service::new_id(),
                reference: reference.clone(),
                text: text.clone(),
                translation: translation.clone(),
                last_used_ms: now,
                use_count: 1,
            });
        }
        crate::service::save_content_bank(&bank).map_err(|e| e.to_string())?;
    }

    // ── Append to active project (if open) ───────────────────────────────────
    let active_id = state
        .active_project_id
        .read()
        .map_err(|e| e.to_string())?
        .clone();

    if let Some(pid) = active_id {
        let updated = {
            let mut projects = state.projects.write().map_err(|e| e.to_string())?;
            if let Some(p) = projects.iter_mut().find(|p| p.id == pid && p.is_open()) {
                if !p.items.iter().any(|i| i.reference == reference) {
                    let position = p.items.len();
                    p.items.push(ProjectItem {
                        id: crate::service::new_id(),
                        reference,
                        text,
                        translation,
                        position,
                        added_at_ms: crate::service::now_ms(),
                    });
                    let p = p.clone();
                    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
                    Some(p)
                } else {
                    None
                }
            } else {
                None
            }
        };
        if let Some(project) = updated {
            let _ = app.emit("service://project-updated", &project);
        }
    }

    Ok(())
}

// ─── Translation switcher ─────────────────────────────────────────────────────

/// Return the currently active Bible translation abbreviation (default: "KJV").
#[tauri::command]
pub fn get_active_translation(state: State<'_, AppState>) -> String {
    state
        .active_translation
        .read()
        .map(|t| t.clone())
        .unwrap_or_else(|_| "KJV".into())
}

/// Host correction: dismiss the currently live item and promote the next
/// pending item to live.  If there is no pending item the display clears.
///
/// This is the "NOT THIS ONE" action — called when the operator recognises that
/// the auto-detected verse is wrong.
#[tauri::command]
pub fn reject_live_item(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let new_live = {
        let mut q = state.queue.lock().map_err(|e| e.to_string())?;
        // Dismiss the live item.
        if let Some(item) = q.iter_mut().find(|i| i.status == QueueStatus::Live) {
            item.status = QueueStatus::Dismissed;
        }
        // Promote the first pending item to live.
        if let Some(next) = q.iter_mut().find(|i| i.status == QueueStatus::Pending) {
            next.status = QueueStatus::Live;
            Some((next.reference.clone(), next.text.clone(), next.translation.clone()))
        } else {
            None
        }
    };

    if let Some((reference, text, translation)) = new_live {
        let _ = state
            .display_tx
            .send(ContentEvent::scripture(reference, text, translation));
    } else {
        let _ = state.display_tx.send(ContentEvent::clear());
    }

    let snapshot: Vec<QueueItem> = state
        .queue
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .iter()
        .cloned()
        .collect();
    let _ = app.emit(crate::detection::QUEUE_UPDATED_EVENT, snapshot);
    Ok(())
}

/// Switch the active Bible translation.
///
/// If a verse is currently live on the display, re-fetches it in the new
/// translation and pushes the update to the display WebSocket immediately.
/// Also emits `detection://queue-updated` so the queue cards refresh.
#[tauri::command]
pub fn switch_live_translation(
    translation: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    // Update active translation first.
    {
        let mut active = state.active_translation.write().map_err(|e| e.to_string())?;
        *active = translation.clone();
    }

    // Persist preferred translation to session memory (best-effort).
    let mem = crate::service::SessionMemory {
        preferred_translation: Some(translation.clone()),
    };
    let _ = crate::service::save_session_memory(&mem);

    // Find the current Live queue item (first one in Live status).
    let live_item = {
        let q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
        q.iter()
            .find(|i| i.status == ow_core::QueueStatus::Live)
            .cloned()
    };

    if let Some(item) = live_item {
        // Re-fetch the verse in the new translation.
        let result = state
            .search
            .search(&item.reference, Some(&translation), 1)
            .ok()
            .and_then(|mut r| r.pop())
            .or_else(|| {
                // Fall back to any translation if the requested one is unavailable.
                state
                    .search
                    .search(&item.reference, None, 1)
                    .ok()
                    .and_then(|mut r| r.pop())
            });

        if let Some(verse) = result {
            // Push updated translation to display.
            let event = ow_display::ContentEvent::scripture(
                &verse.reference,
                &verse.text,
                &verse.translation,
            );
            let _ = state.display_tx.send(event);

            // Update the queue item text + translation in place.
            {
                let mut q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
                if let Some(live) = q.iter_mut().find(|i| i.status == ow_core::QueueStatus::Live) {
                    live.text = verse.text;
                    live.translation = verse.translation;
                }
            }

            // Emit queue update so the frontend refreshes.
            let snapshot: Vec<QueueItem> =
                state.queue.lock().unwrap_or_else(|e| e.into_inner()).iter().cloned().collect();
            let _ = app.emit(crate::detection::QUEUE_UPDATED_EVENT, snapshot);
        }
    }

    Ok(())
}

/// Status of the song semantic index.
#[derive(serde::Serialize)]
pub struct SongSemanticStatus {
    pub ready: bool,
    pub song_count: usize,
}

#[tauri::command]
pub fn get_song_semantic_status(state: State<'_, AppState>) -> Result<SongSemanticStatus, String> {
    let (ready, song_count) = state
        .song_semantic_index
        .read()
        .map(|g| match g.as_ref() {
            Some(idx) => (true, idx.len()),
            None => (false, 0),
        })
        .unwrap_or((false, 0));
    Ok(SongSemanticStatus { ready, song_count })
}

// ─── Announcements ────────────────────────────────────────────────────────────

/// List all stored announcements and custom slides.
#[tauri::command]
pub fn list_announcements(state: State<'_, AppState>) -> Vec<AnnouncementItem> {
    state.announcements.read().map(|g| g.clone()).unwrap_or_default()
}

/// Create a new announcement (persisted to disk).
#[tauri::command]
pub fn create_announcement(
    title: String,
    body: String,
    image_url: Option<String>,
    keyword_cue: Option<String>,
    state: State<'_, AppState>,
) -> Result<AnnouncementItem, String> {
    let item = AnnouncementItem::new_announcement(title, body, image_url, keyword_cue);
    let mut guard = state.announcements.write().map_err(|e| e.to_string())?;
    guard.push(item.clone());
    save_announcements(&guard).map_err(|e| e.to_string())?;
    Ok(item)
}

/// Delete an announcement by ID.
#[tauri::command]
pub fn delete_announcement(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.announcements.write().map_err(|e| e.to_string())?;
    guard.retain(|a| a.id != id);
    save_announcements(&guard).map_err(|e| e.to_string())
}

/// Push a stored announcement to the main display, add it to the queue, and
/// append it to the active service project.
#[tauri::command]
pub fn push_announcement_to_display(
    id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let announcement = {
        let guard = state.announcements.read().map_err(|e| e.to_string())?;
        guard.iter().find(|a| a.id == id).cloned()
    }
    .ok_or_else(|| format!("announcement {id} not found"))?;

    let ev = ContentEvent::announcement(
        announcement.title.clone(),
        announcement.body.clone(),
        announcement.image_url.clone(),
    );
    let _ = state.display_tx.send(ev);

    let mut item = ow_core::QueueItem::new_announcement(
        announcement.title.clone(),
        announcement.body.clone(),
        announcement.image_url.clone(),
    );
    item.status = ow_core::QueueStatus::Live;
    {
        let mut q = state.queue.lock().map_err(|e| e.to_string())?;
        q.push_back(item);
    }
    let _ = app.emit("detection://queue-updated", ());
    Ok(())
}

// ─── Custom slides ────────────────────────────────────────────────────────────

/// Immediately push a custom slide to the main display and queue.
/// Custom slides are one-off (not persisted to the announcement library).
#[tauri::command]
pub fn push_custom_slide(
    title: String,
    body: String,
    image_url: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let ev = ContentEvent::custom_slide(title.clone(), body.clone(), image_url.clone());
    let _ = state.display_tx.send(ev);

    let mut item =
        ow_core::QueueItem::new_custom_slide(title, body, image_url);
    item.status = ow_core::QueueStatus::Live;
    {
        let mut q = state.queue.lock().map_err(|e| e.to_string())?;
        q.push_back(item);
    }
    let _ = app.emit("detection://queue-updated", ());
    Ok(())
}

// ─── Countdown timers ─────────────────────────────────────────────────────────

/// Push a countdown timer to the main display.
/// The display page renders the countdown and fires a `countdown://done` event
/// when it reaches zero.
#[tauri::command]
pub fn start_countdown(
    title: String,
    duration_secs: u32,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let ev = ContentEvent::countdown(title.clone(), duration_secs);
    let _ = state.display_tx.send(ev);

    let mut item = ow_core::QueueItem::new_countdown(title, duration_secs);
    item.status = ow_core::QueueStatus::Live;
    {
        let mut q = state.queue.lock().map_err(|e| e.to_string())?;
        q.push_back(item);
    }
    let _ = app.emit("detection://queue-updated", ());
    Ok(())
}

// ─── Sermon notes ─────────────────────────────────────────────────────────────

/// List all stored sermon note decks.
#[tauri::command]
pub fn list_sermon_notes(state: State<'_, AppState>) -> Vec<SermonNote> {
    state.sermon_notes.read().map(|g| g.clone()).unwrap_or_default()
}

/// Create a new sermon note deck (persisted to disk).
#[tauri::command]
pub fn create_sermon_note(
    title: String,
    slides: Vec<String>,
    state: State<'_, AppState>,
) -> Result<SermonNote, String> {
    let note = SermonNote::new(title, slides);
    let mut guard = state.sermon_notes.write().map_err(|e| e.to_string())?;
    guard.push(note.clone());
    save_sermon_notes(&guard).map_err(|e| e.to_string())?;
    Ok(note)
}

/// Update an existing sermon note's title and slides.
#[tauri::command]
pub fn update_sermon_note(
    id: String,
    title: String,
    slides: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut guard = state.sermon_notes.write().map_err(|e| e.to_string())?;
    let note = guard
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| format!("sermon note {id} not found"))?;
    note.title = title;
    note.slides = slides;
    save_sermon_notes(&guard).map_err(|e| e.to_string())
}

/// Delete a sermon note deck by ID.
#[tauri::command]
pub fn delete_sermon_note(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.sermon_notes.write().map_err(|e| e.to_string())?;
    guard.retain(|n| n.id != id);
    // Clear active state if it referenced this note.
    if let Ok(mut active) = state.active_sermon_note.write() {
        if active.as_ref().map(|(nid, _)| nid == &id).unwrap_or(false) {
            *active = None;
        }
    }
    save_sermon_notes(&guard).map_err(|e| e.to_string())
}

/// Push a sermon note deck's first slide to the speaker display and mark it
/// active so `advance_sermon_note` can advance through subsequent slides.
#[tauri::command]
pub fn push_sermon_note(
    id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let note = {
        let guard = state.sermon_notes.read().map_err(|e| e.to_string())?;
        guard.iter().find(|n| n.id == id).cloned()
    }
    .ok_or_else(|| format!("sermon note {id} not found"))?;

    if note.slides.is_empty() {
        return Err("sermon note has no slides".into());
    }

    let total = note.slides.len() as u32;
    let ev = ContentEvent::sermon_note(
        note.title.clone(),
        note.slides[0].clone(),
        0,
        total,
    );
    let _ = state.display_tx.send(ev);

    // Mark as active at slide 0.
    {
        let mut active = state.active_sermon_note.write().map_err(|e| e.to_string())?;
        *active = Some((id.clone(), 0));
    }

    // Add a queue reference item.
    let mut item = ow_core::QueueItem::new_sermon_note_ref(note.title.clone(), id);
    item.status = ow_core::QueueStatus::Live;
    {
        let mut q = state.queue.lock().map_err(|e| e.to_string())?;
        q.push_back(item);
    }
    let _ = app.emit("detection://queue-updated", ());
    let _ = app.emit("speaker://note-changed", ());
    Ok(())
}

/// Advance the currently active sermon note to the next slide on the speaker
/// display. Returns an error if no sermon note is active or already at the last
/// slide.
#[tauri::command]
pub fn advance_sermon_note(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let (note, next_index) = {
        let mut active = state.active_sermon_note.write().map_err(|e| e.to_string())?;
        let (note_id, current) = active
            .as_ref()
            .cloned()
            .ok_or("no active sermon note")?;
        let guard = state.sermon_notes.read().map_err(|e| e.to_string())?;
        let note = guard
            .iter()
            .find(|n| n.id == note_id)
            .cloned()
            .ok_or("active sermon note not found")?;
        let next = current + 1;
        if next as usize >= note.slides.len() {
            return Err("already at last slide".into());
        }
        *active = Some((note_id, next));
        (note, next)
    };

    let total = note.slides.len() as u32;
    let ev = ContentEvent::sermon_note(
        note.title.clone(),
        note.slides[next_index as usize].clone(),
        next_index,
        total,
    );
    let _ = state.display_tx.send(ev);
    let _ = app.emit("speaker://note-changed", ());
    Ok(())
}

/// Return the currently active sermon note and its current slide index.
#[tauri::command]
pub fn get_active_sermon_note(
    state: State<'_, AppState>,
) -> Option<(SermonNote, u32)> {
    let active = state.active_sermon_note.read().ok()?;
    let (note_id, slide_idx) = active.as_ref()?;
    let guard = state.sermon_notes.read().ok()?;
    let note = guard.iter().find(|n| &n.id == note_id)?.clone();
    Some((note, *slide_idx))
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/// Refresh the in-memory song title cache used by the detection loop.
fn refresh_song_refs(state: &State<'_, AppState>) {
    if let Ok(db) = state.songs_db.lock() {
        if let Ok(refs) = db.all_refs() {
            if let Ok(mut guard) = state.song_refs.write() {
                *guard = refs;
            }
        }
    }
}

// ─── Phase 15: Artifacts ──────────────────────────────────────────────────────

use crate::artifacts::{
    ArtifactEntry, ArtifactsSettings,
    create_dir as do_create_dir,
    import_file as do_import_file,
    rename_artifact as do_rename,
    delete_artifact as do_delete,
    move_artifact as do_move,
};
use std::path::Path;

#[tauri::command]
pub fn list_artifacts(
    service_id: Option<String>,
    parent_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<ArtifactEntry>, String> {
    state.artifacts_db.lock().map_err(|e| e.to_string())?
        .list(service_id.as_deref(), parent_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_recent_artifacts(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<ArtifactEntry>, String> {
    state.artifacts_db.lock().map_err(|e| e.to_string())?
        .list_recent(limit.unwrap_or(20) as usize)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_starred_artifacts(state: State<'_, AppState>) -> Result<Vec<ArtifactEntry>, String> {
    state.artifacts_db.lock().map_err(|e| e.to_string())?
        .list_starred()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_artifacts(
    query: String,
    service_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<ArtifactEntry>, String> {
    state.artifacts_db.lock().map_err(|e| e.to_string())?
        .search(&query, service_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_artifact_dir(
    service_id: Option<String>,
    parent_path: Option<String>,
    name: String,
    state: State<'_, AppState>,
) -> Result<ArtifactEntry, String> {
    let mut db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
    do_create_dir(&mut db, service_id, parent_path, name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_artifact_file(
    service_id: Option<String>,
    parent_path: Option<String>,
    source_path: String,
    state: State<'_, AppState>,
) -> Result<ArtifactEntry, String> {
    let mut db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
    do_import_file(&mut db, service_id, parent_path, Path::new(&source_path))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_artifact(
    id: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<ArtifactEntry, String> {
    let mut db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
    do_rename(&mut db, &id, new_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_artifact(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
    do_delete(&mut db, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_artifact(
    id: String,
    new_parent_path: String,
    state: State<'_, AppState>,
) -> Result<ArtifactEntry, String> {
    let mut db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
    do_move(&mut db, &id, new_parent_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn star_artifact(id: String, starred: bool, state: State<'_, AppState>) -> Result<(), String> {
    state.artifacts_db.lock().map_err(|e| e.to_string())?
        .toggle_star(&id, starred)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_artifacts_settings(state: State<'_, AppState>) -> Result<ArtifactsSettings, String> {
    Ok(state.artifacts_db.lock().map_err(|e| e.to_string())?.settings().clone())
}

#[tauri::command]
pub fn set_artifacts_base_path(path: String, state: State<'_, AppState>) -> Result<(), String> {
    state.artifacts_db.lock().map_err(|e| e.to_string())?
        .set_base_path(path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_artifact(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
    let entry = db.get_by_id(&id).map_err(|e| e.to_string())?
        .ok_or_else(|| format!("artifact not found: {id}"))?;
    let abs = db.abs_path(&entry.path);
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&abs).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&abs).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&abs).spawn().map_err(|e| e.to_string())?;
    Ok(())
}
