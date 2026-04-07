use crate::state::AppState;
use ow_display::ContentEvent;
use ow_search::VerseResult;
use tauri::State;

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

/// Legacy greeting command kept for compatibility.
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to OpenWorship.", name)
}
