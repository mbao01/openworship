use crate::service::{ContentBankEntry, ProjectItem, ServiceProject, ServiceTask, TaskStatus, new_id, now_ms};
use crate::settings::{AudioSettings, SttBackend};
use crate::slides::{AnnouncementItem, SermonNote};
use crate::slides::{save_announcements, save_sermon_notes};
use crate::songs::Song;
use crate::state::AppState;
use ow_audio::{AudioConfig, AudioInputDevice, SttStatus, list_input_devices};
use ow_core::{DetectionMode, QueueItem, QueueStatus, ScriptureDetector};
use ow_display::ContentEvent;
use ow_search::VerseResult;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
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
                        item_type: "scripture".into(),
                        duration_secs: None,
                        notes: None,
                        asset_ids: vec![],
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
    let settings = state
        .audio_settings
        .read()
        .map_err(|e| e.to_string())?
        .clone();
    let config = AudioConfig {
        device_name: settings.audio_input_device.clone(),
        ..AudioConfig::default()
    };
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
    settings: &AudioSettings,
    app: &AppHandle,
) -> anyhow::Result<()> {
    // Off — operator explicitly disabled STT.
    if settings.backend == SttBackend::Off {
        eprintln!("[stt] STT disabled by operator");
        return Ok(());
    }

    // Deepgram backend — only when selected AND feature compiled in.
    #[cfg(feature = "deepgram")]
    if settings.backend == SttBackend::Deepgram {
        if settings.deepgram_api_key.is_empty() {
            eprintln!("[stt] Deepgram selected but API key not configured, falling back to Whisper");
            let _ = app.emit(
                "stt://error",
                "Deepgram unavailable: API key not configured — fell back to Whisper",
            );
        } else {
            use ow_audio::DeepgramTranscriber;
            match DeepgramTranscriber::new(&settings.deepgram_api_key) {
                Ok(t) => {
                    eprintln!("[stt] starting Deepgram online transcriber");
                    return engine.start(t, config);
                }
                Err(e) => {
                    eprintln!("[stt] Deepgram init failed ({e}), falling back to Whisper");
                    let _ = app.emit(
                        "stt://error",
                        format!("Deepgram unavailable: {e} — fell back to Whisper"),
                    );
                }
            }
        }
    }

    // Whisper.cpp (requires `whisper` feature + model file on disk).
    #[cfg(feature = "whisper")]
    {
        use ow_audio::WhisperTranscriber;
        match WhisperTranscriber::from_env() {
            Ok(t) => {
                eprintln!("[stt] starting Whisper.cpp offline transcriber");
                return engine.start(t, config);
            }
            Err(e) => {
                eprintln!("[stt] Whisper model unavailable: {e}");
                let _ = app.emit("stt://model-needed", e.to_string());
                // In release builds, don't silently fall back to mock — surface
                // the error so the operator knows to download the model.
                #[cfg(not(debug_assertions))]
                return Err(e);
            }
        }
    }

    anyhow::bail!("No STT backend available. Download the Whisper model from Settings → Audio.")
}

/// Download the Whisper base.en model to `~/.openworship/models/ggml-base.en.bin`.
/// Returns `true` if a usable Whisper model file already exists on disk.
#[tauri::command]
pub fn check_whisper_model() -> bool {
    #[cfg(feature = "whisper")]
    {
        ow_audio::resolve_model_path().is_ok()
    }
    #[cfg(not(feature = "whisper"))]
    {
        false
    }
}

///
/// Emits `stt://model-download-progress` events during download with payload
/// `{ downloaded_bytes: u64, total_bytes: u64 | null, percent: number | null }`.
/// Emits `stt://model-download-complete` on success.
/// Returns an error string on failure.
#[tauri::command]
pub async fn download_whisper_model(app: AppHandle) -> Result<(), String> {
    use reqwest::header::CONTENT_LENGTH;
    use tokio::io::AsyncWriteExt;

    const MODEL_URL: &str =
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin";

    let dest = {
        #[cfg(feature = "whisper")]
        {
            ow_audio::default_model_path()
        }
        #[cfg(not(feature = "whisper"))]
        {
            let home = std::env::var("HOME").unwrap_or_default();
            std::path::PathBuf::from(home)
                .join(".openworship")
                .join("models")
                .join("ggml-base.en.bin")
        }
    };

    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create models directory: {e}"))?;
    }

    let client = reqwest::Client::new();
    let response = client
        .get(MODEL_URL)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with HTTP {}", response.status()));
    }

    let total_bytes: Option<u64> = response
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse().ok());

    let tmp = dest.with_extension("bin.tmp");
    let mut file = tokio::fs::File::create(&tmp)
        .await
        .map_err(|e| format!("Failed to create temp file: {e}"))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("Download stream error: {e}"))?;
        file.write_all(&bytes)
            .await
            .map_err(|e| format!("File write error: {e}"))?;
        downloaded += bytes.len() as u64;
        let percent = total_bytes.map(|t| downloaded as f32 / t as f32 * 100.0);
        let _ = app.emit(
            "stt://model-download-progress",
            serde_json::json!({
                "downloaded_bytes": downloaded,
                "total_bytes": total_bytes,
                "percent": percent,
            }),
        );
    }

    file.flush().await.map_err(|e| format!("File flush error: {e}"))?;
    drop(file);

    tokio::fs::rename(&tmp, &dest)
        .await
        .map_err(|e| format!("Failed to finalise model file: {e}"))?;

    let _ = app.emit("stt://model-download-complete", dest.to_string_lossy().as_ref());
    eprintln!("[stt] Whisper model downloaded to {}", dest.display());
    Ok(())
}

