use crate::service::{ContentBankEntry, ProjectItem, ServiceProject};
use crate::settings::AudioSettings;
#[cfg(feature = "deepgram")]
use crate::settings::SttBackend;
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
