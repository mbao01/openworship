//! Detection pipeline: subscribes to transcript events, parses scripture
//! references, looks them up in the search engine, and either pushes them
//! directly to the display (Auto mode) or queues them for operator approval
//! (Copilot mode).

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use ow_audio::TranscriptEvent;
use tokio::sync::broadcast;

use crate::parser::parse_refs;
use crate::queue::{ContentQueue, OperatingMode, VerseStatus};

/// How long to suppress re-detection of the same reference.
const COOLDOWN: Duration = Duration::from_secs(30);

/// Shared handle to the detection pipeline state.
/// Kept behind Arc<Mutex> so Tauri commands can read/write the queue and mode.
pub struct DetectionPipeline {
    pub mode: Arc<Mutex<OperatingMode>>,
    pub queue: Arc<Mutex<ContentQueue>>,
}

impl DetectionPipeline {
    /// Create a new pipeline and spawn the background task.
    ///
    /// - `transcript_rx`: a receiver on the STT broadcast channel.
    /// - `search`: the search engine used to resolve references to verse text.
    /// - `display_tx`: channel used to push content to the fullscreen display.
    pub fn new(
        transcript_rx: broadcast::Receiver<TranscriptEvent>,
        search: Arc<ow_search::SearchEngine>,
        display_tx: tokio::sync::broadcast::Sender<ow_display::ContentEvent>,
    ) -> Self {
        let mode = Arc::new(Mutex::new(OperatingMode::default()));
        let queue = Arc::new(Mutex::new(ContentQueue::new()));

        let mode_task = Arc::clone(&mode);
        let queue_task = Arc::clone(&queue);

        tokio::spawn(run_pipeline(
            transcript_rx,
            search,
            display_tx,
            mode_task,
            queue_task,
        ));

        DetectionPipeline { mode, queue }
    }
}

async fn run_pipeline(
    mut rx: broadcast::Receiver<TranscriptEvent>,
    search: Arc<ow_search::SearchEngine>,
    display_tx: broadcast::Sender<ow_display::ContentEvent>,
    mode: Arc<Mutex<OperatingMode>>,
    queue: Arc<Mutex<ContentQueue>>,
) {
    // Cooldown map: canonical reference string → last-seen Instant
    let mut cooldowns: HashMap<String, Instant> = HashMap::new();

    loop {
        let evt = match rx.recv().await {
            Ok(e) => e,
            Err(broadcast::error::RecvError::Closed) => break,
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
        };

        let current_mode = *mode.lock().unwrap();
        if matches!(current_mode, OperatingMode::Airplane | OperatingMode::Offline) {
            continue;
        }

        let refs = parse_refs(&evt.text);
        for scripture_ref in refs {
            let key = scripture_ref.display();

            // Cooldown check
            if let Some(&last) = cooldowns.get(&key) {
                if last.elapsed() < COOLDOWN {
                    continue;
                }
            }
            cooldowns.insert(key.clone(), Instant::now());

            // Look up verse text (KJV default)
            let query = scripture_ref.query();
            let results = match search.search(&query, Some("KJV"), 1) {
                Ok(r) => r,
                Err(_) => continue,
            };
            let Some(verse) = results.into_iter().next() else {
                continue;
            };

            match current_mode {
                OperatingMode::Auto => {
                    let event = ow_display::ContentEvent::scripture(
                        verse.reference.clone(),
                        verse.text.clone(),
                        verse.translation.clone(),
                    );
                    let _ = display_tx.send(event);
                    // Also record in queue with Approved status for history
                    let mut q = queue.lock().unwrap();
                    let id = q.push(scripture_ref, verse.text, verse.translation);
                    q.approve(id);
                }
                OperatingMode::Copilot => {
                    let mut q = queue.lock().unwrap();
                    q.push(scripture_ref, verse.text, verse.translation);
                }
                OperatingMode::Airplane | OperatingMode::Offline => {
                    // Already filtered above
                }
            }
        }
    }
}

