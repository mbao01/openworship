//! Scripture reference parser for spoken/transcribed text.
//!
//! Handles patterns like:
//!   "John 3:16"
//!   "john chapter three verse sixteen"
//!   "Romans chapter 8 verse 28"
//!   "first Corinthians 13"
//!   "Genesis 1:1"
//!   "Psalms 23"

use once_cell::sync::Lazy;
use regex::Regex;

/// A parsed scripture reference.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ScriptureRef {
    pub book: String,
    pub chapter: u32,
    pub verse: Option<u32>,
}

impl ScriptureRef {
    /// Returns a display string, e.g. "John 3:16" or "Psalms 23".
    pub fn display(&self) -> String {
        match self.verse {
            Some(v) => format!("{} {}:{}", self.book, self.chapter, v),
            None => format!("{} {}", self.book, self.chapter),
        }
    }

    /// Returns the Tantivy query string for this reference (used by SearchEngine).
    pub fn query(&self) -> String {
        self.display()
    }
}

// ── Number word tables ──────────────────────────────────────────────────────

fn word_to_num(w: &str) -> Option<u32> {
    match w.to_lowercase().as_str() {
        "one" | "first" | "1st" => Some(1),
        "two" | "second" | "2nd" => Some(2),
        "three" | "third" | "3rd" => Some(3),
        "four" | "fourth" | "4th" => Some(4),
        "five" | "fifth" | "5th" => Some(5),
        "six" | "sixth" | "6th" => Some(6),
        "seven" | "seventh" | "7th" => Some(7),
        "eight" | "eighth" | "8th" => Some(8),
        "nine" | "ninth" | "9th" => Some(9),
        "ten" | "tenth" | "10th" => Some(10),
        "eleven" | "eleventh" => Some(11),
        "twelve" | "twelfth" => Some(12),
        "thirteen" | "thirteenth" => Some(13),
        "fourteen" | "fourteenth" => Some(14),
        "fifteen" | "fifteenth" => Some(15),
        "sixteen" | "sixteenth" => Some(16),
        "seventeen" | "seventeenth" => Some(17),
        "eighteen" | "eighteenth" => Some(18),
        "nineteen" | "nineteenth" => Some(19),
        "twenty" | "twentieth" => Some(20),
        "twenty-one" | "twenty one" | "twenty first" => Some(21),
        "twenty-two" | "twenty two" | "twenty second" => Some(22),
        "twenty-three" | "twenty three" | "twenty third" => Some(23),
        "twenty-four" | "twenty four" | "twenty fourth" => Some(24),
        "twenty-five" | "twenty five" | "twenty fifth" => Some(25),
        "twenty-six" | "twenty six" | "twenty sixth" => Some(26),
        "twenty-seven" | "twenty seven" | "twenty seventh" => Some(27),
        "twenty-eight" | "twenty eight" | "twenty eighth" => Some(28),
        "twenty-nine" | "twenty nine" | "twenty ninth" => Some(29),
        "thirty" | "thirtieth" => Some(30),
        "thirty-one" | "thirty one" | "thirty first" => Some(31),
        "forty" | "fortieth" => Some(40),
        "fifty" | "fiftieth" => Some(50),
        _ => None,
    }
}

/// Parse a string token as a chapter/verse number (digit string or word).
fn parse_num(s: &str) -> Option<u32> {
    s.parse::<u32>().ok().or_else(|| word_to_num(s))
}

// ── Book alias table ────────────────────────────────────────────────────────

