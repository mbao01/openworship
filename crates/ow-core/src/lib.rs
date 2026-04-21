//! Core domain logic — scripture detection, content queue, detection modes.
//!
//! No Tauri or audio dependencies. Pure domain logic usable from any context.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

// ─── Detection mode ───────────────────────────────────────────────────────────

/// Controls how detected scripture references are routed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DetectionMode {
    /// Detected verse is pushed to the display immediately.
    Auto,
    /// Detected verse appears as a suggestion — operator must approve.
    #[default]
    Copilot,
    /// Detection runs but nothing is sent to the display.
    Airplane,
    /// Detection is disabled; mic may still be active.
    Offline,
}

// ─── Queue item ───────────────────────────────────────────────────────────────

/// Status of an item in the content queue.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QueueStatus {
    /// Waiting for operator approval (Copilot mode).
    Pending,
    /// Currently shown on the projection screen.
    Live,
    /// Dismissed by operator or superseded.
    Dismissed,
}

/// Content kind discriminant for queue items.
pub mod content_kind {
    pub const SCRIPTURE: &str = "scripture";
    pub const SONG: &str = "song";
    pub const ANNOUNCEMENT: &str = "announcement";
    pub const CUSTOM_SLIDE: &str = "custom_slide";
    pub const SERMON_NOTE: &str = "sermon_note";
    pub const COUNTDOWN: &str = "countdown";
}

fn default_kind() -> String {
    content_kind::SCRIPTURE.to_owned()
}

/// A single detected-and-looked-up content item in the queue.
///
/// Items may be scripture verses (kind = "scripture") or song lyrics
/// (kind = "song").  The `reference` field holds a verse reference or song
/// title; `translation` holds a translation abbreviation or artist name.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    /// Stable identifier for this item (hex string).
    pub id: String,
    /// Canonical reference, e.g. "John 3:16" or "Amazing Grace".
    pub reference: String,
    /// Full verse text or song lyrics.
    pub text: String,
    /// Translation abbreviation (scripture) or artist name (song).
    pub translation: String,
    /// Current status.
    pub status: QueueStatus,
    /// Unix timestamp (ms) when this item was detected.
    pub detected_at_ms: u64,
    /// True when this item was found via semantic similarity rather than exact
    /// reference matching.
    #[serde(default)]
    pub is_semantic: bool,
    /// Cosine similarity score (0.0–1.0) for semantic matches; `None` for
    /// exact matches.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    /// Content kind: "scripture" (default) or "song".
    #[serde(default = "default_kind")]
    pub kind: String,
    /// Song library ID — only set when `kind == "song"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub song_id: Option<i64>,
    /// Duration in seconds — only set when `kind == "countdown"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_secs: Option<u32>,
    /// Image URL — only set for `kind == "announcement"` or `"custom_slide"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    /// Sermon note ID — only set when `kind == "sermon_note"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note_id: Option<String>,
}

static ITEM_COUNTER: AtomicU64 = AtomicU64::new(0);

impl QueueItem {
    fn make_id() -> (String, u64) {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_micros() as u64;
        let count = ITEM_COUNTER.fetch_add(1, Ordering::Relaxed);
        (format!("{:016x}{:08x}", ts, count), ts / 1000)
    }

    pub fn new(reference: String, text: String, translation: String) -> Self {
        let (id, detected_at_ms) = Self::make_id();
        Self {
            id,
            reference,
            text,
            translation,
            status: QueueStatus::Pending,
            detected_at_ms,
            is_semantic: false,
            confidence: None,
            kind: default_kind(),
            song_id: None,
            duration_secs: None,
            image_url: None,
            note_id: None,
        }
    }

    /// Create a song lyric queue item.
    pub fn new_song(title: String, lyrics: String, artist: String, song_id: i64) -> Self {
        let (id, detected_at_ms) = Self::make_id();
        Self {
            id,
            reference: title,
            text: lyrics,
            translation: artist,
            status: QueueStatus::Pending,
            detected_at_ms,
            is_semantic: false,
            confidence: None,
            kind: content_kind::SONG.to_owned(),
            song_id: Some(song_id),
            duration_secs: None,
            image_url: None,
            note_id: None,
        }
    }

