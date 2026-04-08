use crate::state::AppState;
use ow_audio::{AudioConfig, MockTranscriber, SttStatus};
use ow_detect::pipeline::approve_and_display;
use ow_detect::queue::{OperatingMode, QueuedVerse};
use ow_display::ContentEvent;
use ow_search::VerseResult;
use tauri::{AppHandle, Emitter, State};

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

/// Start the STT engine using the best available transcriber.
#[tauri::command]
pub fn start_stt(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let config = AudioConfig::default();
    let mut engine = state.stt.lock().map_err(|e| e.to_string())?;

    #[cfg(feature = "whisper")]
    {
        use ow_audio::WhisperTranscriber;
        match WhisperTranscriber::from_env() {
            Ok(t) => engine.start(t, config).map_err(|e| e.to_string())?,
            Err(_) => engine
                .start(MockTranscriber::new(), config)
                .map_err(|e| e.to_string())?,
        }
    }
    #[cfg(not(feature = "whisper"))]
    engine
        .start(MockTranscriber::new(), config)
        .map_err(|e| e.to_string())?;

    // Forward transcript events as Tauri events.
    let tx = engine.sender();
    let mut rx = tx.subscribe();
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(evt) => {
                    let _ = app2.emit("stt://transcript", &evt);
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
            }
        }
    });

    Ok(())
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

// ── Detection pipeline commands ──────────────────────────────────────────────

/// Return all verses currently in the detection queue.
#[tauri::command]
pub fn get_queue(state: State<'_, AppState>) -> Vec<QueuedVerse> {
    state.pipeline.queue.lock().unwrap().snapshot()
}

/// Approve a queued verse and push it to the display.
#[tauri::command]
pub fn approve_verse(id: u64, state: State<'_, AppState>) -> bool {
    approve_and_display(id, &state.pipeline.queue, &state.display_tx)
}

/// Dismiss a queued verse (it will not be shown).
#[tauri::command]
pub fn dismiss_verse(id: u64, state: State<'_, AppState>) -> bool {
    state.pipeline.queue.lock().unwrap().dismiss(id)
}

/// Clear all verses from the detection queue.
#[tauri::command]
pub fn clear_queue(state: State<'_, AppState>) {
    state.pipeline.queue.lock().unwrap().clear();
}

/// Return the current operating mode.
#[tauri::command]
pub fn get_mode(state: State<'_, AppState>) -> OperatingMode {
    *state.pipeline.mode.lock().unwrap()
}

/// Set the operating mode.
#[tauri::command]
pub fn set_mode(mode: OperatingMode, state: State<'_, AppState>) {
    *state.pipeline.mode.lock().unwrap() = mode;
}