/// Normalise a spoken/written book name to its canonical form.
/// Returns `None` if unrecognised.
pub fn normalize_book(raw: &str) -> Option<&'static str> {
    // Strip leading ordinal prefix for numbered books: "first john" -> ("1", "john")
    let lower = raw.trim().to_lowercase();
    let (ordinal, rest) = match lower.as_str() {
        s if s.starts_with("first ") || s.starts_with("1st ") => {
            (Some("1"), &s[s.find(' ').unwrap() + 1..])
        }
        s if s.starts_with("second ") || s.starts_with("2nd ") => {
            (Some("2"), &s[s.find(' ').unwrap() + 1..])
        }
        s if s.starts_with("third ") || s.starts_with("3rd ") => {
            (Some("3"), &s[s.find(' ').unwrap() + 1..])
        }
        _ => (None, lower.as_str()),
    };

    let key: String = if let Some(ord) = ordinal {
        format!("{} {}", ord, rest)
    } else {
        lower.clone()
    };

    match key.as_str() {
        // Old Testament
        "gen" | "genesis" => Some("Genesis"),
        "exo" | "exod" | "exodus" => Some("Exodus"),
        "lev" | "leviticus" => Some("Leviticus"),
        "num" | "numbers" => Some("Numbers"),
        "deut" | "deu" | "deuteronomy" => Some("Deuteronomy"),
        "josh" | "joshua" => Some("Joshua"),
        "judg" | "judges" => Some("Judges"),
        "ruth" => Some("Ruth"),
        "1 sam" | "1 samuel" => Some("1 Samuel"),
        "2 sam" | "2 samuel" => Some("2 Samuel"),
        "1 kgs" | "1 kings" => Some("1 Kings"),
        "2 kgs" | "2 kings" => Some("2 Kings"),
        "1 chr" | "1 chron" | "1 chronicles" => Some("1 Chronicles"),
        "2 chr" | "2 chron" | "2 chronicles" => Some("2 Chronicles"),
        "ezra" => Some("Ezra"),
        "neh" | "nehemiah" => Some("Nehemiah"),
        "esth" | "esther" => Some("Esther"),
        "job" => Some("Job"),
        "ps" | "psa" | "psalm" | "psalms" => Some("Psalms"),
        "prov" | "pro" | "proverbs" => Some("Proverbs"),
        "eccl" | "ecc" | "ecclesiastes" => Some("Ecclesiastes"),
        "song" | "sos" | "song of solomon" | "song of songs" => Some("Song of Solomon"),
        "isa" | "isaiah" => Some("Isaiah"),
        "jer" | "jeremiah" => Some("Jeremiah"),
        "lam" | "lamentations" => Some("Lamentations"),
        "ezek" | "eze" | "ezekiel" => Some("Ezekiel"),
        "dan" | "daniel" => Some("Daniel"),
        "hos" | "hosea" => Some("Hosea"),
        "joel" => Some("Joel"),
        "amos" => Some("Amos"),
        "obad" | "obadiah" => Some("Obadiah"),
        "jonah" | "jon" => Some("Jonah"),
        "mic" | "micah" => Some("Micah"),
        "nah" | "nahum" => Some("Nahum"),
        "hab" | "habakkuk" => Some("Habakkuk"),
        "zeph" | "zephaniah" => Some("Zephaniah"),
        "hag" | "haggai" => Some("Haggai"),
        "zech" | "zechariah" => Some("Zechariah"),
        "mal" | "malachi" => Some("Malachi"),
        // New Testament
        "matt" | "mat" | "matthew" => Some("Matthew"),
        "mk" | "mar" | "mark" => Some("Mark"),
        "lk" | "luk" | "luke" => Some("Luke"),
        "jn" | "joh" | "john" => Some("John"),
        "acts" | "act" => Some("Acts"),
        "rom" | "romans" => Some("Romans"),
        "1 cor" | "1 corinthians" => Some("1 Corinthians"),
        "2 cor" | "2 corinthians" => Some("2 Corinthians"),
        "gal" | "galatians" => Some("Galatians"),
        "eph" | "ephesians" => Some("Ephesians"),
        "phil" | "php" | "philippians" => Some("Philippians"),
        "col" | "colossians" => Some("Colossians"),
        "1 thess" | "1 thessalonians" => Some("1 Thessalonians"),
        "2 thess" | "2 thessalonians" => Some("2 Thessalonians"),
        "1 tim" | "1 timothy" => Some("1 Timothy"),
        "2 tim" | "2 timothy" => Some("2 Timothy"),
        "tit" | "titus" => Some("Titus"),
        "philem" | "phlm" | "philemon" => Some("Philemon"),
        "heb" | "hebrews" => Some("Hebrews"),
        "jas" | "james" => Some("James"),
        "1 pet" | "1 peter" => Some("1 Peter"),
        "2 pet" | "2 peter" => Some("2 Peter"),
        "1 jn" | "1 joh" | "1 john" => Some("1 John"),
        "2 jn" | "2 joh" | "2 john" => Some("2 John"),
        "3 jn" | "3 joh" | "3 john" => Some("3 John"),
        "jude" => Some("Jude"),
        "rev" | "revelation" | "revelations" => Some("Revelation"),
        _ => None,
    }
}