/// Stop the STT engine.
#[tauri::command]
pub fn stop_stt(state: State<'_, AppState>) {
    if let Ok(mut engine) = state.stt.lock() {
        engine.stop();
    } else {
        eprintln!("[stt] failed to acquire lock for stop; mutex poisoned");
    }
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

// ─── Audio input device commands ─────────────────────────────────────────────

/// Return all available audio input devices on the default host.
/// Each entry includes the device name and whether it is the system default.
#[tauri::command]
pub fn list_audio_input_devices() -> Result<Vec<AudioInputDevice>, String> {
    list_input_devices().map_err(|e| e.to_string())
}

/// Return the most-recent RMS audio level `[0.0, 1.0]`.
/// Reads from the STT engine if running, otherwise from the audio monitor.
#[tauri::command]
pub fn get_audio_level(state: State<'_, AppState>) -> f32 {
    // Prefer STT engine level when it's running
    let stt_level = state.stt.lock().unwrap_or_else(|e| e.into_inner()).audio_level_rms();
    if stt_level > 0.0 {
        return stt_level;
    }
    // Fall back to standalone audio monitor
    state.audio_monitor.level_rms()
}

/// Start a lightweight audio capture purely for VU meter / mic check.
/// Does NOT start transcription — just opens the mic and reads levels.
#[tauri::command]
pub fn start_audio_monitor(state: State<'_, AppState>) -> Result<(), String> {
    let device_name = state
        .audio_settings
        .read()
        .map_err(|e| e.to_string())?
        .audio_input_device
        .clone();
    eprintln!("[audio-monitor] starting with device: {:?}", device_name);
    let result = state
        .audio_monitor
        .start(device_name)
        .map_err(|e| {
            eprintln!("[audio-monitor] start failed: {e}");
            e.to_string()
        });
    if result.is_ok() {
        eprintln!("[audio-monitor] started successfully, is_running={}", state.audio_monitor.is_running());
    }
    result
}

/// Stop the audio monitor.
#[tauri::command]
pub fn stop_audio_monitor(state: State<'_, AppState>) {
    state.audio_monitor.stop();
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

// ─── Queue navigation commands ────────────────────────────────────────────────

/// Build the appropriate `ContentEvent` for a queue item based on its `kind`.
fn content_event_for_item(item: &QueueItem) -> ow_display::ContentEvent {
    use ow_core::content_kind;
    match item.kind.as_str() {
        content_kind::SONG => {
            ow_display::ContentEvent::song(
                item.reference.clone(),
                item.text.clone(),
                item.translation.clone(),
            )
        }
        content_kind::ANNOUNCEMENT => {
            ow_display::ContentEvent::announcement(
                item.reference.clone(),
                item.text.clone(),
                item.image_url.clone(),
            )
        }
        content_kind::CUSTOM_SLIDE => {
            ow_display::ContentEvent::custom_slide(
                item.reference.clone(),
                item.text.clone(),
                item.image_url.clone(),
            )
        }
        content_kind::COUNTDOWN => {
            ow_display::ContentEvent::countdown(
                item.reference.clone(),
                item.duration_secs.unwrap_or(0),
            )
        }
        content_kind::SERMON_NOTE => {
            ow_display::ContentEvent::sermon_note(
                item.reference.clone(),
                item.text.clone(),
                0,
                1,
            )
        }
        // Default: scripture (and any unknown kinds)
        _ => ow_display::ContentEvent::scripture(
            item.reference.clone(),
            item.text.clone(),
            item.translation.clone(),
        ),
    }
}

/// Skip (dismiss) a specific pending queue item.
///
/// Called by the SKIP button on the preview panel.
#[tauri::command]
pub fn skip_item(
    item_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut q = state.queue.lock().map_err(|e| e.to_string())?;
    if let Some(item) = q.iter_mut().find(|i| i.id == item_id) {
        item.status = QueueStatus::Dismissed;
    } else {
        return Err(format!("item {item_id} not found in queue"));
    }
    let snapshot: Vec<QueueItem> = q.iter().cloned().collect();
    drop(q);
    let _ = app.emit(crate::detection::QUEUE_UPDATED_EVENT, snapshot);
    Ok(())
}

/// Advance to the next pending item in the queue.
///
/// Dismisses the currently live item and promotes the next pending item to
/// live.  If there is no pending item, clears the display.
/// Called by the NEXT button on the live panel.
#[tauri::command]
pub fn next_item(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let new_live = {
        let mut q = state.queue.lock().map_err(|e| e.to_string())?;
        // Dismiss the current live item.
        if let Some(item) = q.iter_mut().find(|i| i.status == QueueStatus::Live) {
            item.status = QueueStatus::Dismissed;
        }
        // Promote the first pending item.
        if let Some(next) = q.iter_mut().find(|i| i.status == QueueStatus::Pending) {
            next.status = QueueStatus::Live;
            Some(next.clone())
        } else {
            None
        }
    };

    if let Some(item) = new_live {
        let _ = state.display_tx.send(content_event_for_item(&item));
    } else {
        let _ = state.display_tx.send(ow_display::ContentEvent::clear());
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

/// Go back to the previous item in the queue.
///
/// Dismisses the current live item and re-promotes the most recently
/// dismissed item to live.  No-op if there is no previous item.
/// Called by the PREV button on the live panel.
#[tauri::command]
pub fn prev_item(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let new_live = {
        let mut q = state.queue.lock().map_err(|e| e.to_string())?;

        // Find the index of the current live item.
        let live_idx = q.iter().position(|i| i.status == QueueStatus::Live);

        // Find the last dismissed item before live (or the last dismissed if no live).
        let prev_idx = match live_idx {
            Some(li) => q.iter().take(li).rposition(|i| i.status == QueueStatus::Dismissed),
            None => q.iter().rposition(|i| i.status == QueueStatus::Dismissed),
        };

        if let Some(pi) = prev_idx {
            // Dismiss the current live item.
            if let Some(li) = live_idx {
                q[li].status = QueueStatus::Dismissed;
            }
            // Re-promote the previous item.
            q[pi].status = QueueStatus::Live;
            Some(q[pi].clone())
        } else {
            None
        }
    };

    if let Some(item) = new_live {
        let _ = state.display_tx.send(content_event_for_item(&item));

        let snapshot: Vec<QueueItem> = state
            .queue
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .cloned()
            .collect();
        let _ = app.emit(crate::detection::QUEUE_UPDATED_EVENT, snapshot);
    }
    // If no previous item, do nothing (button is a no-op).
    Ok(())
}

/// Clear the currently displayed content.
///
/// Dismisses the live queue item (if any) and sends a clear event to the
/// display WebSocket.  Called by the CLEAR CONTENT button.
#[tauri::command]
pub fn clear_live(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    {
        let mut q = state.queue.lock().map_err(|e| e.to_string())?;
        for item in q.iter_mut() {
            if item.status == QueueStatus::Live {
                item.status = QueueStatus::Dismissed;
            }
        }
    }
    let _ = state.display_tx.send(ow_display::ContentEvent::clear());

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

/// Delete a service project and all its items and tasks.
#[tauri::command]
pub fn delete_service_project(
    project_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut projects = state.projects.write().map_err(|e| e.to_string())?;
    let len_before = projects.len();
    projects.retain(|p| p.id != project_id);
    if projects.len() == len_before {
        return Err("Project not found".into());
    }
    // Clear active project if it was the deleted one
    {
        let mut active = state.active_project_id.write().map_err(|e| e.to_string())?;
        if active.as_deref() == Some(&project_id) {
            *active = None;
        }
    }
    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
    let _ = app.emit("service://projects-changed", ());
    Ok(())
}

/// Update a service project's name, description, or scheduled time.
#[tauri::command]
pub fn update_service_project(
    project_id: String,
    name: Option<String>,
    description: Option<String>,
    scheduled_at_ms: Option<i64>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let mut projects = state.projects.write().map_err(|e| e.to_string())?;
    let idx = projects.iter().position(|p| p.id == project_id).ok_or("Project not found")?;
    if let Some(n) = name {
        projects[idx].name = n;
    }
    if let Some(d) = description {
        projects[idx].description = if d.is_empty() { None } else { Some(d) };
    }
    if let Some(t) = scheduled_at_ms {
        projects[idx].scheduled_at_ms = Some(t);
    }
    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
    let result = projects[idx].clone();
    let _ = app.emit("service://project-updated", &result);
    Ok(result)
}

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
        scheduled_at_ms: None,
        description: None,
        items: vec![],
        tasks: vec![],
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
                item_type: "scripture".into(),
                duration_secs: None,
                notes: None,
                asset_ids: vec![],
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

// ─── Project item update ─────────────────────────────────────────────────────

/// Update metadata on a project item (duration, notes, type).
#[tauri::command]
pub fn update_project_item(
    item_id: String,
    duration_secs: Option<u32>,
    notes: Option<String>,
    item_type: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let mut projects = state.projects.write().map_err(|e| e.to_string())?;
    let active_id = state.active_project_id.read().map_err(|e| e.to_string())?;
    let active_id = active_id.as_deref().ok_or("No active project")?.to_string();
    let idx = projects.iter().position(|p| p.id == active_id).ok_or("Project not found")?;
    let item = projects[idx].items.iter_mut().find(|i| i.id == item_id).ok_or("Item not found")?;
    if let Some(d) = duration_secs { item.duration_secs = Some(d); }
    if let Some(n) = notes { item.notes = if n.is_empty() { None } else { Some(n) }; }
    if let Some(t) = item_type { item.item_type = t; }
    let result = projects[idx].clone();
    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
    let _ = app.emit("service://project-updated", &result);
    Ok(result)
}

// ─── Service tasks ───────────────────────────────────────────────────────────

/// Create a task within a service project.
#[tauri::command]
pub fn create_service_task(
    service_id: String,
    title: String,
    description: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let mut projects = state.projects.write().map_err(|e| e.to_string())?;
    let idx = projects.iter().position(|p| p.id == service_id).ok_or("Project not found")?;
    let task = ServiceTask {
        id: new_id(),
        service_id: service_id.clone(),
        title,
        description,
        status: TaskStatus::Todo,
        created_at_ms: now_ms(),
        updated_at_ms: now_ms(),
    };
    projects[idx].tasks.push(task);
    let result = projects[idx].clone();
    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
    let _ = app.emit("service://project-updated", &result);
    Ok(result)
}

/// Update a task's title, description, or status.
#[tauri::command]
pub fn update_service_task(
    task_id: String,
    title: Option<String>,
    description: Option<String>,
    status: Option<TaskStatus>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let mut projects = state.projects.write().map_err(|e| e.to_string())?;
    let idx = projects.iter()
        .position(|p| p.tasks.iter().any(|t| t.id == task_id))
        .ok_or("Task not found in any project")?;
    let task = projects[idx].tasks.iter_mut().find(|t| t.id == task_id)
        .expect("checked above: position guarantees task exists");
    if let Some(t) = title { task.title = t; }
    if let Some(d) = description { task.description = if d.is_empty() { None } else { Some(d) }; }
    if let Some(s) = status { task.status = s; }
    task.updated_at_ms = now_ms();
    let result = projects[idx].clone();
    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
    let _ = app.emit("service://project-updated", &result);
    Ok(result)
}

/// Delete a task from a service project.
#[tauri::command]
pub fn delete_service_task(
    task_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let mut projects = state.projects.write().map_err(|e| e.to_string())?;
    let idx = projects.iter()
        .position(|p| p.tasks.iter().any(|t| t.id == task_id))
        .ok_or("Task not found in any project")?;
    projects[idx].tasks.retain(|t| t.id != task_id);
    let result = projects[idx].clone();
    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
    let _ = app.emit("service://project-updated", &result);
    Ok(result)
}

// ─── Asset linking ───────────────────────────────────────────────────────────

/// Link an existing artifact to a project item's assets.
#[tauri::command]
pub fn link_asset_to_item(
    item_id: String,
    artifact_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let mut projects = state.projects.write().map_err(|e| e.to_string())?;
    let active_id = state.active_project_id.read().map_err(|e| e.to_string())?;
    let active_id = active_id.as_deref().ok_or("No active project")?.to_string();
    let idx = projects.iter().position(|p| p.id == active_id).ok_or("Project not found")?;
    let item = projects[idx].items.iter_mut().find(|i| i.id == item_id).ok_or("Item not found")?;
    if !item.asset_ids.contains(&artifact_id) {
        item.asset_ids.push(artifact_id);
    }
    let result = projects[idx].clone();
    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
    let _ = app.emit("service://project-updated", &result);
    Ok(result)
}

/// Unlink an artifact from a project item's assets.
#[tauri::command]
pub fn unlink_asset_from_item(
    item_id: String,
    artifact_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let mut projects = state.projects.write().map_err(|e| e.to_string())?;
    let active_id = state.active_project_id.read().map_err(|e| e.to_string())?;
    let active_id = active_id.as_deref().ok_or("No active project")?.to_string();
    let idx = projects.iter().position(|p| p.id == active_id).ok_or("Project not found")?;
    let item = projects[idx].items.iter_mut().find(|i| i.id == item_id).ok_or("Item not found")?;
    item.asset_ids.retain(|id| id != &artifact_id);
    let result = projects[idx].clone();
    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
    let _ = app.emit("service://project-updated", &result);
    Ok(result)
}

/// Upload a file to the service's artifact directory, then link it to a project item.
#[tauri::command]
pub fn upload_and_link_asset(
    item_id: String,
    file_name: String,
    data: Vec<u8>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServiceProject, String> {
    let active_id = {
        let id = state.active_project_id.read().map_err(|e| e.to_string())?;
        id.as_ref().cloned().ok_or("No active project")?
    };

    // Import file into artifacts
    let artifact = {
        let mut db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
        crate::artifacts::write_artifact_bytes(&mut db, Some(active_id.clone()), None, file_name, data)
            .map_err(|e| e.to_string())?
    };

    // Link to the item
    let mut projects = state.projects.write().map_err(|e| e.to_string())?;
    let idx = projects.iter().position(|p| p.id == active_id).ok_or("Project not found")?;
    let item = projects[idx].items.iter_mut().find(|i| i.id == item_id).ok_or("Item not found")?;
    if !item.asset_ids.contains(&artifact.id) {
        item.asset_ids.push(artifact.id);
    }
    let result = projects[idx].clone();
    crate::service::save_projects(&projects).map_err(|e| e.to_string())?;
    let _ = app.emit("service://project-updated", &result);
    Ok(result)
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
/// Embeds `query` locally and returns the top semantically similar verses.
/// Returns an empty list when the index is not ready.
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

    let embedder = Arc::clone(&state.embedder);
    let q = query.clone();
    let embedding = tokio::task::spawn_blocking(move || embedder.embed(&q))
        .await
        .map_err(|e| format!("embed task failed: {e}"))?
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
                        item_type: "scripture".into(),
                        duration_secs: None,
                        notes: None,
                        asset_ids: vec![],
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

/// Update an existing announcement's fields (title, body, image_url, keyword_cue).
#[tauri::command]
pub fn update_announcement(
    id: String,
    title: String,
    body: String,
    image_url: Option<String>,
    keyword_cue: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut guard = state.announcements.write().map_err(|e| e.to_string())?;
    let ann = guard
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| format!("announcement {id} not found"))?;
    ann.title = title;
    ann.body = body;
    ann.image_url = image_url;
    ann.keyword_cue = keyword_cue;
    save_announcements(&guard).map_err(|e| e.to_string())
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

/// Rewind the currently active sermon note to the previous slide.
/// Returns an error if no sermon note is active or already at the first slide.
#[tauri::command]
pub fn rewind_sermon_note(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let (note, prev_index) = {
        let mut active = state.active_sermon_note.write().map_err(|e| e.to_string())?;
        let (note_id, current) = active
            .as_ref()
            .cloned()
            .ok_or("no active sermon note")?;
        if current == 0 {
            return Err("already at first slide".into());
        }
        let guard = state.sermon_notes.read().map_err(|e| e.to_string())?;
        let note = guard
            .iter()
            .find(|n| n.id == note_id)
            .cloned()
            .ok_or("active sermon note not found")?;
        let prev = current - 1;
        *active = Some((note_id, prev));
        (note, prev)
    };

    let total = note.slides.len() as u32;
    let ev = ContentEvent::sermon_note(
        note.title.clone(),
        note.slides[prev_index as usize].clone(),
        prev_index,
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

// ─── Phase 14: Service summaries + email subscriptions ────────────────────────

use crate::summaries::{
    EmailSettings, EmailSubscriber, ServiceSummary,
    save_summaries, save_subscribers, save_email_settings,
};

/// Generate an AI summary for a completed service project and persist it.
///
/// Returns the created `ServiceSummary`. Does NOT send email — call
/// `send_summary_email` separately (or let `auto_send` handle it on close).
#[tauri::command]
pub async fn generate_service_summary(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<ServiceSummary, String> {
    // Find the project.
    let project = {
        let projects = state.projects.read().map_err(|e| e.to_string())?;
        projects
            .iter()
            .find(|p| p.id == project_id)
            .cloned()
            .ok_or_else(|| format!("Project not found: {project_id}"))?
    };

    // Get church ID from identity.
    let church_id = {
        state
            .identity
            .read()
            .map_err(|e| e.to_string())?
            .as_ref()
            .map(|i| i.church_id.clone())
            .unwrap_or_else(|| "unknown".into())
    };

    let api_key = state
        .anthropic_api_key
        .read()
        .map_err(|e| e.to_string())?
        .clone();

    let summary_text = crate::claude_api::generate_summary(&api_key, &project)
        .await
        .map_err(|e| e.to_string())?;

    let summary = ServiceSummary::new(
        project.id.clone(),
        project.name.clone(),
        church_id,
        summary_text,
    );

    // Persist.
    {
        let mut summaries = state.summaries.write().map_err(|e| e.to_string())?;
        summaries.push(summary.clone());
        save_summaries(&summaries).map_err(|e| e.to_string())?;
    }

    Ok(summary)
}

/// List all persisted service summaries (newest first).
#[tauri::command]
pub fn list_service_summaries(state: State<'_, AppState>) -> Result<Vec<ServiceSummary>, String> {
    let mut summaries = state
        .summaries
        .read()
        .map_err(|e| e.to_string())?
        .clone();
    summaries.sort_by(|a, b| b.generated_at_ms.cmp(&a.generated_at_ms));
    Ok(summaries)
}

/// Delete a service summary by ID.
#[tauri::command]
pub fn delete_service_summary(
    summary_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut summaries = state.summaries.write().map_err(|e| e.to_string())?;
    summaries.retain(|s| s.id != summary_id);
    save_summaries(&summaries).map_err(|e| e.to_string())
}

/// Send the summary email for a given summary ID to all church subscribers.
/// Marks the summary as sent on success.
#[tauri::command]
pub async fn send_summary_email(
    summary_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let summary = {
        state
            .summaries
            .read()
            .map_err(|e| e.to_string())?
            .iter()
            .find(|s| s.id == summary_id)
            .cloned()
            .ok_or_else(|| format!("Summary not found: {summary_id}"))?
    };

    let subscribers = state
        .subscribers
        .read()
        .map_err(|e| e.to_string())?
        .clone();
    let settings = state
        .email_settings
        .read()
        .map_err(|e| e.to_string())?
        .clone();

    let sent = crate::email::send_summary_to_subscribers(&summary, &subscribers, &settings)
        .await
        .map_err(|e| e.to_string())?;

    // Mark as sent.
    {
        let mut summaries = state.summaries.write().map_err(|e| e.to_string())?;
        if let Some(s) = summaries.iter_mut().find(|s| s.id == summary_id) {
            s.email_sent = true;
            s.email_sent_at_ms = Some(crate::service::now_ms());
        }
        save_summaries(&summaries).map_err(|e| e.to_string())?;
    }

    Ok(sent)
}

/// List email subscribers for a specific church ID.
#[tauri::command]
pub fn list_email_subscribers(
    church_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<EmailSubscriber>, String> {
    Ok(state
        .subscribers
        .read()
        .map_err(|e| e.to_string())?
        .iter()
        .filter(|s| s.church_id == church_id)
        .cloned()
        .collect())
}

/// Add an email subscriber for a church.
#[tauri::command]
pub fn add_email_subscriber(
    church_id: String,
    email: String,
    name: Option<String>,
    state: State<'_, AppState>,
) -> Result<EmailSubscriber, String> {
    // Deduplicate by email + church.
    {
        let subscribers = state.subscribers.read().map_err(|e| e.to_string())?;
        if subscribers
            .iter()
            .any(|s| s.church_id == church_id && s.email == email)
        {
            return Err(format!("{email} is already subscribed"));
        }
    }

    let subscriber = EmailSubscriber::new(church_id, email, name);

    {
        let mut subscribers = state.subscribers.write().map_err(|e| e.to_string())?;
        subscribers.push(subscriber.clone());
        save_subscribers(&subscribers).map_err(|e| e.to_string())?;
    }

    Ok(subscriber)
}

/// Remove an email subscriber by ID.
#[tauri::command]
pub fn remove_email_subscriber(
    subscriber_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut subscribers = state.subscribers.write().map_err(|e| e.to_string())?;
    subscribers.retain(|s| s.id != subscriber_id);
    save_subscribers(&subscribers).map_err(|e| e.to_string())
}

/// Get the current email / SMTP settings.
#[tauri::command]
pub fn get_email_settings(state: State<'_, AppState>) -> Result<EmailSettings, String> {
    state
        .email_settings
        .read()
        .map(|s| s.clone())
        .map_err(|e| e.to_string())
}

/// Persist updated email / SMTP settings.
///
/// The SMTP password is stored in the OS keychain and never written to disk.
#[tauri::command]
pub fn set_email_settings(
    settings: EmailSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Only update the keychain when the caller supplies a non-empty password.
    // An empty string means "keep the existing keychain entry" (the frontend
    // receives no smtp_password field from get_email_settings and submits ""
    // when the user hasn't changed the field).
    if !settings.smtp_password.is_empty() {
        crate::keychain::set_smtp_password(&settings.smtp_password)
            .map_err(|e| format!("keychain error: {e}"))?;
    }
    let mut guard = state.email_settings.write().map_err(|e| e.to_string())?;
    *guard = settings.clone();
    save_email_settings(&settings).map_err(|e| e.to_string())
}

/// Retrieve the stored Anthropic API key (masked — returns "*****" if set, "" if not).
#[tauri::command]
pub fn get_anthropic_api_key_status(state: State<'_, AppState>) -> bool {
    state
        .anthropic_api_key
        .read()
        .map(|k| !k.is_empty())
        .unwrap_or(false)
}

/// Store the Anthropic API key in both the keychain and in-memory state.
#[tauri::command]
pub fn set_anthropic_api_key(
    key: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    crate::keychain::set_anthropic_api_key(&key).map_err(|e| e.to_string())?;
    let mut guard = state.anthropic_api_key.write().map_err(|e| e.to_string())?;
    *guard = key;
    Ok(())
}

/// Send a test email to verify SMTP configuration.
#[tauri::command]
pub async fn send_test_email(
    to_email: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = state
        .email_settings
        .read()
        .map_err(|e| e.to_string())?
        .clone();
    crate::email::send_test_email(&settings, &to_email)
        .await
        .map_err(|e| e.to_string())
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

/// Upload raw file bytes from the frontend.  Used when the native filesystem
/// path is not available (standard `<input type="file">` in the Tauri webview).
#[tauri::command]
pub fn write_artifact_bytes(
    service_id: Option<String>,
    parent_path: Option<String>,
    file_name: String,
    data: Vec<u8>,
    state: State<'_, AppState>,
) -> Result<ArtifactEntry, String> {
    let mut db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
    crate::artifacts::write_artifact_bytes(&mut db, service_id, parent_path, file_name, data)
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
pub fn read_text_file(
    id: String,
    max_bytes: Option<usize>,
    state: State<'_, AppState>,
) -> Result<(String, bool), String> {
    let db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
    let entry = db
        .get_by_id(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("artifact not found: {id}"))?;
    let abs = db.abs_path(&entry.path);
    let limit = max_bytes.unwrap_or(65536);
    let raw = std::fs::read(&abs).map_err(|e| e.to_string())?;
    let truncated = raw.len() > limit;
    let slice = if truncated { &raw[..limit] } else { &raw };
    let text = String::from_utf8_lossy(slice).into_owned();
    Ok((text, truncated))
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

/// Read an artifact's raw bytes. Used by the frontend preview panel to render
/// images, videos, etc. via blob URLs when the asset:// protocol is unavailable.
#[tauri::command]
pub fn read_artifact_bytes(
    id: String,
    state: State<'_, AppState>,
) -> Result<Vec<u8>, String> {
    let db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
    let entry = db.get_by_id(&id).map_err(|e| e.to_string())?
        .ok_or_else(|| format!("artifact not found: {id}"))?;
    let abs = db.abs_path(&entry.path);
    std::fs::read(&abs).map_err(|e| e.to_string())
}

// ── Phase 16: Cloud Sync ───────────────────────────────────────────────────────

use crate::cloud_sync::{AclEntry, AccessLevel, CloudSyncInfo, S3Config, SyncStatus};

/// Return the current S3 cloud config (without the secret key).
#[tauri::command]
pub fn get_cloud_config(state: State<'_, AppState>) -> Result<Option<S3Config>, String> {
    let cfg = state.cloud_config.read().map_err(|e| e.to_string())?;
    Ok(cfg.as_ref().map(|c| {
        let mut safe = c.clone();
        safe.secret_access_key = String::new();
        safe
    }))
}

/// Save S3 cloud configuration. The secret key is stored in the OS keychain;
/// all other fields are persisted to `~/.openworship/cloud_config.json`.
#[tauri::command]
pub fn set_cloud_config(config: S3Config, state: State<'_, AppState>) -> Result<(), String> {
    // Store secret in keychain.
    if !config.secret_access_key.is_empty() {
        crate::keychain::set_secret("s3_secret_access_key", &config.secret_access_key)
            .map_err(|e| format!("keychain write: {e}"))?;
    }
    crate::cloud_sync::save_config(&config).map_err(|e| e.to_string())?;
    let mut guard = state.cloud_config.write().map_err(|e| e.to_string())?;
    let mut stored = config.clone();
    // Restore secret from keychain for in-memory config.
    stored.secret_access_key =
        crate::keychain::get_secret("s3_secret_access_key").unwrap_or_default();
    *guard = Some(stored);
    Ok(())
}

/// Get the cloud sync state for a single artifact.
#[tauri::command]
pub fn get_cloud_sync_info(
    artifact_id: String,
    state: State<'_, AppState>,
) -> Result<Option<CloudSyncInfo>, String> {
    state
        .cloud_sync_db
        .lock()
        .map_err(|e| e.to_string())?
        .get_sync_info(&artifact_id)
        .map_err(|e| e.to_string())
}

/// Enable or disable cloud sync for a single artifact.
/// When enabled, the artifact is queued for upload.
#[tauri::command]
pub fn toggle_artifact_cloud_sync(
    artifact_id: String,
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<CloudSyncInfo, String> {
    let db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
    let existing = db.get_sync_info(&artifact_id).map_err(|e| e.to_string())?;
    let mut info = existing.unwrap_or_else(|| CloudSyncInfo {
        artifact_id: artifact_id.clone(),
        sync_enabled: false,
        status: SyncStatus::LocalOnly,
        cloud_key: None,
        last_etag: None,
        last_synced_ms: None,
        sync_error: None,
        progress: None,
    });
    info.sync_enabled = enabled;
    if enabled && matches!(info.status, SyncStatus::LocalOnly | SyncStatus::Error) {
        info.status = SyncStatus::Queued;
        // Derive cloud key from identity and artifact path.
        if info.cloud_key.is_none() {
            let af_db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
            if let Ok(Some(entry)) = af_db.get_by_id(&artifact_id) {
                let identity = state.identity.read().map_err(|e| e.to_string())?;
                if let Some(id) = identity.as_ref() {
                    info.cloud_key = Some(crate::cloud_sync::cloud_key_for(
                        &id.church_id, &id.branch_id, &entry.path,
                    ));
                }
            }
        }
    } else if !enabled {
        info.status = SyncStatus::LocalOnly;
    }
    db.upsert_sync_info(&info).map_err(|e| e.to_string())?;
    Ok(info)
}

/// Trigger an immediate sync for a specific artifact.
/// Returns the updated `CloudSyncInfo`. The upload happens asynchronously;
/// callers should poll `get_cloud_sync_info` or listen for Tauri events.
#[tauri::command]
pub async fn sync_artifact_now(
    artifact_id: String,
    state: State<'_, AppState>,
) -> Result<CloudSyncInfo, String> {
    let config = {
        let guard = state.cloud_config.read().map_err(|e| e.to_string())?;
        guard.clone().ok_or_else(|| "cloud not configured".to_string())?
    };
    let (info, local_path, mime) = {
        let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
        let af_db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
        let mut info = sync_db
            .get_sync_info(&artifact_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("no sync entry for {artifact_id}"))?;
        if !info.sync_enabled {
            return Err("sync not enabled for this artifact".into());
        }
        let entry = af_db
            .get_by_id(&artifact_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("artifact not found: {artifact_id}"))?;
        let abs = af_db.abs_path(&entry.path);
        info.status = SyncStatus::Syncing;
        sync_db.upsert_sync_info(&info).map_err(|e| e.to_string())?;
        (info, abs, entry.mime_type)
    };

    let cloud_key = info.cloud_key.clone().ok_or("no cloud key")?;
    let last_etag = info.last_etag.clone();
    let client = reqwest::Client::new();
    match crate::cloud_sync::upload_artifact(
        &client,
        &config,
        last_etag.as_deref(),
        &local_path,
        &cloud_key,
        mime.as_deref(),
    )
    .await
    {
        Ok(etag) => {
            let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;
            let mut updated = sync_db
                .get_sync_info(&artifact_id)
                .map_err(|e| e.to_string())?
                .unwrap_or_else(|| info.clone());
            updated.status = SyncStatus::Synced;
            updated.last_etag = Some(etag);
            updated.last_synced_ms = Some(now);
            updated.sync_error = None;
            sync_db.upsert_sync_info(&updated).map_err(|e| e.to_string())?;
            // Recalculate storage usage.
            let synced = sync_db.list_enabled().map_err(|e| e.to_string())?;
            let af_db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
            let used: i64 = synced
                .iter()
                .filter_map(|s| af_db.get_by_id(&s.artifact_id).ok().flatten())
                .filter_map(|e| e.size_bytes)
                .sum();
            sync_db
                .update_storage_usage(used, synced.len() as u32)
                .map_err(|e| e.to_string())?;
            Ok(updated)
        }
        Err(e) => {
            let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
            let mut updated = sync_db
                .get_sync_info(&artifact_id)
                .map_err(|err| err.to_string())?
                .unwrap_or_else(|| info.clone());
            updated.status = SyncStatus::Error;
            updated.sync_error = Some(e.to_string());
            sync_db.upsert_sync_info(&updated).map_err(|err| err.to_string())?;
            Err(e.to_string())
        }
    }
}

/// Sync all cloud-enabled artifacts in parallel. Returns a summary of how many
/// succeeded and how many failed. The frontend can call `list_cloud_artifacts`
/// or `get_cloud_sync_info` after this to get updated statuses.
#[tauri::command]
pub async fn sync_all_artifacts(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let config = {
        let guard = state.cloud_config.read().map_err(|e| e.to_string())?;
        guard.clone().ok_or_else(|| "cloud not configured".to_string())?
    };

    // Collect all sync-enabled entries up-front so we can release the locks.
    let entries: Vec<(CloudSyncInfo, std::path::PathBuf, Option<String>)> = {
        let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
        let af_db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
        sync_db
            .list_enabled()
            .map_err(|e| e.to_string())?
            .into_iter()
            .filter_map(|info| {
                let entry = af_db.get_by_id(&info.artifact_id).ok()??;
                let abs = af_db.abs_path(&entry.path);
                Some((info, abs, entry.mime_type))
            })
            .collect()
    };

    let total = entries.len();
    let mut succeeded: u32 = 0;
    let mut failed: u32 = 0;

    let client = reqwest::Client::new();
    for (mut info, local_path, mime) in entries {
        let artifact_id = info.artifact_id.clone();
        let cloud_key = match info.cloud_key.clone() {
            Some(k) => k,
            None => { failed += 1; continue; }
        };
        let last_etag = info.last_etag.clone();

        // Mark as syncing.
        {
            let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
            info.status = SyncStatus::Syncing;
            sync_db.upsert_sync_info(&info).map_err(|e| e.to_string())?;
        }

        match crate::cloud_sync::upload_artifact(
            &client,
            &config,
            last_etag.as_deref(),
            &local_path,
            &cloud_key,
            mime.as_deref(),
        )
        .await
        {
            Ok(etag) => {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64;
                let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
                let mut updated = sync_db
                    .get_sync_info(&artifact_id)
                    .map_err(|e| e.to_string())?
                    .unwrap_or_else(|| info.clone());
                updated.status = SyncStatus::Synced;
                updated.last_etag = Some(etag);
                updated.last_synced_ms = Some(now);
                updated.sync_error = None;
                sync_db.upsert_sync_info(&updated).map_err(|e| e.to_string())?;
                succeeded += 1;
            }
            Err(e) => {
                let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
                let mut updated = sync_db
                    .get_sync_info(&artifact_id)
                    .map_err(|err| err.to_string())?
                    .unwrap_or_else(|| info.clone());
                updated.status = SyncStatus::Error;
                updated.sync_error = Some(e.to_string());
                sync_db.upsert_sync_info(&updated).map_err(|err| err.to_string())?;
                failed += 1;
            }
        }
    }

    // Recalculate aggregate storage usage.
    {
        let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
        let af_db = state.artifacts_db.lock().map_err(|e| e.to_string())?;
        let synced = sync_db.list_enabled().map_err(|e| e.to_string())?;
        let used: i64 = synced
            .iter()
            .filter_map(|s| af_db.get_by_id(&s.artifact_id).ok().flatten())
            .filter_map(|e| e.size_bytes)
            .sum();
        sync_db
            .update_storage_usage(used, synced.len() as u32)
            .map_err(|e| e.to_string())?;
    }

    Ok(serde_json::json!({ "total": total, "succeeded": succeeded, "failed": failed }))
}

/// List cloud-synced artifacts in the given section ("branch" or "shared").
#[tauri::command]
pub fn list_cloud_artifacts(
    section: String,
    state: State<'_, AppState>,
) -> Result<Vec<CloudSyncInfo>, String> {
    let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
    let all = sync_db.list_enabled().map_err(|e| e.to_string())?;
    let identity = state.identity.read().map_err(|e| e.to_string())?;
    let (church_id, branch_id) = match identity.as_ref() {
        Some(id) => (id.church_id.clone(), id.branch_id.clone()),
        None => return Ok(vec![]),
    };
    let prefix = if section == "shared" {
        format!("{church_id}/shared/")
    } else {
        format!("{church_id}/{branch_id}/")
    };
    let filtered = all
        .into_iter()
        .filter(|s| {
            s.cloud_key
                .as_deref()
                .map(|k| k.starts_with(&prefix))
                .unwrap_or(false)
        })
        .collect();
    Ok(filtered)
}

/// Get the ACL + access level for an artifact.
#[tauri::command]
pub fn get_artifact_acl(
    artifact_id: String,
    state: State<'_, AppState>,
) -> Result<(Vec<AclEntry>, AccessLevel), String> {
    let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
    let acl = sync_db.get_acl(&artifact_id).map_err(|e| e.to_string())?;
    let level = sync_db
        .get_access_level(&artifact_id)
        .map_err(|e| e.to_string())?;
    Ok((acl, level))
}

/// Set the ACL and access level for an artifact.
#[tauri::command]
pub fn set_artifact_acl(
    artifact_id: String,
    acl: Vec<AclEntry>,
    access_level: AccessLevel,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
    sync_db.set_acl(&artifact_id, &acl).map_err(|e| e.to_string())?;
    sync_db
        .set_access_level(&artifact_id, &access_level)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Generate a shareable link for a cloud-synced artifact.
/// Returns `None` if the artifact is not synced or cloud is not configured.
#[tauri::command]
pub fn copy_artifact_link(
    artifact_id: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let config = {
        let guard = state.cloud_config.read().map_err(|e| e.to_string())?;
        guard.clone()
    };
    let config = match config {
        Some(c) => c,
        None => return Ok(None),
    };
    let sync_db = state.cloud_sync_db.lock().map_err(|e| e.to_string())?;
    let info = sync_db
        .get_sync_info(&artifact_id)
        .map_err(|e| e.to_string())?;
    match info.and_then(|i| i.cloud_key) {
        Some(key) => Ok(Some(crate::cloud_sync::share_link_for(&config, &key))),
        None => Ok(None),
    }
}

/// Return current cloud storage usage for this branch.
#[tauri::command]
pub fn get_storage_usage(state: State<'_, AppState>) -> Result<crate::cloud_sync::StorageUsage, String> {
    state
        .cloud_sync_db
        .lock()
        .map_err(|e| e.to_string())?
        .get_storage_usage()
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::content_event_for_item;
    use ow_core::{QueueItem, content_kind};

    #[test]
    fn content_event_scripture_kind() {
        let item = QueueItem::new("John 3:16".into(), "For God so loved".into(), "KJV".into());
        let ev = content_event_for_item(&item);
        assert_eq!(ev.kind, "scripture");
        assert_eq!(ev.reference, "John 3:16");
    }

    #[test]
    fn content_event_song_kind() {
        let item = QueueItem::new_song(
            "Amazing Grace".into(),
            "Amazing grace how sweet".into(),
            "Hymn".into(),
            1,
        );
        let ev = content_event_for_item(&item);
        assert_eq!(ev.kind, "song");
        assert_eq!(ev.reference, "Amazing Grace");
    }

    #[test]
    fn content_event_announcement_kind() {
        let item = QueueItem::new_announcement(
            "Church Picnic".into(),
            "This Sunday at 2pm".into(),
            None,
        );
        let ev = content_event_for_item(&item);
        assert_eq!(ev.kind, "announcement");
    }

    #[test]
    fn content_event_countdown_kind() {
        let item = QueueItem::new_countdown("Offering".into(), 300);
        let ev = content_event_for_item(&item);
        assert_eq!(ev.kind, "countdown");
        assert_eq!(ev.duration_secs, Some(300));
    }

    #[test]
    fn content_event_unknown_kind_falls_back_to_scripture() {
        let mut item = QueueItem::new("Ref".into(), "Text".into(), "T".into());
        item.kind = "unknown_future_kind".into();
        let ev = content_event_for_item(&item);
        assert_eq!(ev.kind, "scripture");
    }
}
