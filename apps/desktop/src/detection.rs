//! Background detection loop — subscribes to the STT broadcast, runs the
//! scripture detector on a rolling 10-second transcript window, de-duplicates
//! within a 3-second cooldown, and routes detected verses to the content queue
//! and/or the projection display based on the current operating mode.

use ow_audio::TranscriptEvent;
use ow_core::{DetectionMode, QueueItem, QueueStatus, ScriptureDetector};
use ow_display::ContentEvent;
use ow_search::SearchEngine;
use std::collections::{HashMap, VecDeque};
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

/// Tauri event emitted whenever the content queue changes.
pub const QUEUE_UPDATED_EVENT: &str = "detection://queue-updated";

/// Run the detection loop as a long-lived background task.
///
/// Call this from `lib.rs` inside the Tauri `.setup()` closure.
pub async fn run_loop(
    mut rx: broadcast::Receiver<TranscriptEvent>,
    search: Arc<SearchEngine>,
    queue: Arc<Mutex<VecDeque<QueueItem>>>,
    mode: Arc<RwLock<DetectionMode>>,
    display_tx: broadcast::Sender<ContentEvent>,
    app: AppHandle,
) {
    let detector = ScriptureDetector::new();
    let mut window: Vec<TranscriptEvent> = Vec::new();
    // Maps canonical reference → time of last successful detection.
    let mut cooldown: HashMap<String, Instant> = HashMap::new();

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

                let detected = detector.detect(&text);

                // Prune stale cooldown entries.
                let now = Instant::now();
                cooldown.retain(|_, t| now.duration_since(*t) < Duration::from_secs(COOLDOWN_SECS));

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

                    let mut item =
                        QueueItem::new(r.reference.clone(), r.text.clone(), r.translation.clone());

                    match current_mode {
                        DetectionMode::Auto | DetectionMode::Offline => {
                            // Push directly to the projection display.
                            let _ = display_tx.send(ContentEvent::scripture(
                                &r.reference,
                                &r.text,
                                &r.translation,
                            ));
                            // Mark as Live and retire previous Live items.
                            item.status = QueueStatus::Live;
                        }
                        DetectionMode::Copilot => {
                            // Stays Pending; operator must approve.
                        }
                        DetectionMode::Airplane => unreachable!("guarded above"),
                    }

                    let snapshot = {
                        let mut q = queue.lock().unwrap_or_else(|e| e.into_inner());
                        // Retire previous Live items in Auto/Offline mode.
                        if matches!(current_mode, DetectionMode::Auto | DetectionMode::Offline) {
                            for it in q.iter_mut() {
                                if it.status == QueueStatus::Live {
                                    it.status = QueueStatus::Dismissed;
                                }
                            }
                        }
                        q.push_back(item);
                        // Evict oldest dismissed entries first when over cap.
                        while q.len() > QUEUE_CAP {
                            if let Some(pos) =
                                q.iter().position(|i| i.status == QueueStatus::Dismissed)
                            {
                                q.remove(pos);
                            } else {
                                q.pop_front();
                            }
                        }
                        q.iter().cloned().collect::<Vec<_>>()
                    };

                    let _ = app.emit(QUEUE_UPDATED_EVENT, snapshot);
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