// ── Regex patterns ──────────────────────────────────────────────────────────

// Book name pattern: optional ordinal prefix + one word.
// Single-word form is intentional: greedy two-word forms (e.g. "read John") would
// consume valid book positions.  "Song of Solomon" works via the single alias "song".
// Numbered books use spoken ordinals: "first john", "2nd kings", etc.
const BOOK_PAT: &str =
    r"(?:(?:first|second|third|1st|2nd|3rd)\s+)?[a-z]+";

/// Matches: "John 3:16", "john 3:16", "Romans 8:28"
static RE_COLON: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"(?i)\b({BOOK_PAT})\s+(\d+):(\d+)\b",
    ))
    .unwrap()
});

/// Matches: "John 3", "Psalms 23", "Romans 8" (chapter only, no verse).
static RE_CHAPTER: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"(?i)\b({BOOK_PAT})\s+(\d+)\b",
    ))
    .unwrap()
});

/// Matches: "John chapter 3 verse 16", "Romans chapter eight verse twenty-eight".
/// `(\w+(?:[-\s]\w+)?)` captures compound numbers like "twenty-eight" or "twenty eight".
static RE_SPOKEN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"(?i)\b({BOOK_PAT})\s+chapter\s+(\w+(?:[-\s]\w+)?)\s+verse\s+(\w+(?:[-\s]\w+)?)\b",
    ))
    .unwrap()
});

/// Matches: "John chapter 3" or "Psalms chapter twenty three" (chapter only, spoken).
static RE_SPOKEN_CHAPTER: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"(?i)\b({BOOK_PAT})\s+chapter\s+(\w+(?:[-\s]\w+)?)\b",
    ))
    .unwrap()
});

/// Matches: "first Corinthians thirteen" — spoken number without "chapter" keyword.
/// Number words are enumerated explicitly to avoid false positives.
static RE_WORD_CHAPTER: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"(?i)\b({BOOK_PAT})\s+(twenty[-\s](?:one|two|three|four|five|six|seven|eight|nine)|thirty[-\s](?:one|two|three|four|five|six|seven|eight|nine)|forty[-\s](?:one|two|three|four|five|six|seven|eight|nine)|twenty|thirty|forty|fifty|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b",
    ))
    .unwrap()
});

// ── Public API ──────────────────────────────────────────────────────────────

/// Parse all scripture references from a transcript snippet.
/// Returns deduplicated results preserving first-occurrence order.
pub fn parse_refs(text: &str) -> Vec<ScriptureRef> {
    let mut results: Vec<ScriptureRef> = Vec::new();

    // Pass 1: "Book chapter N verse M" spoken form (highest priority, longest match)
    for cap in RE_SPOKEN.captures_iter(text) {
        let book_raw = &cap[1];
        let ch_raw = &cap[2];
        let v_raw = &cap[3];
        if let Some(book) = normalize_book(book_raw) {
            if let (Some(ch), Some(v)) = (parse_num(ch_raw.trim()), parse_num(v_raw.trim())) {
                push_dedup(
                    &mut results,
                    ScriptureRef { book: book.to_string(), chapter: ch, verse: Some(v) },
                );
            }
        }
    }

    // Pass 2: "Book chapter N" spoken form
    for cap in RE_SPOKEN_CHAPTER.captures_iter(text) {
        let book_raw = &cap[1];
        let ch_raw = &cap[2];
        if let Some(book) = normalize_book(book_raw) {
            if let Some(ch) = parse_num(ch_raw.trim()) {
                push_dedup(
                    &mut results,
                    ScriptureRef { book: book.to_string(), chapter: ch, verse: None },
                );
            }
        }
    }

    // Pass 3: "Book N:M" colon form
    for cap in RE_COLON.captures_iter(text) {
        let book_raw = &cap[1];
        let ch_raw = &cap[2];
        let v_raw = &cap[3];
        if let Some(book) = normalize_book(book_raw) {
            if let (Ok(ch), Ok(v)) = (ch_raw.parse::<u32>(), v_raw.parse::<u32>()) {
                push_dedup(
                    &mut results,
                    ScriptureRef { book: book.to_string(), chapter: ch, verse: Some(v) },
                );
            }
        }
    }

    // Pass 4: "Book N" chapter-only form (lowest priority)
    for cap in RE_CHAPTER.captures_iter(text) {
        let book_raw = &cap[1];
        let ch_raw = &cap[2];
        if let Some(book) = normalize_book(book_raw) {
            if let Ok(ch) = ch_raw.parse::<u32>() {
                push_dedup(
                    &mut results,
                    ScriptureRef { book: book.to_string(), chapter: ch, verse: None },
                );
            }
        }
    }

    // Pass 5: "Book word-number" — spoken number without "chapter" keyword
    // e.g. "first Corinthians thirteen"
    for cap in RE_WORD_CHAPTER.captures_iter(text) {
        let book_raw = cap[1].trim();
        let ch_raw = cap[2].trim();
        if let Some(book) = normalize_book(book_raw) {
            if let Some(ch) = parse_num(ch_raw) {
                push_dedup(
                    &mut results,
                    ScriptureRef { book: book.to_string(), chapter: ch, verse: None },
                );
            }
        }
    }

    results
}

