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
#[tauri::command]
pub fn push_to_display(
    reference: String,
    text: String,
    translation: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let event = ContentEvent::scripture(reference, text, translation);
    // Ignore send errors when no display client is connected.
    let _ = state.display_tx.send(event);
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

    start_stt_with_settings(&mut engine, config, &settings).map_err(|e| e.to_string())?;

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
) -> anyhow::Result<()> {
    // Try online (Deepgram) backend first.
    #[cfg(feature = "deepgram")]
    if settings.backend == SttBackend::Online && !settings.deepgram_api_key.is_empty() {
        use ow_audio::DeepgramTranscriber;
        match DeepgramTranscriber::new(&settings.deepgram_api_key) {
            Ok(t) => {
                eprintln!("[stt] starting Deepgram online transcriber");
                return engine.start(t, config);
            }
            Err(e) => {
                eprintln!("[stt] Deepgram init failed ({e}), falling back to offline");
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

/// Return the current audio settings.
#[tauri::command]
pub fn get_audio_settings(state: State<'_, AppState>) -> Result<AudioSettings, String> {
    state
        .audio_settings
        .read()
        .map(|s| s.clone())
        .map_err(|e| e.to_string())
}

/// Persist updated audio settings to disk.
#[tauri::command]
pub fn set_audio_settings(
    settings: AudioSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
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