    /// Create an announcement queue item.
    pub fn new_announcement(title: String, body: String, image_url: Option<String>) -> Self {
        let (id, detected_at_ms) = Self::make_id();
        Self {
            id,
            reference: title,
            text: body,
            translation: String::new(),
            status: QueueStatus::Pending,
            detected_at_ms,
            is_semantic: false,
            confidence: None,
            kind: content_kind::ANNOUNCEMENT.to_owned(),
            song_id: None,
            duration_secs: None,
            image_url,
            note_id: None,
        }
    }

    /// Create a custom slide queue item.
    pub fn new_custom_slide(title: String, body: String, image_url: Option<String>) -> Self {
        let (id, detected_at_ms) = Self::make_id();
        Self {
            id,
            reference: title,
            text: body,
            translation: String::new(),
            status: QueueStatus::Pending,
            detected_at_ms,
            is_semantic: false,
            confidence: None,
            kind: content_kind::CUSTOM_SLIDE.to_owned(),
            song_id: None,
            duration_secs: None,
            image_url,
            note_id: None,
        }
    }

    /// Create a countdown timer queue item.
    pub fn new_countdown(title: String, duration_secs: u32) -> Self {
        let (id, detected_at_ms) = Self::make_id();
        Self {
            id,
            reference: title,
            text: String::new(),
            translation: String::new(),
            status: QueueStatus::Pending,
            detected_at_ms,
            is_semantic: false,
            confidence: None,
            kind: content_kind::COUNTDOWN.to_owned(),
            song_id: None,
            duration_secs: Some(duration_secs),
            image_url: None,
            note_id: None,
        }
    }

    /// Create a sermon note reference queue item.
    pub fn new_sermon_note_ref(title: String, note_id: String) -> Self {
        let (id, detected_at_ms) = Self::make_id();
        Self {
            id,
            reference: title,
            text: String::new(),
            translation: String::new(),
            status: QueueStatus::Pending,
            detected_at_ms,
            is_semantic: false,
            confidence: None,
            kind: content_kind::SERMON_NOTE.to_owned(),
            song_id: None,
            duration_secs: None,
            image_url: None,
            note_id: Some(note_id),
        }
    }
}

// ─── Song detector ────────────────────────────────────────────────────────────

/// A song that may have been referenced in transcript text.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongRef {
    pub id: i64,
    pub title: String,
}

/// Detects song titles (and opening lines) in running transcript text.
///
/// Built from the song library at startup and refreshed whenever songs are
/// added or removed.  Matches are case-insensitive, word-boundary anchored
/// to avoid partial false positives.
pub struct SongDetector {
    patterns: Vec<(i64, String, regex::Regex)>,
}

impl SongDetector {
    /// Build a detector from a list of `(id, title)` pairs.
    pub fn new(songs: &[SongRef]) -> Self {
        let patterns = Self::build(songs);
        Self { patterns }
    }

    fn build(songs: &[SongRef]) -> Vec<(i64, String, regex::Regex)> {
        songs
            .iter()
            .filter_map(|s| {
                // Require at least 5 chars to avoid trivially matching common words.
                if s.title.trim().len() < 5 {
                    return None;
                }
                let escaped = regex::escape(s.title.trim());
                // (?i) case-insensitive; \b word boundaries; allow extra
                // whitespace between words to handle transcript noise.
                let normalized = escaped.replace(r"\ ", r"\s+");
                let pat = format!(r"(?i)\b{normalized}\b");
                regex::Regex::new(&pat)
                    .ok()
                    .map(|re| (s.id, s.title.clone(), re))
            })
            .collect()
    }

    /// Rebuild patterns from a new song list (call when library changes).
    pub fn update(&mut self, songs: &[SongRef]) {
        self.patterns = Self::build(songs);
    }

    /// Return all songs whose title appears in `text`.
    pub fn detect(&self, text: &str) -> Vec<SongRef> {
        let mut found: Vec<SongRef> = Vec::new();
        for (id, title, re) in &self.patterns {
            if re.is_match(text) {
                found.push(SongRef { id: *id, title: title.clone() });
            }
        }
        found
    }

    /// True when no songs are loaded.
    pub fn is_empty(&self) -> bool {
        self.patterns.is_empty()
    }
}

