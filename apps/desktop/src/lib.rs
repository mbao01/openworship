mod artifacts;
mod backup;
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
mod updater;

use ow_audio::SttEngine;
use ow_core::{QueueItem, SongRef};
use ow_embed::SemanticIndex;
use tauri::{Emitter, Manager};
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
    let scripture_db = Arc::new(Mutex::new(db));

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
    let blackout = Arc::new(RwLock::new(false));
    let detect_blackout = Arc::clone(&blackout);

    // ── Clone Arcs for background embedding tasks ─────────────────────────────
    let embed_index = Arc::clone(&semantic_index);
    let embed_embedder = Arc::clone(&embedder);
    let embed_settings = Arc::clone(&audio_settings);
    let embed_translation = Arc::clone(&active_translation);
    let song_embed_db = Arc::clone(&songs_db);
    let song_embed_index = Arc::clone(&song_semantic_index);
    let song_embed_embedder = Arc::clone(&embedder);

    let media_db = Arc::clone(&artifacts_db);

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
        blackout,
        scripture_db,
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .register_uri_scheme_protocol("owmedia", move |_ctx, request| {
            // Custom protocol handler for local media and thumbnails.
            //
            // Routes:
            //   owmedia://localhost/{id}            → serve the artifact file
            //   owmedia://localhost/thumbnail/{id}  → serve the artifact's thumbnail
            let uri = request.uri();
            let path = uri.path().trim_start_matches('/');

            let db = match media_db.lock() {
                Ok(db) => db,
                Err(_) => return tauri::http::Response::builder()
                    .status(500)
                    .body(Vec::new())
                    .unwrap(),
            };

            // thumbnail/{id} route
            if let Some(artifact_id) = path.strip_prefix("thumbnail/") {
                let entry = match db.get_by_id(artifact_id) {
                    Ok(Some(e)) => e,
                    _ => return tauri::http::Response::builder()
                        .status(404)
                        .body(Vec::new())
                        .unwrap(),
                };
                let thumb_rel = match entry.thumbnail_path.as_ref() {
                    Some(p) => p.clone(),
                    None => return tauri::http::Response::builder()
                        .status(404)
                        .body(Vec::new())
                        .unwrap(),
                };
                let abs = db.abs_path(&thumb_rel);
                let bytes = match std::fs::read(&abs) {
                    Ok(b) => b,
                    Err(_) => return tauri::http::Response::builder()
                        .status(404)
                        .body(Vec::new())
                        .unwrap(),
                };
                return tauri::http::Response::builder()
                    .status(200)
                    .header("Content-Type", "image/jpeg")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(bytes)
                    .unwrap();
            }

            // Default: serve artifact by ID — supports RFC 7233 Range requests
            // so the browser can stream and seek video without full reloads.
            let entry = match db.get_by_id(path) {
                Ok(Some(e)) => e,
                _ => return tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap(),
            };

            let abs = db.abs_path(&entry.path);
            let mime = entry.mime_type.unwrap_or_else(|| "application/octet-stream".into());
            // Release the lock before file I/O so other requests are not blocked.
            drop(db);

            let file_len = match std::fs::metadata(&abs) {
                Ok(m) => m.len(),
                Err(_) => return tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap(),
            };

            // Parse Range header: "bytes=start-end" or "bytes=start-"
            let range_str = request
                .headers()
                .get("Range")
                .or_else(|| request.headers().get("range"))
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_owned());

            if let Some(range) = range_str {
                let val = range.strip_prefix("bytes=").unwrap_or(&range);
                let mut parts = val.splitn(2, '-');
                let start: u64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
                let end: u64 = parts
                    .next()
                    .filter(|s| !s.is_empty())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(file_len.saturating_sub(1))
                    .min(file_len.saturating_sub(1));

                if start > end || start >= file_len {
                    return tauri::http::Response::builder()
                        .status(416)
                        .header("Content-Range", format!("bytes */{file_len}"))
                        .body(Vec::new())
                        .unwrap();
                }

                let length = end - start + 1;
                let mut buf = vec![0u8; length as usize];
                use std::io::{Read, Seek, SeekFrom};
                return match std::fs::File::open(&abs).and_then(|mut f| {
                    f.seek(SeekFrom::Start(start))?;
                    f.read_exact(&mut buf)?;
                    Ok(buf)
                }) {
                    Ok(bytes) => tauri::http::Response::builder()
                        .status(206)
                        .header("Content-Type", &mime)
                        .header("Content-Range", format!("bytes {start}-{end}/{file_len}"))
                        .header("Content-Length", length.to_string())
                        .header("Accept-Ranges", "bytes")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(bytes)
                        .unwrap(),
                    Err(_) => tauri::http::Response::builder()
                        .status(500)
                        .body(Vec::new())
                        .unwrap(),
                };
            }

            // No Range header — return full file, advertising Range support.
            let bytes = match std::fs::read(&abs) {
                Ok(b) => b,
                Err(_) => return tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap(),
            };

            tauri::http::Response::builder()
                .status(200)
                .header("Content-Type", &mime)
                .header("Content-Length", bytes.len().to_string())
                .header("Accept-Ranges", "bytes")
                .header("Access-Control-Allow-Origin", "*")
                .body(bytes)
                .unwrap()
        })
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Start the WebSocket display server.
            // bind_listener() runs synchronously so we can emit a user-visible
            // error immediately if all ports are unavailable, rather than
            // silently swallowing the failure in a background task.
            match ow_display::bind_listener() {
                Some((listener, _port)) => {
                    tauri::async_runtime::spawn(ow_display::run_server(listener, tx_for_server));
                }
                None => {
                    let _ = app_handle.emit(
                        "display://port-unavailable",
                        format!(
                            "Display port {} is in use. Close the other instance of OpenWorship.",
                            ow_display::WS_PORT
                        ),
                    );
                }
            }

            // Background update check — silent, non-blocking; emits
            // `updater://update-available` if a newer version is found.
            updater::spawn_background_check(app.handle().clone());

            // Backfill thumbnails for any artifacts that are missing one.
            {
                let state: tauri::State<'_, AppState> = app.state();
                let db_arc = state.artifacts_db.clone();
                let app_for_thumbs = app.handle().clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let entries = match db_arc.lock() {
                        Ok(db) => db.list_missing_thumbnails().unwrap_or_default(),
                        Err(_) => vec![],
                    };
                    if entries.is_empty() { return; }
                    let base_dir = match db_arc.lock() {
                        Ok(db) => std::path::PathBuf::from(&db.settings().base_path),
                        Err(_) => return,
                    };
                    eprintln!("[thumbnail] backfilling {} artifacts with missing thumbnails", entries.len());
                    // Spawn a per-artifact blocking task so all thumbnails are generated concurrently.
                    for entry in entries {
                        let db_arc = db_arc.clone();
                        let app_for_thumbs = app_for_thumbs.clone();
                        let base_dir = base_dir.clone();
                        tauri::async_runtime::spawn_blocking(move || {
                            let abs_path = base_dir.join(&entry.path);
                            if let Some(thumb) = crate::artifacts::generate_thumbnail(&abs_path, &base_dir) {
                                if let Ok(db) = db_arc.lock() {
                                    if let Ok(Some(mut e)) = db.get_by_id(&entry.id) {
                                        e.thumbnail_path = Some(thumb.clone());
                                        let _ = db.upsert(&e);
                                    }
                                }
                                let _ = app_for_thumbs.emit("artifacts://thumbnail-ready", crate::commands::ThumbnailReadyPayload {
                                    id: entry.id,
                                    thumbnail_path: thumb,
                                });
                            }
                        });
                    }
                });
            }

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
                detect_blackout,
                app_handle.clone(),
                detect_translation,
                detect_announcements,
            ));

            // Device hot-plug watcher: polls the cpal device list every 2 s and
            // emits `audio://devices-changed` when the list of input devices changes.
            // This replaces the 3 s setInterval in AudioSection.tsx (IPC poll → push).
            {
                let app_for_devices = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    use ow_audio::list_input_devices;
                    let mut prev: Vec<String> = list_input_devices()
                        .unwrap_or_default()
                        .into_iter()
                        .map(|d| d.name)
                        .collect();
                    loop {
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                        let current: Vec<String> = list_input_devices()
                            .unwrap_or_default()
                            .into_iter()
                            .map(|d| d.name)
                            .collect();
                        if current != prev {
                            eprintln!("[device-watcher] device list changed, emitting audio://devices-changed");
                            let _ = app_for_devices.emit("audio://devices-changed", ());
                            prev = current;
                        }
                    }
                });
            }

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
            commands::get_book_chapters,
            commands::get_chapter_verses,
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
            commands::import_background_file,
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
            commands::get_cloud_sync_infos,
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
            commands::get_artifact_path,
            commands::read_artifact_bytes,
            commands::read_thumbnail,
            commands::regenerate_thumbnails,
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
            // ── Backup / restore (OPE-154) ─────────────────────────────────
            backup::create_backup,
            backup::restore_backup,
            // ── Auto-updater (OPE-161) ─────────────────────────────────────
            updater::check_for_updates,
            updater::install_update,
            updater::restart_app,
            // ── Tutorial onboarding (OPE-170) ──────────────────────────────
            commands::get_tutorial_state,
            commands::set_tutorial_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
