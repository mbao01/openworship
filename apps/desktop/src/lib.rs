mod artifacts;
mod backgrounds;
mod branch_sync;
mod claude_api;
mod cloud_sync;
mod commands;
mod detection;
mod display_window;
mod email;
mod identity;
mod keychain;
mod service;
mod settings;
mod slides;
mod songs;
mod state;
mod summaries;

use ow_audio::SttEngine;
use ow_core::{QueueItem, SongRef};
use ow_embed::SemanticIndex;
use tauri::Manager;
use settings::{AudioSettings, DisplaySettings};
use songs::SongsDb;
use state::AppState;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::broadcast;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(e) = try_run() {
        eprintln!("[fatal] application failed to start: {e}");
        std::process::exit(1);
    }
}

fn try_run() -> Result<(), Box<dyn std::error::Error>> {
    // Prefetch display names in background (system_profiler is slow ~3s)
    display_window::prefetch_display_names();

    // ── Scripture DB + search index ────────────────────────────────────────────
    let db = ow_db::open_and_seed().map_err(|e| { eprintln!("[startup] Bible DB: {e}"); e })?;
    let verses = ow_db::get_all_verses(&db)?;
    let search =
        Arc::new(ow_search::SearchEngine::build(&verses)?);

    // ── Display server channel ─────────────────────────────────────────────────
    let (display_tx, _) = broadcast::channel::<ow_display::ContentEvent>(32);
    let tx_for_server = display_tx.clone();
    let tx_for_detect = display_tx.clone();

    // ── STT engine ────────────────────────────────────────────────────────────
    let (stt_engine, detect_rx) = SttEngine::new();

    let queue = Arc::new(Mutex::new(VecDeque::<QueueItem>::new()));
    let audio_settings = Arc::new(RwLock::new(AudioSettings::load()));
    // Load persisted detection mode from settings (defaults to Copilot)
    let detection_mode = Arc::new(RwLock::new(
        audio_settings.read().map(|s| s.detection_mode).unwrap_or_default()
    ));
    let display_settings = Arc::new(RwLock::new(DisplaySettings::load()));

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
        let plist = projects.read().unwrap_or_else(|e| e.into_inner());
        let active = plist
            .iter()
            .filter(|p| p.is_open())
            .max_by_key(|p| p.created_at_ms)
            .map(|p| p.id.clone());
        Arc::new(RwLock::new(active))
    };

    // ── Semantic scripture index (Phase 9) ────────────────────────────────────
    let semantic_index: Arc<RwLock<Option<SemanticIndex>>> = Arc::new(RwLock::new(None));
    // Only initialise the heavy ONNX model when semantic search is actually
    // enabled.  Loading it unconditionally was the primary cause of the 800%
    // CPU / 16 GB memory spike (ONNX Runtime allocates a full thread-pool and
    // keeps model weights resident for the lifetime of the process).
    let semantic_enabled_at_startup = audio_settings
        .read()
        .map(|s| s.semantic_enabled)
        .unwrap_or(true);
    let embedder: Arc<dyn ow_embed::Embedder> = if semantic_enabled_at_startup {
        match ow_embed::LocalEmbedder::new() {
            Ok(e) => Arc::new(e),
            Err(e) => {
                eprintln!("[embed] failed to initialize embedding model: {e}; falling back to NullEmbedder");
                Arc::new(ow_embed::NullEmbedder)
            }
        }
    } else {
        eprintln!("[embed] semantic search disabled — skipping ONNX model init");
        Arc::new(ow_embed::NullEmbedder)
    };

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
                SongsDb::open_in_memory()?,
            ))
        }
    };

    let song_refs: Vec<SongRef> = songs_db
        .lock()
        .unwrap_or_else(|e| e.into_inner())
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

    // ── Announcements + sermon notes ──────────────────────────────────────────
    let announcements = Arc::new(RwLock::new(slides::load_announcements()));
    let sermon_notes = Arc::new(RwLock::new(slides::load_sermon_notes()));
    let active_sermon_note: Arc<RwLock<Option<(String, u32)>>> = Arc::new(RwLock::new(None));

    // ── Artifacts DB (Phase 15) ────────────────────────────────────────────────
    let artifacts_db = match artifacts::ArtifactsDb::open() {
        Ok(db) => Arc::new(Mutex::new(db)),
        Err(e) => {
            eprintln!("[artifacts] failed to open db: {e}; using in-memory fallback");
            Arc::new(Mutex::new(
                artifacts::ArtifactsDb::open_in_memory()?,
            ))
        }
    };

    // ── Cloud sync DB + config (Phase 16) ─────────────────────────────────────
    let cloud_sync_db = match cloud_sync::CloudSyncDb::open() {
        Ok(db) => Arc::new(Mutex::new(db)),
        Err(e) => {
            eprintln!("[cloud_sync] failed to open db: {e}; using in-memory fallback");
            Arc::new(Mutex::new(
                cloud_sync::CloudSyncDb::open_in_memory()?,
            ))
        }
    };
    let cloud_config = Arc::new(RwLock::new({
        let mut cfg = cloud_sync::load_config();
        // Restore secret from keychain so sync works immediately on startup.
        if let Some(ref mut c) = cfg {
            c.secret_access_key =
                keychain::get_secret("s3_secret_access_key").unwrap_or_default();
        }
        cfg
    }));
    // ── Phase 14: Summaries + email subscriptions ─────────────────────────────
    let summaries = Arc::new(RwLock::new(summaries::load_summaries()));
    let subscribers = Arc::new(RwLock::new(summaries::load_subscribers()));
    let email_settings = Arc::new(RwLock::new(summaries::load_email_settings()));
    // Load Anthropic API key from keychain (silently empty if not set yet).
    let anthropic_api_key = Arc::new(RwLock::new(
        keychain::get_anthropic_api_key().unwrap_or_default(),
    ));

    // ── Clone Arcs for detection loop ─────────────────────────────────────────
    let detect_search = Arc::clone(&search);
    let detect_mode = Arc::clone(&detection_mode);
    let detect_queue = Arc::clone(&queue);
    let detect_settings = Arc::clone(&audio_settings);
    let detect_semantic = Arc::clone(&semantic_index);
    let detect_embedder = Arc::clone(&embedder);
    let detect_song_semantic = Arc::clone(&song_semantic_index);
    let detect_song_refs = Arc::clone(&song_refs);
    let detect_translation = Arc::clone(&active_translation);
    let detect_announcements = Arc::clone(&announcements);

    // ── Clone Arcs for background embedding tasks ─────────────────────────────
    let embed_index = Arc::clone(&semantic_index);
    let embed_embedder = Arc::clone(&embedder);
    let embed_settings = Arc::clone(&audio_settings);
    let embed_translation = Arc::clone(&active_translation);
    let song_embed_db = Arc::clone(&songs_db);
    let song_embed_index = Arc::clone(&song_semantic_index);
    let song_embed_embedder = Arc::clone(&embedder);

    let app_state = AppState {
        search,
        display_tx,
        stt: Mutex::new(stt_engine),
        provider_registry: ow_audio::ProviderRegistry::new(),
        audio_monitor: ow_audio::AudioMonitor::new(),
        detection_mode,
        queue,
        audio_settings,
        display_settings,
        identity,
        projects,
        active_project_id,
        content_bank,
        semantic_index,
        embedder,
        songs_db,
        song_semantic_index,
        song_refs,
        active_translation,
        announcements,
        sermon_notes,
        active_sermon_note,
        artifacts_db,
        cloud_sync_db,
        cloud_config,
        summaries,
        subscribers,
        email_settings,
        anthropic_api_key,
        blackout: Arc::new(RwLock::new(false)),
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
                detect_embedder,
                detect_song_semantic,
                detect_song_refs,
                tx_for_detect,
                app_handle,
                detect_translation,
                detect_announcements,
            ));

            // Resolve the pre-built index path for the active translation.
            // Indices are named scripture_index_<TRANSLATION>.bin (e.g. scripture_index_KJV.bin).
            let active_translation_code = embed_translation
                .read()
                .map(|t| t.clone())
                .unwrap_or_else(|_| "KJV".to_string());
            let index_filename = format!("scripture_index_{active_translation_code}.bin");

            // In dev mode, check the source tree first (apps/desktop/resources/).
            // In packaged builds, check the bundled resource directory.
            let bundled_index_path = {
                // Dev: relative to the crate's Cargo.toml directory
                let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("resources")
                    .join(&index_filename);
                if dev_path.exists() {
                    eprintln!("[embed] found dev index at {}", dev_path.display());
                    Some(dev_path)
                } else {
                    // Packaged: bundled resource directory
                    app.path()
                        .resource_dir()
                        .ok()
                        .map(|dir: std::path::PathBuf| dir.join("resources").join(&index_filename))
                }
            };

            // Background: load bundled embedding index or build on-device.
            tauri::async_runtime::spawn(async move {
                let enabled = embed_settings
                    .read()
                    .map(|s| s.semantic_enabled)
                    .unwrap_or(true);
                if !enabled {
                    eprintln!("[embed] semantic search disabled by settings");
                    return;
                }

                // Try loading the pre-built index bundled with the app.
                if let Some(path) = bundled_index_path {
                    let load_result = tokio::task::spawn_blocking(move || {
                        ow_embed::SemanticIndex::load(&path)
                    })
                    .await;
                    if let Ok(Ok(index)) = load_result {
                        let count = index.len();
                        if let Ok(mut guard) = embed_index.write() {
                            *guard = Some(index);
                        }
                        eprintln!("[embed] loaded bundled pre-built index ({count} verses)");
                        return;
                    }
                    eprintln!("[embed] bundled index not available, building on-device…");
                }

                // Fall back to on-device build in dev mode only.
                // In release builds, skip the expensive 30-60 min embedding process.
                #[cfg(debug_assertions)]
                {
                    eprintln!("[embed] dev mode: building index on-device (this may take a while)…");
                    let result = tokio::task::spawn_blocking(move || {
                        ow_embed::build_index(&*embed_embedder, &verse_results)
                    })
                    .await;
                    match result {
                        Ok(Ok(index)) => {
                            let count = index.len();
                            if let Ok(mut guard) = embed_index.write() {
                                *guard = Some(index);
                            }
                            eprintln!("[embed] semantic index ready ({count} verses)");
                        }
                        Ok(Err(e)) => eprintln!("[embed] failed to build semantic index: {e}"),
                        Err(e) => eprintln!("[embed] embedding task panicked: {e}"),
                    }
                }
                #[cfg(not(debug_assertions))]
                {
                    eprintln!(
                        "[embed] No bundled index found. Semantic search unavailable.\n\
                         Run `./scripts/build-embedding-index.sh` before packaging."
                    );
                }
            });

            // Background: embed song lyrics for semantic song detection.
            tauri::async_runtime::spawn(async move {
                let all_songs = {
                    match song_embed_db.lock() {
                        Ok(db) => db.list_songs().unwrap_or_default(),
                        Err(_) => return,
                    }
                };
                if all_songs.is_empty() {
                    return;
                }
                let result = tokio::task::spawn_blocking(move || {
                    songs::build_song_semantic_index(&*song_embed_embedder, &all_songs)
                })
                .await;
                match result {
                    Ok(Ok(index)) => {
                        let count = index.len();
                        if let Ok(mut guard) = song_embed_index.write() {
                            *guard = Some(index);
                        }
                        eprintln!("[song-embed] song semantic index ready ({count} entries)");
                    }
                    Ok(Err(e)) => eprintln!("[song-embed] failed: {e}"),
                    Err(e) => eprintln!("[song-embed] embedding task panicked: {e}"),
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
            commands::skip_item,
            commands::next_item,
            commands::prev_item,
            commands::clear_live,
            commands::toggle_blackout,
            commands::get_blackout,
            commands::get_audio_settings,
            commands::set_audio_settings,
            commands::check_whisper_model,
            commands::download_whisper_model,
            commands::list_stt_providers,
            commands::get_provider_status,
            commands::check_provider_model,
            commands::get_provider_models,
            commands::download_provider_model,
            commands::set_provider_secret,
            commands::list_audio_input_devices,
            commands::get_audio_level,
            commands::start_audio_monitor,
            commands::stop_audio_monitor,
            commands::delete_service_project,
            commands::update_service_project,
            commands::create_service_project,
            commands::list_service_projects,
            commands::get_active_project,
            commands::open_service_project,
            commands::close_active_project,
            commands::add_item_to_active_project,
            commands::remove_item_from_active_project,
            commands::reorder_active_project_items,
            commands::search_content_bank,
            commands::update_project_item,
            commands::create_service_task,
            commands::update_service_task,
            commands::delete_service_task,
            commands::link_asset_to_item,
            commands::unlink_asset_from_item,
            commands::upload_and_link_asset,
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
            // ── Announcements + custom slides ──────────────────────────────
            commands::list_announcements,
            commands::create_announcement,
            commands::update_announcement,
            commands::delete_announcement,
            commands::push_announcement_to_display,
            commands::push_custom_slide,
            commands::push_artifact_to_display,
            commands::set_display_background,
            commands::get_display_background,
            commands::list_preset_backgrounds,
            commands::list_uploaded_backgrounds,
            commands::upload_background,
            // ── Countdown timers ───────────────────────────────────────────
            commands::start_countdown,
            // ── Sermon notes ───────────────────────────────────────────────
            commands::list_sermon_notes,
            commands::create_sermon_note,
            commands::update_sermon_note,
            commands::delete_sermon_note,
            commands::push_sermon_note,
            commands::advance_sermon_note,
            commands::rewind_sermon_note,
            commands::get_active_sermon_note,
            // ── Phase 16: Cloud Sync ───────────────────────────────────────
            commands::get_cloud_config,
            commands::set_cloud_config,
            commands::get_cloud_sync_info,
            commands::toggle_artifact_cloud_sync,
            commands::sync_artifact_now,
            commands::download_artifact_from_cloud,
            commands::sync_all_artifacts,
            commands::list_cloud_artifacts,
            commands::get_artifact_acl,
            commands::set_artifact_acl,
            commands::copy_artifact_link,
            commands::get_storage_usage,
            // ── Phase 15: Artifacts ────────────────────────────────────────
            commands::list_artifacts,
            commands::list_recent_artifacts,
            commands::list_starred_artifacts,
            commands::search_artifacts,
            commands::create_artifact_dir,
            commands::import_artifact_file,
            commands::write_artifact_bytes,
            commands::rename_artifact,
            commands::delete_artifact,
            commands::move_artifact,
            commands::star_artifact,
            commands::get_artifacts_settings,
            commands::set_artifacts_base_path,
            commands::read_text_file,
            commands::open_artifact,
            commands::read_artifact_bytes,
            commands::read_thumbnail,
            // ── Phase 14: Summaries + email ────────────────────────────────
            commands::generate_service_summary,
            commands::list_service_summaries,
            commands::delete_service_summary,
            commands::send_summary_email,
            commands::list_email_subscribers,
            commands::add_email_subscriber,
            commands::remove_email_subscriber,
            commands::get_email_settings,
            commands::set_email_settings,
            commands::get_anthropic_api_key_status,
            commands::set_anthropic_api_key,
            commands::send_test_email,
            identity::get_identity,
            identity::create_church,
            identity::join_church,
            identity::generate_invite_code,
            // ── Branch sync (OPE-64) ───────────────────────────────────────
            branch_sync::push_to_branches,
            branch_sync::pull_from_hq,
            branch_sync::get_branch_sync_status,
            // ── Display device selection (OPE-63) ──────────────────────────
            display_window::list_monitors,
            display_window::open_display_window,
            display_window::close_display_window,
            display_window::get_display_window_open,
            display_window::get_display_settings,
            display_window::set_display_settings,
            display_window::get_obs_display_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