impl Default for SongDetector {
    fn default() -> Self {
        Self::new(&[])
    }
}

// ─── Scripture detector ───────────────────────────────────────────────────────

/// Detects exact scripture references in running transcript text using regex.
///
/// Handles:
/// - Standard references: "John 3:16", "Romans 8:28", "1 Cor 13:1"
/// - Natural-speech references: "John chapter 3 verse 16"
/// - Chapter-only: "Psalm 23"
pub struct ScriptureDetector {
    pattern: regex::Regex,
}

impl ScriptureDetector {
    pub fn new() -> Self {
        let book_alt = build_book_alternation();
        // Match: BOOK optional("chapter") DIGITS optional(":DIGITS" | "verse DIGITS")
        let pat = format!(
            r"(?i)\b(?:{book_alt})\s+(?:chapter\s+)?(\d{{1,3}})(?:\s*:\s*(\d{{1,3}})|\s+verse\s+(\d{{1,3}}))?"
        );
        let pattern = regex::Regex::new(&pat).expect("invalid detection regex");
        Self { pattern }
    }

    /// Return all scripture reference strings found in `text`.
    ///
    /// Each returned string is normalised into `"Book C:V"` or `"Book C"` format,
    /// ready to be passed directly to `SearchEngine::search()`.
    pub fn detect(&self, text: &str) -> Vec<String> {
        self.pattern
            .captures_iter(text)
            .map(|cap| {
                let full = cap.get(0).unwrap().as_str();
                normalise_matched(full)
            })
            .collect()
    }
}

impl Default for ScriptureDetector {
    fn default() -> Self {
        Self::new()
    }
}

/// Normalise a raw matched string into `"Book C:V"` or `"Book C"` form.
///
/// "John chapter 3 verse 16" → "John 3:16"
/// "John 3:16"               → "John 3:16"
/// "Psalm 23"                → "Psalm 23"
fn normalise_matched(raw: &str) -> String {
    // "BOOK chapter N verse M"
    if let Some(s) = replace_chapter_verse(raw) {
        return s;
    }
    // "BOOK chapter N"
    if let Some(s) = replace_chapter_only(raw) {
        return s;
    }
    raw.to_string()
}

fn replace_chapter_verse(s: &str) -> Option<String> {
    // chapter N verse M
    let re = regex::Regex::new(r"(?i)^(.*?)\s+chapter\s+(\d+)\s+verse\s+(\d+)").ok()?;
    let cap = re.captures(s)?;
    Some(format!("{} {}:{}", cap[1].trim(), &cap[2], &cap[3]))
}

fn replace_chapter_only(s: &str) -> Option<String> {
    let re = regex::Regex::new(r"(?i)^(.*?)\s+chapter\s+(\d+)").ok()?;
    let cap = re.captures(s)?;
    Some(format!("{} {}", cap[1].trim(), &cap[2]))
}

