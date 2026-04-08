//! Content queue and operating mode for the scripture detection pipeline.

use std::collections::VecDeque;

use crate::parser::ScriptureRef;

/// How the operator wants the auto-detection to behave.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum OperatingMode {
    /// Detected verses are pushed to the display immediately.
    #[default]
    Auto,
    /// Detected verses are queued for operator approval before display.
    Copilot,
    /// Operator controls display manually; detection is paused.
    Airplane,
    /// STT is not running; detection is inactive.
    Offline,
}

/// Lifecycle state of a verse in the content queue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VerseStatus {
    /// Waiting for operator decision.
    Pending,
    /// Operator approved — sent to display.
    Approved,
    /// Operator dismissed — will not be shown.
    Dismissed,
}

/// A verse that has been detected and is sitting in the queue.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QueuedVerse {
    /// Monotonic ID assigned at insertion time.
    pub id: u64,
    /// The parsed scripture reference.
    pub reference: ScriptureRef,
    /// Verse text retrieved from the search engine.
    pub text: String,
    /// Bible translation (e.g. "KJV").
    pub translation: String,
    pub status: VerseStatus,
}

/// FIFO queue of recently detected verses.
///
/// Capped at `MAX_ITEMS` entries — oldest entries are evicted when full.
pub struct ContentQueue {
    items: VecDeque<QueuedVerse>,
    next_id: u64,
}

const MAX_ITEMS: usize = 20;

impl ContentQueue {
    pub fn new() -> Self {
        Self { items: VecDeque::new(), next_id: 1 }
    }

    /// Push a new verse into the queue.  Returns the assigned ID.
    pub fn push(&mut self, reference: ScriptureRef, text: String, translation: String) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        if self.items.len() >= MAX_ITEMS {
            self.items.pop_front();
        }
        self.items.push_back(QueuedVerse {
            id,
            reference,
            text,
            translation,
            status: VerseStatus::Pending,
        });
        id
    }

    /// Mark a verse as approved.  Returns `true` if the verse was found.
    pub fn approve(&mut self, id: u64) -> bool {
        self.set_status(id, VerseStatus::Approved)
    }

    /// Mark a verse as dismissed.  Returns `true` if the verse was found.
    pub fn dismiss(&mut self, id: u64) -> bool {
        self.set_status(id, VerseStatus::Dismissed)
    }

    fn set_status(&mut self, id: u64, status: VerseStatus) -> bool {
        if let Some(v) = self.items.iter_mut().find(|v| v.id == id) {
            v.status = status;
            true
        } else {
            false
        }
    }

    /// Return a snapshot of all queued verses (newest last).
    pub fn snapshot(&self) -> Vec<QueuedVerse> {
        self.items.iter().cloned().collect()
    }

    /// Remove all verses from the queue.
    pub fn clear(&mut self) {
        self.items.clear();
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }
}

impl Default for ContentQueue {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::ScriptureRef;

    fn verse(ch: u32, v: u32) -> ScriptureRef {
        ScriptureRef { book: "John".into(), chapter: ch, verse: Some(v) }
    }

    #[test]
    fn test_push_and_snapshot() {
        let mut q = ContentQueue::new();
        q.push(verse(3, 16), "For God so loved…".into(), "KJV".into());
        let snap = q.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].status, VerseStatus::Pending);
        assert_eq!(snap[0].id, 1);
    }

    #[test]
    fn test_approve_dismiss() {
        let mut q = ContentQueue::new();
        let id = q.push(verse(3, 16), "text".into(), "KJV".into());
        assert!(q.approve(id));
        assert_eq!(q.snapshot()[0].status, VerseStatus::Approved);

        let id2 = q.push(verse(3, 17), "text2".into(), "KJV".into());
        assert!(q.dismiss(id2));
        assert_eq!(q.snapshot()[1].status, VerseStatus::Dismissed);
    }

    #[test]
    fn test_cap_at_max() {
        let mut q = ContentQueue::new();
        for i in 1..=(MAX_ITEMS as u32 + 5) {
            q.push(verse(i, 1), "t".into(), "KJV".into());
        }
        assert_eq!(q.len(), MAX_ITEMS);
        // Oldest entries were evicted; first remaining id should be 6 (after 5 evictions)
        assert_eq!(q.snapshot()[0].id, 6);
    }

    #[test]
    fn test_clear() {
        let mut q = ContentQueue::new();
        q.push(verse(1, 1), "t".into(), "KJV".into());
        q.clear();
        assert!(q.is_empty());
    }
}
