mod commands;
mod state;

use ow_audio::SttEngine;
use state::AppState;
use std::sync::Mutex;
use tokio::sync::broadcast;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Build DB + search index synchronously before the event loop starts.
    let db = ow_db::open_and_seed().expect("Failed to open Bible DB");
    let verses = ow_db::get_all_verses(&db).expect("Failed to load verses");
    let search = ow_search::SearchEngine::build(&verses).expect("Failed to build search index");

    let (display_tx, _) = broadcast::channel::<ow_display::ContentEvent>(32);
    let tx_for_server = display_tx.clone();

    let (stt_engine, _) = SttEngine::new();
    let app_state = AppState {
        search,
        display_tx,
        stt: Mutex::new(stt_engine),
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .setup(move |_app| {
            tauri::async_runtime::spawn(ow_display::start_server(tx_for_server));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::search_scriptures,
            commands::push_to_display,
            commands::list_translations,
            commands::start_stt,
            commands::stop_stt,
            commands::get_stt_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
