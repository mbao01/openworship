mod commands;
mod detection;
mod identity;
mod keychain;
mod service;
mod settings;
mod songs;
mod state;

use ow_audio::SttEngine;
use ow_core::{DetectionMode, QueueItem, SongRef};
use ow_embed::{OllamaClient, SemanticIndex};
use settings::AudioSettings;
use songs::SongsDb;
use state::AppState;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::broadcast;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ── Scripture DB + search index ────────────────────────────────────────────
    let db = ow_db::open_and_seed().expect("Failed to open Bible DB");
    let verses = ow_db::get_all_verses(&db).expect("Failed to load verses");
    let search =
        Arc::new(ow_search::SearchEngine::build(&verses).expect("Failed to build search index"));

    // ── Display server channel ─────────────────────────────────────────────────
    let (display_tx, _) = broadcast::channel::<ow_display::ContentEvent>(32);
    let tx_for_server = display_tx.clone();
    let tx_for_detect = display_tx.clone();

    // ── STT engine ────────────────────────────────────────────────────────────
    let (stt_engine, detect_rx) = SttEngine::new();

    let detection_mode = Arc::new(RwLock::new(DetectionMode::default()));
    let queue = Arc::new(Mutex::new(VecDeque::<QueueItem>::new()));
    let audio_settings = Arc::new(RwLock::new(AudioSettings::load()));

    // ── Church identity ───────────────────────────────────────────────────────
    let identity_value = identity::ChurchIdentity::load()
        .unwrap_or_else(|e| {
            eprintln!("[identity] failed to load: {e}; showing onboarding");
            None
        });
    let identity = Arc::new(RwLock::new(identity_value));

    // ── Service projects + content bank ───────────────────────────────────────
    let projects = Arc::new(RwLock::new(service::load_projects()));
    let content_bank = Arc::new(RwLock::new(service::load_content_bank()));
    let active_project_id = {
        let plist = projects.read().unwrap();
        let active = plist
            .iter()
            .filter(|p| p.is_open())
            .max_by_key(|p| p.created_at_ms)
            .map(|p| p.id.clone());
        Arc::new(RwLock::new(active))
    };

    // ── Semantic scripture index (Phase 9) ────────────────────────────────────
    let semantic_index: Arc<RwLock<Option<SemanticIndex>>> = Arc::new(RwLock::new(None));
    let ollama = Arc::new(OllamaClient::new());

    let verse_results: Vec<ow_search::VerseResult> = verses
        .iter()
        .map(|v| ow_search::VerseResult {
            translation: v.translation.clone(),
            book: v.book.clone(),
            chapter: v.chapter,
            verse: v.verse,
            text: v.text.clone(),
            reference: v.reference.clone(),
            score: 1.0,
        })
        .collect();

    // ── Song library ──────────────────────────────────────────────────────────
    let songs_db = match SongsDb::open() {
        Ok(db) => Arc::new(Mutex::new(db)),
        Err(e) => {
            eprintln!("[songs] failed to open songs DB: {e}; using in-memory fallback");
            // Fallback: open an in-memory DB so the app still starts.
            Arc::new(Mutex::new(
                SongsDb::open_in_memory().expect("failed to open in-memory songs DB"),
            ))
        }
    };

    let song_refs: Vec<SongRef> = songs_db
        .lock()
        .unwrap()
        .all_refs()
        .unwrap_or_default();
    let song_refs = Arc::new(RwLock::new(song_refs));
    let song_semantic_index: Arc<RwLock<Option<songs::SongSemanticIndex>>> =
        Arc::new(RwLock::new(None));

    // Restore preferred translation from session memory (falls back to KJV).
    let initial_translation = service::load_session_memory()
        .preferred_translation
        .unwrap_or_else(|| "KJV".to_string());
    let active_translation = Arc::new(RwLock::new(initial_translation));

    // ── Clone Arcs for detection loop ─────────────────────────────────────────
    let detect_search = Arc::clone(&search);
    let detect_mode = Arc::clone(&detection_mode);
    let detect_queue = Arc::clone(&queue);
    let detect_settings = Arc::clone(&audio_settings);
    let detect_semantic = Arc::clone(&semantic_index);
    let detect_ollama = Arc::clone(&ollama);
    let detect_song_semantic = Arc::clone(&song_semantic_index);
    let detect_song_refs = Arc::clone(&song_refs);
    let detect_translation = Arc::clone(&active_translation);

    // ── Clone Arcs for background embedding tasks ─────────────────────────────
    let embed_index = Arc::clone(&semantic_index);
    let embed_ollama = Arc::clone(&ollama);
    let embed_settings = Arc::clone(&audio_settings);
    let song_embed_db = Arc::clone(&songs_db);
    let song_embed_index = Arc::clone(&song_semantic_index);
    let song_embed_ollama = Arc::clone(&ollama);

    let app_state = AppState {
        search,
        display_tx,
        stt: Mutex::new(stt_engine),
        detection_mode,
        queue,
        audio_settings,
        identity,
        projects,
        active_project_id,
        content_bank,
        semantic_index,
        ollama,
        songs_db,
        song_semantic_index,
        song_refs,
        active_translation,
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Start the WebSocket display server.
            tauri::async_runtime::spawn(ow_display::start_server(tx_for_server));

            // Start the detection loop (scripture + song).
            tauri::async_runtime::spawn(detection::run_loop(
                detect_rx,
                detect_search,
                detect_queue,
                detect_mode,
                detect_settings,
                detect_semantic,
                detect_ollama,
                detect_song_semantic,
                detect_song_refs,
                tx_for_detect,
                app_handle,
                detect_translation,
            ));

            // Background: embed all scripture verses.
            tauri::async_runtime::spawn(async move {
                let enabled = embed_settings
                    .read()
                    .map(|s| s.semantic_enabled)
                    .unwrap_or(true);
                if !enabled {
                    eprintln!("[embed] semantic search disabled by settings");
                    return;
                }
                if !embed_ollama.is_available().await {
                    eprintln!("[embed] Ollama not available — semantic search disabled");
                    return;
                }
                match ow_embed::build_index(&embed_ollama, &verse_results).await {
                    Ok(index) => {
                        let count = index.len();
                        if let Ok(mut guard) = embed_index.write() {
                            *guard = Some(index);
                        }
                        eprintln!("[embed] semantic index ready ({count} verses)");
                    }
                    Err(e) => eprintln!("[embed] failed to build semantic index: {e}"),
                }
            });

            // Background: embed song lyrics for semantic song detection.
            tauri::async_runtime::spawn(async move {
                if !song_embed_ollama.is_available().await {
                    return;
                }
                let all_songs = {
                    match song_embed_db.lock() {
                        Ok(db) => db.list_songs().unwrap_or_default(),
                        Err(_) => return,
                    }
                };
                if all_songs.is_empty() {
                    return;
                }
                match songs::build_song_semantic_index(&song_embed_ollama, &all_songs).await {
                    Ok(index) => {
                        let count = index.len();
                        if let Ok(mut guard) = song_embed_index.write() {
                            *guard = Some(index);
                        }
                        eprintln!("[song-embed] song semantic index ready ({count} entries)");
                    }
                    Err(e) => eprintln!("[song-embed] failed: {e}"),
                }
            });

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
            commands::create_service_project,
            commands::list_service_projects,
            commands::get_active_project,
            commands::open_service_project,
            commands::close_active_project,
            commands::add_item_to_active_project,
            commands::remove_item_from_active_project,
            commands::reorder_active_project_items,
            commands::search_content_bank,
            commands::get_semantic_status,
            commands::search_semantic,
            // ── Song library commands ──────────────────────────────────────
            commands::list_songs,
            commands::search_songs,
            commands::get_song,
            commands::add_song,
            commands::update_song,
            commands::delete_song,
            commands::import_songs_ccli,
            commands::import_songs_openlp,
            commands::push_song_to_display,
            commands::get_song_semantic_status,
            commands::get_active_translation,
            commands::switch_live_translation,
            commands::reject_live_item,
            identity::get_identity,
            identity::create_church,
            identity::join_church,
            identity::generate_invite_code,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
