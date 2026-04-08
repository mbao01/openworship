mod commands;
mod state;

use ow_audio::SttEngine;
use ow_detect::pipeline::DetectionPipeline;
use state::AppState;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Build DB + search index synchronously before the event loop starts.
    let db = ow_db::open_and_seed().expect("Failed to open Bible DB");
    let verses = ow_db::get_all_verses(&db).expect("Failed to load verses");
    let search = Arc::new(
        ow_search::SearchEngine::build(&verses).expect("Failed to build search index"),
    );

    let (display_tx, _) = broadcast::channel::<ow_display::ContentEvent>(32);
    let tx_for_server = display_tx.clone();

    let (stt_engine, stt_broadcast_rx) = SttEngine::new();

    // Build the detection pipeline — subscribes to the STT broadcast channel.
    let pipeline = DetectionPipeline::new(
        stt_broadcast_rx,
        Arc::clone(&search),
        display_tx.clone(),
    );

    let app_state = AppState {
        search,
        display_tx,
        stt: Mutex::new(stt_engine),
        pipeline,
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
            commands::get_queue,
            commands::approve_verse,
            commands::dismiss_verse,
            commands::clear_queue,
            commands::get_mode,
            commands::set_mode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
