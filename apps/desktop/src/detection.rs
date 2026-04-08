//! Background detection loop — subscribes to the STT broadcast, runs the
//! scripture detector on a rolling 10-second transcript window, de-duplicates
//! within a 3-second cooldown, and routes detected verses to the content queue
//! and/or the projection display based on the current operating mode.
//!
//! Phase 9 addition: after exact-reference detection, a semantic pass runs
//! against the same window text when Ollama is available and the semantic index
//! is ready.  Exact matches take priority; semantic-only matches are appended
//! after with a 5-second per-window debounce to avoid over-firing.

use crate::settings::AudioSettings;
use ow_audio::TranscriptEvent;
use ow_core::{DetectionMode, QueueItem, QueueStatus, ScriptureDetector};
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
/// Minimum seconds between repeated detections of the same reference.
const COOLDOWN_SECS: u64 = 3;
/// Maximum items kept in the queue at any time.
const QUEUE_CAP: usize = 50;
/// Minimum seconds between semantic search passes on the same window.
const SEMANTIC_DEBOUNCE_SECS: u64 = 5;

/// Tauri event emitted whenever the content queue changes.
pub const QUEUE_UPDATED_EVENT: &str = "detection://queue-updated";

/// Run the detection loop as a long-lived background task.
///
/// Call this from `lib.rs` inside the Tauri `.setup()` closure.
#[allow(clippy::too_many_arguments)]
pub async fn run_loop(
    mut rx: broadcast::Receiver<TranscriptEvent>,
    search: Arc<SearchEngine>,
    queue: Arc<Mutex<VecDeque<QueueItem>>>,
    mode: Arc<RwLock<DetectionMode>>,
    settings: Arc<RwLock<AudioSettings>>,
    semantic_index: Arc<RwLock<Option<SemanticIndex>>>,
    ollama: Arc<OllamaClient>,
    display_tx: broadcast::Sender<ContentEvent>,
    app: AppHandle,
) {
    let detector = ScriptureDetector::new();
    let mut window: Vec<TranscriptEvent> = Vec::new();
    // Maps canonical reference → time of last successful detection.
    let mut cooldown: HashMap<String, Instant> = HashMap::new();
    // Last time the semantic pass ran for the current window.
    let mut semantic_last_run: Option<Instant> = None;
    // Window text the last semantic pass saw — avoid re-running on identical text.
    let mut semantic_last_text = String::new();

    loop {
        match rx.recv().await {
            Ok(evt) => {
                // Maintain rolling window of last WINDOW_SECS.
                let cutoff_ms = evt.offset_ms.saturating_sub(WINDOW_SECS * 1_000);
                window.retain(|e| e.offset_ms >= cutoff_ms);
                window.push(evt);

                let current_mode = *mode.read().unwrap_or_else(|e| e.into_inner());
                // Airplane mode: skip detection entirely.
                if current_mode == DetectionMode::Airplane {
                    continue;
                }

                // Build concatenated text from the rolling window.
                let text = window
                    .iter()
                    .map(|e| e.text.as_str())
                    .collect::<Vec<_>>()
                    .join(" ");

                // ── Exact reference detection (existing behaviour) ─────────────
                let detected = detector.detect(&text);

                // Prune stale cooldown entries.
                let now = Instant::now();
                cooldown.retain(|_, t| now.duration_since(*t) < Duration::from_secs(COOLDOWN_SECS));

                let mut exact_refs_queued: HashSet<String> = HashSet::new();

                for reference in detected {
                    if cooldown.contains_key(&reference) {
                        continue;
                    }

                    // Look up the verse. Prefer KJV; fall back to any translation.
                    let result = search
                        .search(&reference, Some("KJV"), 1)
                        .ok()
                        .and_then(|mut r| r.pop())
                        .or_else(|| {
                            search
                                .search(&reference, None, 1)
                                .ok()
                                .and_then(|mut r| r.pop())
                        });

                    let Some(r) = result else { continue };

                    // Skip if this reference is already Pending or Live in the queue.
                    {
                        let q = queue.lock().unwrap_or_else(|e| e.into_inner());
                        if q.iter().any(|i| {
                            i.reference == r.reference
                                && matches!(i.status, QueueStatus::Pending | QueueStatus::Live)
                        }) {
                            continue;
                        }
                    }

                    // Record cooldown entry now that we know we'll process it.
                    cooldown.insert(reference, now);
                    exact_refs_queued.insert(r.reference.clone());

                    let snapshot = enqueue_item(
                        r.reference.clone(),
                        r.text.clone(),
                        r.translation.clone(),
                        current_mode,
                        &queue,
                        &display_tx,
                    );
                    let _ = app.emit(QUEUE_UPDATED_EVENT, snapshot);
                }

                // ── Semantic detection (Phase 9) ───────────────────────────────
                // Only run when:
                //   1. Semantic search is enabled in settings.
                //   2. The semantic index is ready.
                //   3. The debounce interval has elapsed or the text changed.
                let sem_cfg = settings
                    .read()
                    .map(|s| (s.semantic_enabled, s.semantic_threshold_auto, s.semantic_threshold_copilot))
                    .unwrap_or((true, 0.75, 0.82));
                let (sem_enabled, thresh_auto, thresh_copilot) = sem_cfg;

                if sem_enabled && !text.trim().is_empty() {
                    // Debounce is the primary gate: only run if enough time has
                    // elapsed since the last pass.  Text-change is a skip
                    // optimisation: if the window is identical to the last run
                    // there is nothing new to learn.
                    //
                    // Previously this was `text_changed || debounce_elapsed`,
                    // which fired on every transcript token (text always changes)
                    // regardless of the debounce, hammering Ollama continuously
                    // during speech.
                    let debounce_elapsed = semantic_last_run
                        .map(|t| {
                            now.duration_since(t) >= Duration::from_secs(SEMANTIC_DEBOUNCE_SECS)
                        })
                        .unwrap_or(true);
                    let should_run = debounce_elapsed && text != semantic_last_text;

                    if should_run {
                        // Check if the index is ready without holding the lock.
                        let index_ready = semantic_index
                            .read()
                            .map(|g| g.is_some())
                            .unwrap_or(false);

                        if index_ready {
                            // Embed the window text via Ollama (async HTTP).
                            match ollama.embed(&text).await {
                                Ok(query_emb) => {
                                    // Re-sample the clock after the async embed
                                    // so that cooldown timestamps and the debounce
                                    // anchor are not stale by the embed latency.
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
                                        guard
                                            .as_ref()
                                            .map(|idx| idx.search(&query_emb, threshold, 5))
                                    };

                                    if let Some(matches) = matches {
                                        for m in matches {
                                            // Exact matches take priority — skip duplicates.
                                            if exact_refs_queued.contains(&m.verse.reference) {
                                                continue;
                                            }
                                            if cooldown.contains_key(&m.verse.reference) {
                                                continue;
                                            }
                                            // Skip if already Pending or Live.
                                            {
                                                let q =
                                                    queue.lock().unwrap_or_else(|e| e.into_inner());
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
                                            );
                                            let _ = app.emit(QUEUE_UPDATED_EVENT, snapshot);
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("[detect] semantic embed failed: {e}");
                                    // Record the run time even on failure so the debounce
                                    // prevents hammering a broken/slow Ollama with a retry
                                    // on every incoming transcript token.
                                    semantic_last_run = Some(now);
                                }
                            }
                        }
                    }
                }
            }
            Err(broadcast::error::RecvError::Lagged(_)) => {
                // Too slow to keep up — skip lagged events and continue.
                continue;
            }
            Err(broadcast::error::RecvError::Closed) => {
                // Sender dropped (app shutdown); exit.
                break;
            }
        }
    }
}

// ─── Shared enqueue helper ────────────────────────────────────────────────────

/// Add a verse to the queue according to the current mode, retire previous
/// Live items in Auto/Offline mode, enforce the cap, and return a snapshot.
fn enqueue_item(
    reference: String,
    text: String,
    translation: String,
    mode: DetectionMode,
    queue: &Mutex<VecDeque<QueueItem>>,
    display_tx: &broadcast::Sender<ContentEvent>,
) -> Vec<QueueItem> {
    enqueue_item_inner(reference, text, translation, mode, queue, display_tx, false, None)
}

/// Inner implementation that carries semantic metadata.
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
) -> Vec<QueueItem> {
    let mut item = QueueItem::new(reference.clone(), text.clone(), translation.clone());
    item.is_semantic = is_semantic;
    item.confidence = confidence;

    match mode {
        DetectionMode::Auto | DetectionMode::Offline => {
            let _ = display_tx.send(ContentEvent::scripture(&reference, &text, &translation));
            item.status = QueueStatus::Live;
        }
        DetectionMode::Copilot => { /* stays Pending */ }
        DetectionMode::Airplane => unreachable!("guarded by caller"),
    }

    let mut q = queue.lock().unwrap_or_else(|e| e.into_inner());
    // Retire previous Live items in Auto/Offline mode.
    if matches!(mode, DetectionMode::Auto | DetectionMode::Offline) {
        for it in q.iter_mut() {
            if it.status == QueueStatus::Live {
                it.status = QueueStatus::Dismissed;
            }
        }
    }
    q.push_back(item);
    // Evict oldest dismissed entries first when over cap.
    while q.len() > QUEUE_CAP {
        if let Some(pos) = q.iter().position(|i| i.status == QueueStatus::Dismissed) {
            q.remove(pos);
        } else {
            q.pop_front();
        }
    }
    q.iter().cloned().collect()
}
