//! Sermon notes, announcements, and custom slides — storage and persistence.
//!
//! All three content types are persisted to JSON files under `~/.openworship/`.
//! The `AnnouncementItem` and `SermonNote` types are serialised directly to the
//! Tauri frontend so their field names must stay stable.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn gen_id() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros() as u64;
    format!("{:016x}", ts)
}

// ─── Announcement ─────────────────────────────────────────────────────────────

/// A pre-created announcement or custom slide that can be pushed to the display.
///
/// Announcements are labelled with an optional keyword cue so the detection
/// loop can trigger them automatically when the phrase appears in transcript text.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnouncementItem {
    /// Stable identifier.
    pub id: String,
    /// Content kind: "announcement" or "custom_slide".
    pub kind: String,
    /// Title shown as the slide heading on the display.
    pub title: String,
    /// Body text shown below the title.
    pub body: String,
    /// Optional URL for a background or inline image.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    /// Keyword phrase that triggers this item automatically from transcript.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub keyword_cue: Option<String>,
    /// Unix timestamp (ms) of creation.
    pub created_at_ms: i64,
}

impl AnnouncementItem {
    pub fn new_announcement(
        title: String,
        body: String,
        image_url: Option<String>,
        keyword_cue: Option<String>,
    ) -> Self {
        Self {
            id: gen_id(),
            kind: "announcement".into(),
            title,
            body,
            image_url,
            keyword_cue,
            created_at_ms: now_ms(),
        }
    }

    #[allow(dead_code)]
    pub fn new_custom_slide(
        title: String,
        body: String,
        image_url: Option<String>,
    ) -> Self {
        Self {
            id: gen_id(),
            kind: "custom_slide".into(),
            title,
            body,
            image_url,
            keyword_cue: None,
            created_at_ms: now_ms(),
        }
    }
}

// ─── Sermon note ──────────────────────────────────────────────────────────────

/// A sermon note deck — an ordered list of text slides shown on the speaker
/// display as the preacher advances through the message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SermonNote {
    /// Stable identifier.
    pub id: String,
    /// Title / sermon series name shown as a header on the speaker display.
    pub title: String,
    /// Ordered slides, each containing free-form text.
    pub slides: Vec<String>,
    /// Unix timestamp (ms) of creation.
    pub created_at_ms: i64,
}

impl SermonNote {
    pub fn new(title: String, slides: Vec<String>) -> Self {
        Self {
            id: gen_id(),
            title,
            slides,
            created_at_ms: now_ms(),
        }
    }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

fn data_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".openworship")
}

fn announcements_path() -> PathBuf {
    data_dir().join("announcements.json")
}

fn sermon_notes_path() -> PathBuf {
    data_dir().join("sermon_notes.json")
}

pub fn load_announcements() -> Vec<AnnouncementItem> {
    let path = announcements_path();
    if !path.exists() {
        return Vec::new();
    }
    let raw = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn save_announcements(items: &[AnnouncementItem]) -> Result<()> {
    let path = announcements_path();
    std::fs::create_dir_all(path.parent().unwrap())?;
    let raw = serde_json::to_string_pretty(items).context("serialise announcements")?;
    std::fs::write(&path, raw).context("write announcements.json")
}

pub fn load_sermon_notes() -> Vec<SermonNote> {
    let path = sermon_notes_path();
    if !path.exists() {
        return Vec::new();
    }
    let raw = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn save_sermon_notes(notes: &[SermonNote]) -> Result<()> {
    let path = sermon_notes_path();
    std::fs::create_dir_all(path.parent().unwrap())?;
    let raw = serde_json::to_string_pretty(notes).context("serialise sermon notes")?;
    std::fs::write(&path, raw).context("write sermon_notes.json")
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn announcement_has_correct_kind() {
        let a = AnnouncementItem::new_announcement(
            "Welcome".into(),
            "Service starts at 10am".into(),
            None,
            None,
        );
        assert_eq!(a.kind, "announcement");
        assert!(!a.id.is_empty());
    }

    #[test]
    fn custom_slide_has_correct_kind() {
        let s = AnnouncementItem::new_custom_slide("Slide 1".into(), "Body".into(), None);
        assert_eq!(s.kind, "custom_slide");
    }

    #[test]
    fn sermon_note_stores_slides() {
        let n = SermonNote::new(
            "Grace Alone".into(),
            vec!["Point 1: Grace is free".into(), "Point 2: Grace is sufficient".into()],
        );
        assert_eq!(n.slides.len(), 2);
        assert!(!n.id.is_empty());
    }

    #[test]
    fn announcement_with_keyword_cue() {
        let a = AnnouncementItem::new_announcement(
            "Offering".into(),
            "Please give generously".into(),
            None,
            Some("offering time".into()),
        );
        assert_eq!(a.keyword_cue.as_deref(), Some("offering time"));
    }

    #[test]
    fn announcement_serialise_round_trip() {
        let a = AnnouncementItem::new_announcement(
            "Test".into(),
            "Body".into(),
            Some("https://example.com/img.jpg".into()),
            None,
        );
        let json = serde_json::to_string(&a).unwrap();
        let back: AnnouncementItem = serde_json::from_str(&json).unwrap();
        assert_eq!(back.title, "Test");
        assert_eq!(back.image_url.as_deref(), Some("https://example.com/img.jpg"));
    }
}
