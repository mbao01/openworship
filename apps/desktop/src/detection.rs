//! Background detection loop — subscribes to the STT broadcast, runs the
//! scripture detector on a rolling 10-second transcript window, de-duplicates
//! within a 3-second cooldown, and routes detected content to the queue
//! and/or the projection display based on the current operating mode.
//!
//! Phase 9: semantic scripture matching via Ollama embeddings.
//! Phase 10: song title detection + semantic song phrase detection + speech-
//!           paced line advance for live songs.

use crate::settings::AudioSettings;
use crate::songs::{self, SongSemanticIndex};
use ow_audio::TranscriptEvent;
use ow_core::{content_kind, DetectionMode, QueueItem, QueueStatus, ScriptureDetector, SongDetector, SongRef};
use ow_display::ContentEvent;
use ow_embed::{OllamaClient, SemanticIndex};
use ow_search::SearchEngine;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast;

/// Rolling context window for transcript accumulation.
const WINDOW_SECS: u64 = 10;
/// Minimum seconds between repeated detections of the same reference/title.
const COOLDOWN_SECS: u64 = 3;
/// Maximum items kept in the queue at any time.
const QUEUE_CAP: usize = 50;
/// Minimum seconds between semantic search passes on the same window.
const SEMANTIC_DEBOUNCE_SECS: u64 = 5;
/// Lines per lyric display chunk.
const LYRIC_CHUNK_SIZE: usize = 2;

/// Tauri event emitted whenever the content queue changes.
pub const QUEUE_UPDATED_EVENT: &str = "detection://queue-updated";

/// Tracks the currently-live song for speech-paced line advance.
struct LiveSong {
    id: i64,
    title: String,
    lyrics: String,
    chunk_index: u32,
}