/// Approve a queued verse and push it to the display.
///
/// Returns `false` if the verse was not found or already actioned.
pub fn approve_and_display(
    id: u64,
    queue: &Arc<Mutex<ContentQueue>>,
    display_tx: &broadcast::Sender<ow_display::ContentEvent>,
) -> bool {
    let mut q = queue.lock().unwrap();
    let verse = q.snapshot().into_iter().find(|v| v.id == id);
    if let Some(v) = verse {
        if v.status != VerseStatus::Pending {
            return false;
        }
        q.approve(id);
        let event = ow_display::ContentEvent::scripture(
            v.reference.display(),
            v.text,
            v.translation,
        );
        let _ = display_tx.send(event);
        true
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ow_audio::TranscriptEvent;
    use ow_display::ContentEvent;

    fn make_transcript(text: &str) -> TranscriptEvent {
        TranscriptEvent { text: text.into(), offset_ms: 0, duration_ms: 500, mic_active: true }
    }

    #[tokio::test]
    async fn test_auto_mode_pushes_to_display() {
        let db = ow_db::open_and_seed().unwrap();
        let verses = ow_db::get_all_verses(&db).unwrap();
        let search = Arc::new(ow_search::SearchEngine::build(&verses).unwrap());

        let (transcript_tx, transcript_rx) = broadcast::channel::<TranscriptEvent>(16);
        let (display_tx, mut display_rx) = broadcast::channel::<ContentEvent>(16);

        let pipeline = DetectionPipeline::new(transcript_rx, search, display_tx);

        // Set Auto mode (it's the default, but be explicit)
        *pipeline.mode.lock().unwrap() = OperatingMode::Auto;

        transcript_tx.send(make_transcript("turn to John 3:16")).unwrap();

        // Give the pipeline task a moment to process
        tokio::time::sleep(Duration::from_millis(200)).await;

        let event = display_rx.try_recv();
        assert!(event.is_ok(), "Auto mode should push to display");
    }

    #[tokio::test]
    async fn test_copilot_mode_queues_verse() {
        let db = ow_db::open_and_seed().unwrap();
        let verses = ow_db::get_all_verses(&db).unwrap();
        let search = Arc::new(ow_search::SearchEngine::build(&verses).unwrap());

        let (transcript_tx, transcript_rx) = broadcast::channel::<TranscriptEvent>(16);
        let (display_tx, mut display_rx) = broadcast::channel::<ContentEvent>(16);

        let pipeline = DetectionPipeline::new(transcript_rx, search, display_tx);
        *pipeline.mode.lock().unwrap() = OperatingMode::Copilot;

        transcript_tx.send(make_transcript("let's look at John 3:16")).unwrap();

        tokio::time::sleep(Duration::from_millis(200)).await;

        // Display should NOT have received anything
        assert!(display_rx.try_recv().is_err(), "Copilot mode should not push to display");

        // Queue should have one Pending verse
        let snap = pipeline.queue.lock().unwrap().snapshot();
        assert_eq!(snap.len(), 1, "Copilot mode should queue the verse");
        assert_eq!(snap[0].status, crate::queue::VerseStatus::Pending);
    }

    #[tokio::test]
    async fn test_airplane_mode_ignores_transcript() {
        let db = ow_db::open_and_seed().unwrap();
        let verses = ow_db::get_all_verses(&db).unwrap();
        let search = Arc::new(ow_search::SearchEngine::build(&verses).unwrap());

        let (transcript_tx, transcript_rx) = broadcast::channel::<TranscriptEvent>(16);
        let (display_tx, mut display_rx) = broadcast::channel::<ContentEvent>(16);

        let pipeline = DetectionPipeline::new(transcript_rx, search, display_tx);
        *pipeline.mode.lock().unwrap() = OperatingMode::Airplane;

        transcript_tx.send(make_transcript("John 3:16")).unwrap();

        tokio::time::sleep(Duration::from_millis(200)).await;

        assert!(display_rx.try_recv().is_err());
        assert!(pipeline.queue.lock().unwrap().is_empty());
    }
}