fn push_dedup(v: &mut Vec<ScriptureRef>, r: ScriptureRef) {
    // Exact duplicate → skip.
    if v.contains(&r) {
        return;
    }
    // Chapter-only ref → skip if a more specific (verse-level) ref for the same
    // book+chapter already exists.  Prevents "John 3" from shadowing "John 3:16".
    if r.verse.is_none() && v.iter().any(|e| e.book == r.book && e.chapter == r.chapter) {
        return;
    }
    v.push(r);
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_colon_form() {
        let refs = parse_refs("The pastor read John 3:16 today.");
        assert_eq!(refs.len(), 1);
        assert_eq!(refs[0].book, "John");
        assert_eq!(refs[0].chapter, 3);
        assert_eq!(refs[0].verse, Some(16));
    }

    #[test]
    fn test_spoken_form() {
        let refs = parse_refs("Turn to Romans chapter eight verse twenty-eight");
        assert_eq!(refs.len(), 1);
        assert_eq!(refs[0].book, "Romans");
        assert_eq!(refs[0].chapter, 8);
        assert_eq!(refs[0].verse, Some(28));
    }

    #[test]
    fn test_spoken_chapter_only() {
        let refs = parse_refs("open to Psalms chapter twenty three");
        assert_eq!(refs[0].book, "Psalms");
        assert_eq!(refs[0].chapter, 23);
        assert_eq!(refs[0].verse, None);
    }

    #[test]
    fn test_numeric_chapter_only() {
        let refs = parse_refs("read Isaiah 40");
        assert_eq!(refs[0].book, "Isaiah");
        assert_eq!(refs[0].chapter, 40);
        assert_eq!(refs[0].verse, None);
    }

    #[test]
    fn test_ordinal_book() {
        let refs = parse_refs("first Corinthians thirteen");
        // spoken chapter form
        assert_eq!(refs[0].book, "1 Corinthians");
        assert_eq!(refs[0].chapter, 13);
    }

    #[test]
    fn test_multiple_refs() {
        let refs = parse_refs("John 3:16 and Romans 8:28 are both great verses");
        assert_eq!(refs.len(), 2);
        assert_eq!(refs[0].book, "John");
        assert_eq!(refs[1].book, "Romans");
    }

    #[test]
    fn test_dedup() {
        let refs = parse_refs("John 3:16 ... as John 3:16 says");
        assert_eq!(refs.len(), 1);
    }

    #[test]
    fn test_no_match() {
        let refs = parse_refs("the weather today is really nice");
        assert!(refs.is_empty());
    }

    #[test]
    fn test_normalize_book_aliases() {
        assert_eq!(normalize_book("jn"), Some("John"));
        assert_eq!(normalize_book("ps"), Some("Psalms"));
        assert_eq!(normalize_book("rev"), Some("Revelation"));
        assert_eq!(normalize_book("1 cor"), Some("1 Corinthians"));
        assert_eq!(normalize_book("nonsense"), None);
    }

    #[test]
    fn test_genesis_colon() {
        let refs = parse_refs("Genesis 1:1 in the beginning");
        assert_eq!(refs[0], ScriptureRef { book: "Genesis".into(), chapter: 1, verse: Some(1) });
    }
}