/// Run the detection loop as a long-lived background task.
#[allow(clippy::too_many_arguments)]
pub async fn run_loop(
    mut rx: broadcast::Receiver<TranscriptEvent>,
    search: Arc<SearchEngine>,
    queue: Arc<Mutex<VecDeque<QueueItem>>>,
    mode: Arc<RwLock<DetectionMode>>,
    settings: Arc<RwLock<AudioSettings>>,
    semantic_index: Arc<RwLock<Option<SemanticIndex>>>,
    ollama: Arc<OllamaClient>,
    song_semantic_index: Arc<RwLock<Option<SongSemanticIndex>>>,
    song_refs: Arc<RwLock<Vec<SongRef>>>,
    display_tx: broadcast::Sender<ContentEvent>,
    app: AppHandle,
) {
    let scripture_detector = ScriptureDetector::new();
    let mut song_detector = SongDetector::default();
    let mut window: Vec<TranscriptEvent> = Vec::new();
    let mut cooldown: HashMap<String, Instant> = HashMap::new();
    let mut semantic_last_run: Option<Instant> = None;
    let mut semantic_last_text = String::new();
    let mut song_semantic_last_run: Option<Instant> = None;
    let mut song_semantic_last_text = String::new();
    // Last song-ref snapshot we built the detector from.
    let mut last_song_refs_len: usize = 0;
    // Currently-live song (for speech pacing).
    let mut live_song: Option<LiveSong> = None;

    loop {
        match rx.recv().await {
            Ok(evt) => {
                // Maintain rolling window of last WINDOW_SECS.
                let cutoff_ms = evt.offset_ms.saturating_sub(WINDOW_SECS * 1_000);
                window.retain(|e| e.offset_ms >= cutoff_ms);
                window.push(evt);

                let current_mode = *mode.read().unwrap_or_else(|e| e.into_inner());
                if current_mode == DetectionMode::Airplane {
                    continue;
                }

                let text = window
                    .iter()
                    .map(|e| e.text.as_str())
                    .collect::<Vec<_>>()
                    .join(" ");

                let now = Instant::now();
                cooldown.retain(|_, t| now.duration_since(*t) < Duration::from_secs(COOLDOWN_SECS));

                // ── Refresh song detector when library changes ─────────────────
                {
                    let refs = song_refs.read().unwrap_or_else(|e| e.into_inner());
                    if refs.len() != last_song_refs_len {
                        song_detector.update(&refs);
                        last_song_refs_len = refs.len();
                    }
                }

                // ── Exact scripture detection ──────────────────────────────────
                let mut exact_refs_queued: HashSet<String> = HashSet::new();

                for reference in scripture_detector.detect(&text) {
                    if cooldown.contains_key(&reference) {
                        continue;
                    }
                    let result = search
                        .search(&reference, Some("KJV"), 1)
                        .ok()
                        .and_then(|mut r| r.pop())
                        .or_else(|| {
                            search.search(&reference, None, 1).ok().and_then(|mut r| r.pop())
                        });
                    let Some(r) = result else { continue };
                    {
                        let q = queue.lock().unwrap_or_else(|e| e.into_inner());
                        if q.iter().any(|i| {
                            i.reference == r.reference
                                && matches!(i.status, QueueStatus::Pending | QueueStatus::Live)
                        }) {
                            continue;
                        }
                    }
                    cooldown.insert(reference, now);
                    exact_refs_queued.insert(r.reference.clone());
                    let snapshot = enqueue_scripture(
                        r.reference.clone(),
                        r.text.clone(),
                        r.translation.clone(),
                        current_mode,
                        &queue,
                        &display_tx,
                    );
                    let _ = app.emit(QUEUE_UPDATED_EVENT, snapshot);
                }

                // ── Song title detection ───────────────────────────────────────
                if !song_detector.is_empty() {
                    let detected_songs = song_detector.detect(&text);
                    for song_ref in detected_songs {
                        let key = format!("song:{}", song_ref.id);
                        if cooldown.contains_key(&key) {
                            continue;
                        }
                        {
                            let q = queue.lock().unwrap_or_else(|e| e.into_inner());
                            if q.iter().any(|i| {
                                i.song_id == Some(song_ref.id)
                                    && matches!(i.status, QueueStatus::Pending | QueueStatus::Live)
                            }) {
                                continue;
                            }
                        }
                        cooldown.insert(key, now);
                        let snapshot = enqueue_song_ref(
                            &song_ref,
                            current_mode,
                            &queue,
                            &display_tx,
                            &app,
                        );
                        let _ = app.emit(QUEUE_UPDATED_EVENT, snapshot);
                    }
                }

                // ── Speech pacing for live song ───────────────────────────────
                if let Some(ref mut ls) = live_song {
                    if let Some(next_idx) = songs::pacing_advance(
                        &text,
                        &ls.lyrics,
                        ls.chunk_index as usize,
                        LYRIC_CHUNK_SIZE,
                    ) {
                        ls.chunk_index = next_idx as u32;
                        let advance_evt = ContentEvent::song_advance(ls.title.clone(), ls.chunk_index);
                        let _ = display_tx.send(advance_evt);
                    }
                }

                // ── Semantic scripture detection (Phase 9) ────────────────────
                let sem_cfg = settings
                    .read()
                    .map(|s| (s.semantic_enabled, s.semantic_threshold_auto, s.semantic_threshold_copilot))
                    .unwrap_or((true, 0.75, 0.82));
                let (sem_enabled, thresh_auto, thresh_copilot) = sem_cfg;

                if sem_enabled && !text.trim().is_empty() {
                    let debounce_elapsed = semantic_last_run
                        .map(|t| now.duration_since(t) >= Duration::from_secs(SEMANTIC_DEBOUNCE_SECS))
                        .unwrap_or(true);
                    let should_run = debounce_elapsed && text != semantic_last_text;

                    if should_run {
                        let index_ready = semantic_index
                            .read()
                            .map(|g| g.is_some())
                            .unwrap_or(false);

                        if index_ready {
                            match ollama.embed(&text).await {
                                Ok(query_emb) => {
                                    let embed_now = Instant::now();
                                    semantic_last_run = Some(embed_now);
                                    semantic_last_text = text.clone();

                                    let threshold = match current_mode {
                                        DetectionMode::Copilot => thresh_copilot,
                                        _ => thresh_auto,
                                    };
                                    let matches = {
                                        let guard = semantic_index
                                            .read()
                                            .unwrap_or_else(|e| e.into_inner());
                                        guard.as_ref().map(|idx| idx.search(&query_emb, threshold, 5))
                                    };
                                    if let Some(matches) = matches {
                                        for m in matches {
                                            if exact_refs_queued.contains(&m.verse.reference) {
                                                continue;
                                            }
                                            if cooldown.contains_key(&m.verse.reference) {
                                                continue;
                                            }
                                            {
                                                let q = queue.lock().unwrap_or_else(|e| e.into_inner());
                                                if q.iter().any(|i| {
                                                    i.reference == m.verse.reference
                                                        && matches!(
                                                            i.status,
                                                            QueueStatus::Pending | QueueStatus::Live
                                                        )
                                                }) {
                                                    continue;
                                                }
                                            }
                                            cooldown.insert(m.verse.reference.clone(), embed_now);
                                            let snapshot = enqueue_item_inner(
                                                m.verse.reference.clone(),
                                                m.verse.text.clone(),
                                                m.verse.translation.clone(),
                                                current_mode,
                                                &queue,
                                                &display_tx,
                                                true,
                                                Some(m.score as f64),
                                                content_kind::SCRIPTURE,
                                                None,
                                            );
                                            let _ = app.emit(QUEUE_UPDATED_EVENT, snapshot);
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("[detect] semantic embed failed: {e}");
                                    semantic_last_run = Some(now);
                                }
                            }
                        }
                    }
                }

                // ── Semantic song detection ───────────────────────────────────
                if sem_enabled && !text.trim().is_empty() {
                    let song_idx_ready = song_semantic_index
                        .read()
                        .map(|g| g.is_some())
                        .unwrap_or(false);

                    if song_idx_ready {
                        let debounce_elapsed = song_semantic_last_run
                            .map(|t| now.duration_since(t) >= Duration::from_secs(SEMANTIC_DEBOUNCE_SECS))
                            .unwrap_or(true);
                        let should_run = debounce_elapsed && text != song_semantic_last_text;

                        if should_run {
                            match ollama.embed(&text).await {
                                Ok(query_emb) => {
                                    let embed_now = Instant::now();
                                    song_semantic_last_run = Some(embed_now);
                                    song_semantic_last_text = text.clone();

                                    let threshold = match current_mode {
                                        DetectionMode::Copilot => thresh_copilot + 0.05,
                                        _ => thresh_auto + 0.05,
                                    };
                                    let matches = {
                                        let guard = song_semantic_index
                                            .read()
                                            .unwrap_or_else(|e| e.into_inner());
                                        guard.as_ref().map(|idx| idx.search(&query_emb, threshold, 3))
                                    };
                                    if let Some(matches) = matches {
                                        for m in matches {
                                            let key = format!("song:{}", m.song_id);
                                            if cooldown.contains_key(&key) {
                                                continue;
                                            }
                                            {
                                                let q = queue.lock().unwrap_or_else(|e| e.into_inner());
                                                if q.iter().any(|i| {
                                                    i.song_id == Some(m.song_id)
                                                        && matches!(
                                                            i.status,
                                                            QueueStatus::Pending | QueueStatus::Live
                                                        )
                                                }) {
                                                    continue;
                                                }
                                            }
                                            cooldown.insert(key, embed_now);
                                            let s_ref = SongRef { id: m.song_id, title: m.title };
                                            let snapshot = enqueue_song_ref(
                                                &s_ref,
                                                current_mode,
                                                &queue,
                                                &display_tx,
                                                &app,
                                            );
                                            let _ = app.emit(QUEUE_UPDATED_EVENT, snapshot);
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("[detect] song semantic embed failed: {e}");
                                    song_semantic_last_run = Some(now);
                                }
                            }
                        }
                    }
                }

                // ── Update live song tracker ──────────────────────────────────
                {
                    let q = queue.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(live_item) = q.iter().find(|i| {
                        i.status == QueueStatus::Live && i.kind == content_kind::SONG
                    }) {
                        let same = live_song
                            .as_ref()
                            .map(|ls| ls.id == live_item.song_id.unwrap_or(-1))
                            .unwrap_or(false);
                        if !same {
                            live_song = live_item.song_id.map(|sid| LiveSong {
                                id: sid,
                                title: live_item.reference.clone(),
                                lyrics: live_item.text.clone(),
                                chunk_index: 0,
                            });
                        }
                    } else if live_song.is_some() {
                        live_song = None;
                    }
                }
            }
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
}

// ─── Enqueue helpers ──────────────────────────────────────────────────────────

/// Enqueue a detected scripture verse.
fn enqueue_scripture(
    reference: String,
    text: String,
    translation: String,
    mode: DetectionMode,
    queue: &Mutex<VecDeque<QueueItem>>,
    display_tx: &broadcast::Sender<ContentEvent>,
) -> Vec<QueueItem> {
    enqueue_item_inner(reference, text, translation, mode, queue, display_tx, false, None, content_kind::SCRIPTURE, None)
}

/// Enqueue a detected song (by title match or semantic match).
///
/// Looks up lyrics from the app handle's song DB via a blocking read of the
/// song file, or falls back to just the title if not found.
fn enqueue_song_ref(
    song_ref: &SongRef,
    mode: DetectionMode,
    queue: &Mutex<VecDeque<QueueItem>>,
    _display_tx: &broadcast::Sender<ContentEvent>,
    _app: &AppHandle,
) -> Vec<QueueItem> {
    // We only have the song title here; the full lyrics will be loaded when
    // the operator pushes to display or approves the item.  The queue item
    // carries the title as `reference` and an empty `text` as placeholder.
    let mut item = QueueItem::new_song(
        song_ref.title.clone(),
        String::new(), // lyrics loaded on push
        String::new(),
        song_ref.id,
    );
    item.is_semantic = false;

    match mode {
        DetectionMode::Auto | DetectionMode::Offline => {
            // For songs in Auto mode we leave the item Live but don't push to
            // display yet — the operator or a subsequent `push_song_to_display`
            // call will load lyrics.  This avoids sending empty lyrics to the
            // display screen.
            item.status = QueueStatus::Live;
        }
        DetectionMode::Copilot => { /* stays Pending */ }
        DetectionMode::Airplane => unreachable!("guarded by caller"),
    }

    let mut q = queue.lock().unwrap_or_else(|e| e.into_inner());
    if matches!(mode, DetectionMode::Auto | DetectionMode::Offline) {
        for it in q.iter_mut() {
            if it.status == QueueStatus::Live {
                it.status = QueueStatus::Dismissed;
            }
        }
    }
    q.push_back(item);
    while q.len() > QUEUE_CAP {
        if let Some(pos) = q.iter().position(|i| i.status == QueueStatus::Dismissed) {
            q.remove(pos);
        } else {
            q.pop_front();
        }
    }
    q.iter().cloned().collect()
}

/// Generic inner enqueue that carries semantic metadata and content kind.
#[allow(clippy::too_many_arguments)]
fn enqueue_item_inner(
    reference: String,
    text: String,
    translation: String,
    mode: DetectionMode,
    queue: &Mutex<VecDeque<QueueItem>>,
    display_tx: &broadcast::Sender<ContentEvent>,
    is_semantic: bool,
    confidence: Option<f64>,
    kind: &str,
    song_id: Option<i64>,
) -> Vec<QueueItem> {
    let mut item = QueueItem::new(reference.clone(), text.clone(), translation.clone());
    item.is_semantic = is_semantic;
    item.confidence = confidence;
    item.kind = kind.to_owned();
    item.song_id = song_id;

    match mode {
        DetectionMode::Auto | DetectionMode::Offline => {
            let _ = display_tx.send(ContentEvent::scripture(&reference, &text, &translation));
            item.status = QueueStatus::Live;
        }
        DetectionMode::Copilot => { /* stays Pending */ }
        DetectionMode::Airplane => unreachable!("guarded by caller"),
    }

    let mut q = queue.lock().unwrap_or_else(|e| e.into_inner());
    if matches!(mode, DetectionMode::Auto | DetectionMode::Offline) {
        for it in q.iter_mut() {
            if it.status == QueueStatus::Live {
                it.status = QueueStatus::Dismissed;
            }
        }
    }
    q.push_back(item);
    while q.len() > QUEUE_CAP {
        if let Some(pos) = q.iter().position(|i| i.status == QueueStatus::Dismissed) {
            q.remove(pos);
        } else {
            q.pop_front();
        }
    }
    q.iter().cloned().collect()
}