/// Build the book-name alternation sorted longest-first so longer forms
/// (e.g. "Song of Solomon") are tried before shorter substrings ("Song").
fn build_book_alternation() -> String {
    // Ordered list: full names first, then abbreviations.
    // Multi-word book names with number prefixes are listed explicitly.
    let mut books: Vec<&str> = vec![
        // OT — full names
        "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
        "Joshua", "Judges", "Ruth",
        "1 Samuel", "2 Samuel",
        "1 Kings", "2 Kings",
        "1 Chronicles", "2 Chronicles",
        "Ezra", "Nehemiah", "Esther", "Job",
        "Psalms", "Psalm", "Proverbs", "Ecclesiastes",
        "Song of Solomon", "Song of Songs",
        "Isaiah", "Jeremiah", "Lamentations",
        "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
        "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
        "Zephaniah", "Haggai", "Zechariah", "Malachi",
        // OT — abbreviations
        "Gen", "Ex", "Exod", "Lev", "Num", "Deut", "Dt",
        "Josh", "Judg", "Jdg",
        "1 Sam", "2 Sam", "1Sam", "2Sam",
        "1 Kgs", "2 Kgs", "1Kgs", "2Kgs",
        "1 Chr", "2 Chr", "1Chr", "2Chr",
        "Neh", "Est",
        "Ps", "Psa", "Prov", "Eccl", "Song",
        "Isa", "Jer", "Lam", "Ezek", "Eze",
        "Dan", "Hos", "Obad",
        "Jon", "Mic", "Nah", "Hab", "Zeph", "Zep",
        "Hag", "Zech", "Zec", "Mal",
        // NT — full names
        "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
        "1 Corinthians", "2 Corinthians",
        "Galatians", "Ephesians", "Philippians", "Colossians",
        "1 Thessalonians", "2 Thessalonians",
        "1 Timothy", "2 Timothy",
        "Titus", "Philemon", "Hebrews", "James",
        "1 Peter", "2 Peter",
        "1 John", "2 John", "3 John",
        "Jude", "Revelation",
        // NT — abbreviations
        "Matt", "Mt", "Mk", "Lk", "Jn", "Joh",
        "Rom",
        "1 Cor", "2 Cor", "1Cor", "2Cor",
        "Gal", "Eph", "Phil", "Php", "Col",
        "1 Thess", "2 Thess", "1Thess", "2Thess",
        "1 Tim", "2 Tim", "1Tim", "2Tim",
        "Tit", "Phlm",
        "Heb", "Jas",
        "1 Pet", "2 Pet", "1Pet", "2Pet",
        "1 Jn", "2 Jn", "3 Jn", "1Jn", "2Jn", "3Jn",
        "Rev",
    ];

    // Sort longest-first to ensure greedy matching of full names.
    books.sort_by_key(|b| std::cmp::Reverse(b.len()));

    books
        .iter()
        .map(|s| regex::escape(s))
        .collect::<Vec<_>>()
        .join("|")
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn detector() -> ScriptureDetector {
        ScriptureDetector::new()
    }

    #[test]
    fn test_detects_standard_reference() {
        let d = detector();
        let refs = d.detect("We read John 3:16 today");
        assert_eq!(refs, vec!["John 3:16"]);
    }

    #[test]
    fn test_detects_natural_speech() {
        let d = detector();
        let refs = d.detect("turn to John chapter 3 verse 16 in your Bible");
        assert_eq!(refs, vec!["John 3:16"]);
    }

    #[test]
    fn test_detects_chapter_only() {
        let d = detector();
        let refs = d.detect("let's read Psalm 23 together");
        assert_eq!(refs, vec!["Psalm 23"]);
    }

    #[test]
    fn test_detects_numbered_book() {
        let d = detector();
        let refs = d.detect("1 Corinthians 13:1 says...");
        assert_eq!(refs, vec!["1 Corinthians 13:1"]);
    }

    #[test]
    fn test_detects_abbreviation() {
        let d = detector();
        let refs = d.detect("Rom 8:28 is a favourite");
        assert_eq!(refs, vec!["Rom 8:28"]);
    }

    #[test]
    fn test_detects_multiple_references() {
        let d = detector();
        let refs = d.detect("John 3:16 and Romans 8:28 are great");
        assert_eq!(refs.len(), 2);
        assert_eq!(refs[0], "John 3:16");
        assert_eq!(refs[1], "Romans 8:28");
    }

    #[test]
    fn test_no_false_positives_in_plain_text() {
        let d = detector();
        let refs = d.detect("today was a great day, God is good");
        assert!(refs.is_empty(), "expected no matches, got {:?}", refs);
    }

    #[test]
    fn test_queue_item_new_has_pending_status() {
        let item = QueueItem::new("John 3:16".into(), "For God so loved".into(), "KJV".into());
        assert_eq!(item.status, QueueStatus::Pending);
        assert!(!item.id.is_empty());
        assert_eq!(item.reference, "John 3:16");
    }

    #[test]
    fn test_detection_mode_default_is_copilot() {
        let mode = DetectionMode::default();
        assert_eq!(mode, DetectionMode::Copilot);
    }

    #[test]
    fn test_detection_mode_serializes() {
        let mode = DetectionMode::Auto;
        let json = serde_json::to_string(&mode).unwrap();
        assert_eq!(json, r#""auto""#);
    }

    #[test]
    fn test_detects_chapter_keyword() {
        let d = detector();
        let refs = d.detect("open your Bibles to Genesis chapter 1");
        assert_eq!(refs, vec!["Genesis 1"]);
    }

    // ── QueueItem tests ──────────────────────────────────────────────────

    #[test]
    fn queue_item_new_creates_with_pending_status() {
        let item = QueueItem::new("Psalm 23:1".into(), "The Lord is my shepherd".into(), "WEB".into());
        assert_eq!(item.status, QueueStatus::Pending);
        assert_eq!(item.reference, "Psalm 23:1");
        assert_eq!(item.translation, "WEB");
        assert!(!item.id.is_empty());
        assert!(!item.is_semantic);
        assert!(item.confidence.is_none());
        assert_eq!(item.kind, "scripture");
    }

    #[test]
    fn queue_item_new_generates_unique_ids() {
        let a = QueueItem::new("A".into(), "a".into(), "X".into());
        let b = QueueItem::new("B".into(), "b".into(), "X".into());
        assert_ne!(a.id, b.id);
    }

    #[test]
    fn queue_item_new_song_has_song_kind() {
        let item = QueueItem::new_song("Amazing Grace".into(), "lyrics".into(), "Newton".into(), 42);
        assert_eq!(item.kind, "song");
        assert_eq!(item.song_id, Some(42));
        assert_eq!(item.status, QueueStatus::Pending);
    }

    #[test]
    fn queue_item_new_announcement_has_correct_kind() {
        let item = QueueItem::new_announcement("Welcome".into(), "Hello all".into(), None);
        assert_eq!(item.kind, "announcement");
        assert!(item.image_url.is_none());
    }

    #[test]
    fn queue_item_new_countdown_has_duration() {
        let item = QueueItem::new_countdown("Intermission".into(), 300);
        assert_eq!(item.kind, "countdown");
        assert_eq!(item.duration_secs, Some(300));
    }

    // ── DetectionMode serde round-trip ───────────────────────────────────

    #[test]
    fn detection_mode_serde_round_trip() {
        for mode in [DetectionMode::Auto, DetectionMode::Copilot, DetectionMode::Airplane, DetectionMode::Offline] {
            let json = serde_json::to_string(&mode).unwrap();
            let back: DetectionMode = serde_json::from_str(&json).unwrap();
            assert_eq!(mode, back);
        }
    }

    #[test]
    fn detection_mode_serializes_as_lowercase() {
        assert_eq!(serde_json::to_string(&DetectionMode::Auto).unwrap(), r#""auto""#);
        assert_eq!(serde_json::to_string(&DetectionMode::Copilot).unwrap(), r#""copilot""#);
        assert_eq!(serde_json::to_string(&DetectionMode::Airplane).unwrap(), r#""airplane""#);
        assert_eq!(serde_json::to_string(&DetectionMode::Offline).unwrap(), r#""offline""#);
    }

    // ── QueueStatus variants ─────────────────────────────────────────────

    #[test]
    fn queue_status_serde_round_trip() {
        for status in [QueueStatus::Pending, QueueStatus::Live, QueueStatus::Dismissed] {
            let json = serde_json::to_string(&status).unwrap();
            let back: QueueStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(status, back);
        }
    }

    #[test]
    fn queue_status_serializes_as_lowercase() {
        assert_eq!(serde_json::to_string(&QueueStatus::Pending).unwrap(), r#""pending""#);
        assert_eq!(serde_json::to_string(&QueueStatus::Live).unwrap(), r#""live""#);
        assert_eq!(serde_json::to_string(&QueueStatus::Dismissed).unwrap(), r#""dismissed""#);
    }

    // ── SongDetector tests ───────────────────────────────────────────────

    #[test]
    fn song_detector_empty_is_empty() {
        let d = SongDetector::new(&[]);
        assert!(d.is_empty());
        assert!(d.detect("anything").is_empty());
    }

    #[test]
    fn song_detector_finds_title_in_text() {
        let songs = vec![SongRef { id: 1, title: "Amazing Grace".into() }];
        let d = SongDetector::new(&songs);
        let found = d.detect("We sang Amazing Grace today");
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].title, "Amazing Grace");
    }

    #[test]
    fn song_detector_ignores_short_titles() {
        let songs = vec![SongRef { id: 1, title: "Joy".into() }];
        let d = SongDetector::new(&songs);
        assert!(d.is_empty(), "titles < 5 chars should be filtered out");
    }
}
