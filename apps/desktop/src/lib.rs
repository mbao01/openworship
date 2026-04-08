mod commands;
mod detection;
mod identity;
mod settings;
mod state;

use ow_audio::SttEngine;
use ow_core::{DetectionMode, QueueItem};
use settings::AudioSettings;
use state::AppState;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::broadcast;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Build DB + search index synchronously before the event loop starts.
    let db = ow_db::open_and_seed().expect("Failed to open Bible DB");
    let verses = ow_db::get_all_verses(&db).expect("Failed to load verses");
    let search =
        Arc::new(ow_search::SearchEngine::build(&verses).expect("Failed to build search index"));

    let (display_tx, _) = broadcast::channel::<ow_display::ContentEvent>(32);
    let tx_for_server = display_tx.clone();
    let tx_for_detect = display_tx.clone();

    // SttEngine::new() returns (engine, initial_receiver).
    // The initial receiver feeds the detection loop immediately.
    let (stt_engine, detect_rx) = SttEngine::new();

    let detection_mode = Arc::new(RwLock::new(DetectionMode::default()));
    let queue = Arc::new(Mutex::new(VecDeque::<QueueItem>::new()));
    let audio_settings = Arc::new(RwLock::new(AudioSettings::load()));

    // Load church identity (None → show onboarding).
    let identity_value = identity::ChurchIdentity::load()
        .unwrap_or_else(|e| {
            eprintln!("[identity] failed to load: {e}; showing onboarding");
            None
        });
    let identity = Arc::new(RwLock::new(identity_value));

    // Clone Arcs for the detection loop before moving into AppState.
    let detect_search = Arc::clone(&search);
    let detect_mode = Arc::clone(&detection_mode);
    let detect_queue = Arc::clone(&queue);

    let app_state = AppState {
        search,
        display_tx,
        stt: Mutex::new(stt_engine),
        detection_mode,
        queue,
        audio_settings,
        identity,
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            // Start the WebSocket display server.
            tauri::async_runtime::spawn(ow_display::start_server(tx_for_server));
            // Start the scripture detection loop.
            tauri::async_runtime::spawn(detection::run_loop(
                detect_rx,
                detect_search,
                detect_queue,
                detect_mode,
                tx_for_detect,
                app_handle,
            ));
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
            commands::detect_in_transcript,
            commands::set_detection_mode,
            commands::get_detection_mode,
            commands::get_queue,
            commands::approve_item,
            commands::dismiss_item,
            commands::clear_queue,
            commands::get_audio_settings,
            commands::set_audio_settings,
            identity::get_identity,
            identity::create_church,
            identity::join_church,
            identity::generate_invite_code,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
