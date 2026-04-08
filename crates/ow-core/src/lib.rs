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

/// A single detected-and-looked-up scripture verse in the content queue.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    /// Stable identifier for this item (hex string).
    pub id: String,
    /// Canonical reference, e.g. "John 3:16".
    pub reference: String,
    /// Full verse text.
    pub text: String,
    /// Translation abbreviation, e.g. "KJV".
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
}

static ITEM_COUNTER: AtomicU64 = AtomicU64::new(0);

impl QueueItem {
    pub fn new(reference: String, text: String, translation: String) -> Self {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_micros() as u64;
        let count = ITEM_COUNTER.fetch_add(1, Ordering::Relaxed);
        let id = format!("{:016x}{:08x}", ts, count);
        let detected_at_ms = ts / 1000;
        Self {
            id,
            reference,
            text,
            translation,
            status: QueueStatus::Pending,
            detected_at_ms,
            is_semantic: false,
            confidence: None,
        }
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
}
