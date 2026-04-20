// Tantivy-backed scripture search index.
// In-memory index built from the Bible DB on startup.
// Supports reference lookup ("John 3:16") and free-text keyword search.

use anyhow::{Context, Result};
use ow_db::Verse;
use serde::{Deserialize, Serialize};
use tantivy::{
    collector::TopDocs,
    query::{BooleanQuery, Occur, QueryParser, RangeQuery, TermQuery},
    schema::{
        Field, IndexRecordOption, OwnedValue, Schema, SchemaBuilder, Value, FAST, INDEXED, STORED,
        STRING, TEXT,
    },
    Index, IndexReader, ReloadPolicy, TantivyDocument, Term,
};

// ─────────────────────────────────────────
// Output type
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerseResult {
    pub translation: String,
    pub book: String,
    pub chapter: u32,
    pub verse: u32,
    pub text: String,
    pub reference: String,
    /// Normalized relevance score [0.0–1.0]. 1.0 for exact reference lookups;
    /// Tantivy BM25 score scaled to this range for keyword/FTS searches.
    #[serde(default)]
    pub score: f32,
}

// ─────────────────────────────────────────
// Field handles
// ─────────────────────────────────────────

struct Fields {
    translation: Field,
    book: Field,
    #[allow(dead_code)]
    book_number: Field,
    chapter: Field,
    verse: Field,
    text: Field,
    reference: Field,
}

// ─────────────────────────────────────────
// SearchEngine
// ─────────────────────────────────────────

pub struct SearchEngine {
    reader: IndexReader,
    index: Index,
    fields: Fields,
}

impl SearchEngine {
    /// Build an in-memory Tantivy index from the supplied verse list.
    pub fn build(verses: &[Verse]) -> Result<Self> {
        let (schema, fields) = build_schema();
        let index = Index::create_in_ram(schema);

        {
            let mut writer = index
                .writer(50_000_000)
                .context("failed to create index writer")?;

            for v in verses {
                let doc = tantivy::doc!(
                    fields.translation => v.translation.as_str(),
                    fields.book        => v.book.as_str(),
                    fields.book_number => v.book_number as u64,
                    fields.chapter     => v.chapter as u64,
                    fields.verse       => v.verse as u64,
                    fields.text        => v.text.as_str(),
                    fields.reference   => v.reference.as_str()
                );
                writer.add_document(doc)?;
            }
            writer.commit()?;
        }

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::Manual)
            .try_into()
            .context("failed to build index reader")?;

        Ok(Self { reader, index, fields })
    }

    /// Search for a verse range (e.g. "Romans 8:38-39").
    /// Returns all verses matching book + chapter where verse >= start AND verse <= end.
    /// When `translation` is Some, results are filtered to that abbreviation.
    pub fn search_range(
        &self,
        book: &str,
        chapter: u32,
        start_verse: u32,
        end_verse: u32,
        translation: Option<&str>,
    ) -> Result<Vec<VerseResult>> {
        let searcher = self.reader.searcher();

        let mut must: Vec<(Occur, Box<dyn tantivy::query::Query>)> = vec![
            (
                Occur::Must,
                Box::new(TermQuery::new(
                    Term::from_field_text(self.fields.book, book),
                    IndexRecordOption::Basic,
                )),
            ),
            (
                Occur::Must,
                Box::new(TermQuery::new(
                    Term::from_field_u64(self.fields.chapter, chapter as u64),
                    IndexRecordOption::Basic,
                )),
            ),
            (
                Occur::Must,
                Box::new(RangeQuery::new_u64(
                    "verse".to_string(),
                    start_verse as u64..(end_verse as u64 + 1),
                )),
            ),
        ];

        if let Some(t) = translation {
            must.push((
                Occur::Must,
                Box::new(TermQuery::new(
                    Term::from_field_text(self.fields.translation, t),
                    IndexRecordOption::Basic,
                )),
            ));
        }

        let query = BooleanQuery::new(must);
        // Use a generous limit — a range like 1-176 (Psalm 119) should still work.
        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(200))
            .context("range search failed")?;

        let mut results = Vec::new();
        for (_score, addr) in top_docs {
            let doc: TantivyDocument = searcher.doc(addr)?;
            let get_str = |f: Field| {
                doc.get_first(f)
                    .and_then(|v: &OwnedValue| v.as_str())
                    .unwrap_or("")
                    .to_string()
            };
            let get_u64 = |f: Field| {
                doc.get_first(f)
                    .and_then(|v: &OwnedValue| v.as_u64())
                    .unwrap_or(0) as u32
            };
            results.push(VerseResult {
                translation: get_str(self.fields.translation),
                book: get_str(self.fields.book),
                chapter: get_u64(self.fields.chapter),
                verse: get_u64(self.fields.verse),
                text: get_str(self.fields.text),
                reference: get_str(self.fields.reference),
                score: 1.0,
            });
        }

        // Sort by verse number for consistent ordering.
        results.sort_by_key(|r| r.verse);

        Ok(results)
    }

    /// Search by scripture reference (e.g. "John 3:16") or free-text keywords.
    /// When `translation` is Some, results are filtered to that abbreviation.
    pub fn search(
        &self,
        query: &str,
        translation: Option<&str>,
        limit: usize,
    ) -> Result<Vec<VerseResult>> {
        if limit == 0 {
            return Ok(vec![]);
        }
        let searcher = self.reader.searcher();
        let q = query.trim();

        let base_query: Box<dyn tantivy::query::Query> =
            if let Some((book, chapter, verse_opt)) = parse_reference(q) {
                // ── Exact reference lookup ──────────────────────────
                let mut must: Vec<(Occur, Box<dyn tantivy::query::Query>)> = vec![
                    (
                        Occur::Must,
                        Box::new(TermQuery::new(
                            Term::from_field_text(self.fields.book, &book),
                            IndexRecordOption::Basic,
                        )),
                    ),
                    (
                        Occur::Must,
                        Box::new(TermQuery::new(
                            Term::from_field_u64(self.fields.chapter, chapter as u64),
                            IndexRecordOption::Basic,
                        )),
                    ),
                ];
                if let Some(v) = verse_opt {
                    must.push((
                        Occur::Must,
                        Box::new(TermQuery::new(
                            Term::from_field_u64(self.fields.verse, v as u64),
                            IndexRecordOption::Basic,
                        )),
                    ));
                }
                Box::new(BooleanQuery::new(must))
            } else {
                // ── Free-text search ────────────────────────────────
                let parser = QueryParser::for_index(&self.index, vec![self.fields.text]);
                match parser.parse_query(q) {
                    Ok(parsed) => parsed,
                    Err(_) => parser.parse_query_lenient(q).0,
                }
            };

        // Optionally filter by translation
        let final_query: Box<dyn tantivy::query::Query> = if let Some(t) = translation {
            let t_query = Box::new(TermQuery::new(
                Term::from_field_text(self.fields.translation, t),
                IndexRecordOption::Basic,
            ));
            Box::new(BooleanQuery::new(vec![
                (Occur::Must, base_query),
                (Occur::Must, t_query),
            ]))
        } else {
            base_query
        };

        let top_docs = searcher
            .search(&final_query, &TopDocs::with_limit(limit))
            .context("search failed")?;

        // Collect raw scores to normalise against the max in this result set.
        // Use EPSILON floor so the top result always scores 1.0, even when BM25
        // returns weak scores (e.g. short corpus or single-result sets).
        let raw: Vec<(f32, _)> = top_docs.into_iter().collect();
        let max_score = raw.iter().map(|(s, _)| *s).fold(0.0_f32, f32::max).max(f32::EPSILON);

        let mut results = Vec::with_capacity(raw.len());
        for (raw_score, addr) in raw {
            let doc: TantivyDocument = searcher.doc(addr)?;
            let get_str = |f: Field| {
                doc.get_first(f)
                    .and_then(|v: &OwnedValue| v.as_str())
                    .unwrap_or("")
                    .to_string()
            };
            let get_u64 = |f: Field| {
                doc.get_first(f)
                    .and_then(|v: &OwnedValue| v.as_u64())
                    .unwrap_or(0) as u32
            };
            results.push(VerseResult {
                translation: get_str(self.fields.translation),
                book: get_str(self.fields.book),
                chapter: get_u64(self.fields.chapter),
                verse: get_u64(self.fields.verse),
                text: get_str(self.fields.text),
                reference: get_str(self.fields.reference),
                score: (raw_score / max_score).clamp(0.0, 1.0),
            });
        }
        Ok(results)
    }
}

// ─────────────────────────────────────────
// Schema builder
// ─────────────────────────────────────────

fn build_schema() -> (Schema, Fields) {
    let mut b = SchemaBuilder::new();
    let translation = b.add_text_field("translation", STRING | STORED);
    let book = b.add_text_field("book", STRING | STORED);
    let book_number = b.add_u64_field("book_number", FAST);
    let chapter = b.add_u64_field("chapter", FAST | INDEXED | STORED);
    let verse = b.add_u64_field("verse", FAST | INDEXED | STORED);
    let text = b.add_text_field("text", TEXT | STORED);
    let reference = b.add_text_field("reference", STORED);
    let schema = b.build();
    (schema, Fields { translation, book, book_number, chapter, verse, text, reference })
}

// ─────────────────────────────────────────
// Reference parser
// "John 3:16"  → ("John", 3, Some(16))
// "Psalm 23"   → ("Psalms", 23, None)
// "1 Cor 13:1" → ("1 Corinthians", 13, Some(1))
// ─────────────────────────────────────────

/// Try to parse a verse range like "Romans 8:38-39" or "1 John 3:16-18".
/// Returns `(canonical_book, chapter, start_verse, end_verse)` on success.
pub fn parse_range_reference(query: &str) -> Option<(String, u32, u32, u32)> {
    let q = query.trim();

    // Look for "Book Chapter:StartVerse-EndVerse"
    // The dash can be ASCII hyphen, en-dash, or em-dash.
    if let Some(colon) = q.rfind(':') {
        let after_colon = q[colon + 1..].trim();
        // Try to split on dash variants (-, \u{2013}, \u{2014})
        let dash_pos = after_colon
            .find('-')
            .or_else(|| after_colon.find('\u{2013}'))
            .or_else(|| after_colon.find('\u{2014}'));
        if let Some(dp) = dash_pos {
            let start_str = after_colon[..dp].trim();
            // The dash char may be multi-byte; find the next char boundary after dp.
            let dash_char = after_colon[dp..].chars().next().unwrap();
            let end_str = after_colon[dp + dash_char.len_utf8()..].trim();
            if let (Ok(start_v), Ok(end_v)) = (start_str.parse::<u32>(), end_str.parse::<u32>()) {
                if start_v > 0 && end_v > 0 && end_v >= start_v {
                    let rest = q[..colon].trim();
                    if let Some(sp) = rest.rfind(' ') {
                        let chapter_str = &rest[sp + 1..];
                        if let Ok(chapter) = chapter_str.parse::<u32>() {
                            let raw_book = rest[..sp].trim();
                            if let Some(book) = normalize_book(raw_book) {
                                return Some((book, chapter, start_v, end_v));
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

fn parse_reference(query: &str) -> Option<(String, u32, Option<u32>)> {
    let q = query.trim();

    // Try "Book Chapter:Verse"
    if let Some(colon) = q.rfind(':') {
        let verse_str = q[colon + 1..].trim();
        if let Ok(verse) = verse_str.parse::<u32>() {
            let rest = q[..colon].trim();
            if let Some(sp) = rest.rfind(' ') {
                let chapter_str = &rest[sp + 1..];
                if let Ok(chapter) = chapter_str.parse::<u32>() {
                    let raw_book = rest[..sp].trim();
                    if let Some(book) = normalize_book(raw_book) {
                        return Some((book, chapter, Some(verse)));
                    }
                }
            }
        }
    }

    // Try "Book Chapter"
    if let Some(sp) = q.rfind(' ') {
        let chapter_str = &q[sp + 1..];
        if let Ok(chapter) = chapter_str.parse::<u32>() {
            let raw_book = q[..sp].trim();
            if let Some(book) = normalize_book(raw_book) {
                return Some((book, chapter, None));
            }
        }
    }

    None
}

fn normalize_book(name: &str) -> Option<String> {
    let key = name.trim().to_lowercase();
    let canonical = match key.as_str() {
        // Old Testament
        "gen" | "genesis" => "Genesis",
        "exo" | "exod" | "exodus" => "Exodus",
        "lev" | "leviticus" => "Leviticus",
        "num" | "numbers" => "Numbers",
        "deu" | "deut" | "deuteronomy" => "Deuteronomy",
        "jos" | "josh" | "joshua" => "Joshua",
        "jdg" | "judg" | "judges" => "Judges",
        "rut" | "ruth" => "Ruth",
        "1 sam" | "1sam" | "1 samuel" | "1samuel" => "1 Samuel",
        "2 sam" | "2sam" | "2 samuel" | "2samuel" => "2 Samuel",
        "1 ki" | "1ki" | "1 kgs" | "1kgs" | "1 kings" | "1kings" => "1 Kings",
        "2 ki" | "2ki" | "2 kgs" | "2kgs" | "2 kings" | "2kings" => "2 Kings",
        "1 chr" | "1chr" | "1 chron" | "1chron" | "1 chronicles" | "1chronicles" => {
            "1 Chronicles"
        }
        "2 chr" | "2chr" | "2 chron" | "2chron" | "2 chronicles" | "2chronicles" => {
            "2 Chronicles"
        }
        "ezr" | "ezra" => "Ezra",
        "neh" | "nehemiah" => "Nehemiah",
        "est" | "esth" | "esther" => "Esther",
        "job" => "Job",
        "ps" | "psa" | "psalm" | "psalms" => "Psalms",
        "pro" | "prov" | "proverbs" => "Proverbs",
        "ecc" | "eccl" | "ecclesiastes" => "Ecclesiastes",
        "sng" | "song" | "sos" | "song of solomon" | "song of songs" => "Song of Solomon",
        "isa" | "isaiah" => "Isaiah",
        "jer" | "jeremiah" => "Jeremiah",
        "lam" | "lamentations" => "Lamentations",
        "ezk" | "ezek" | "ezekiel" => "Ezekiel",
        "dan" | "daniel" => "Daniel",
        "hos" | "hosea" => "Hosea",
        "joe" | "joel" => "Joel",
        "amo" | "amos" => "Amos",
        "oba" | "obad" | "obadiah" => "Obadiah",
        "jon" | "jonah" => "Jonah",
        "mic" | "micah" => "Micah",
        "nah" | "nahum" => "Nahum",
        "hab" | "habakkuk" => "Habakkuk",
        "zep" | "zeph" | "zephaniah" => "Zephaniah",
        "hag" | "haggai" => "Haggai",
        "zec" | "zech" | "zechariah" => "Zechariah",
        "mal" | "malachi" => "Malachi",
        // New Testament
        "matt" | "mat" | "matthew" => "Matthew",
        "mk" | "mar" | "mark" => "Mark",
        "lk" | "luk" | "luke" => "Luke",
        "jn" | "joh" | "john" => "John",
        "acts" => "Acts",
        "rom" | "romans" => "Romans",
        "1 cor" | "1cor" | "1 corinthians" | "1corinthians" => "1 Corinthians",
        "2 cor" | "2cor" | "2 corinthians" | "2corinthians" => "2 Corinthians",
        "gal" | "galatians" => "Galatians",
        "eph" | "ephesians" => "Ephesians",
        "phil" | "php" | "philippians" => "Philippians",
        "col" | "colossians" => "Colossians",
        "1 thes" | "1thes" | "1 thess" | "1thess" | "1 thessalonians" | "1thessalonians" => {
            "1 Thessalonians"
        }
        "2 thes" | "2thes" | "2 thess" | "2thess" | "2 thessalonians" | "2thessalonians" => {
            "2 Thessalonians"
        }
        "1 tim" | "1tim" | "1 timothy" | "1timothy" => "1 Timothy",
        "2 tim" | "2tim" | "2 timothy" | "2timothy" => "2 Timothy",
        "tit" | "titus" => "Titus",
        "phm" | "phlm" | "philemon" => "Philemon",
        "heb" | "hebrews" => "Hebrews",
        "jas" | "jam" | "james" => "James",
        "1 pet" | "1pet" | "1 peter" | "1peter" => "1 Peter",
        "2 pet" | "2pet" | "2 peter" | "2peter" => "2 Peter",
        "1 jn" | "1jn" | "1 john" | "1john" => "1 John",
        "2 jn" | "2jn" | "2 john" | "2john" => "2 John",
        "3 jn" | "3jn" | "3 john" | "3john" => "3 John",
        "jud" | "jude" => "Jude",
        "rev" | "revelation" => "Revelation",
        _ => return None,
    };
    Some(canonical.to_string())
}

// ─────────────────────────────────────────
// Tests
// ─────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::LazyLock;

    /// Shared search engine for all tests — built once, reused across all test
    /// functions in this module. Cuts test time from ~174s to ~5s.
    static ENGINE: LazyLock<SearchEngine> = LazyLock::new(|| {
        let conn = ow_db::open_and_seed().expect("db init");
        let verses = ow_db::get_all_verses(&conn).expect("get verses");
        SearchEngine::build(&verses).expect("index build")
    });

    fn test_engine() -> &'static SearchEngine {
        &ENGINE
    }

    #[test]
    fn test_reference_lookup_exact() {
        let engine = test_engine();
        let results = engine.search("John 3:16", Some("KJV"), 10).unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].text.contains("God so loved"));
    }

    #[test]
    fn test_reference_lookup_chapter() {
        let engine = test_engine();
        let results = engine.search("Psalms 23", Some("KJV"), 20).unwrap();
        assert_eq!(results.len(), 6, "Psalm 23 has 6 verses in seed data");
    }

    #[test]
    fn test_free_text_search() {
        let engine = test_engine();
        let results = engine.search("shepherd", None, 20).unwrap();
        assert!(!results.is_empty());
        assert!(results
            .iter()
            .all(|r| r.text.to_lowercase().contains("shepherd")));
    }

    #[test]
    fn test_translation_filter() {
        let engine = test_engine();
        let kjv = engine.search("shepherd", Some("KJV"), 20).unwrap();
        let web = engine.search("shepherd", Some("WEB"), 20).unwrap();
        assert!(kjv.iter().all(|r| r.translation == "KJV"));
        assert!(web.iter().all(|r| r.translation == "WEB"));
    }

    #[test]
    fn test_normalize_book_aliases() {
        // Pre-existing aliases
        assert_eq!(normalize_book("ps"), Some("Psalms".into()));
        assert_eq!(normalize_book("Psalm"), Some("Psalms".into()));
        assert_eq!(normalize_book("jn"), Some("John".into()));
        assert_eq!(normalize_book("1 Cor"), Some("1 Corinthians".into()));
        assert_eq!(normalize_book("unknown book xyz"), None);

        // OT books previously missing (regression guard for CTO blocker)
        assert_eq!(normalize_book("Ezekiel"), Some("Ezekiel".into()));
        assert_eq!(normalize_book("ezk"), Some("Ezekiel".into()));
        assert_eq!(normalize_book("ezek"), Some("Ezekiel".into()));
        assert_eq!(normalize_book("Dan"), Some("Daniel".into()));
        assert_eq!(normalize_book("Exod"), Some("Exodus".into()));
        assert_eq!(normalize_book("Lev"), Some("Leviticus".into()));
        assert_eq!(normalize_book("Num"), Some("Numbers".into()));
        assert_eq!(normalize_book("Deut"), Some("Deuteronomy".into()));
        assert_eq!(normalize_book("Josh"), Some("Joshua".into()));
        assert_eq!(normalize_book("Judg"), Some("Judges".into()));
        assert_eq!(normalize_book("Ruth"), Some("Ruth".into()));
        assert_eq!(normalize_book("1 Sam"), Some("1 Samuel".into()));
        assert_eq!(normalize_book("2 Sam"), Some("2 Samuel".into()));
        assert_eq!(normalize_book("1 Kgs"), Some("1 Kings".into()));
        assert_eq!(normalize_book("2 Kgs"), Some("2 Kings".into()));
        assert_eq!(normalize_book("1 Chr"), Some("1 Chronicles".into()));
        assert_eq!(normalize_book("2 Chr"), Some("2 Chronicles".into()));
        assert_eq!(normalize_book("Neh"), Some("Nehemiah".into()));
        assert_eq!(normalize_book("Esth"), Some("Esther".into()));
        assert_eq!(normalize_book("Job"), Some("Job".into()));
        assert_eq!(normalize_book("Prov"), Some("Proverbs".into()));
        assert_eq!(normalize_book("Eccl"), Some("Ecclesiastes".into()));
        assert_eq!(normalize_book("Isa"), Some("Isaiah".into()));
        assert_eq!(normalize_book("Jer"), Some("Jeremiah".into()));
        assert_eq!(normalize_book("Lam"), Some("Lamentations".into()));
        assert_eq!(normalize_book("Hos"), Some("Hosea".into()));
        assert_eq!(normalize_book("Joel"), Some("Joel".into()));
        assert_eq!(normalize_book("Amos"), Some("Amos".into()));
        assert_eq!(normalize_book("Obad"), Some("Obadiah".into()));
        assert_eq!(normalize_book("Jonah"), Some("Jonah".into()));
        assert_eq!(normalize_book("Mic"), Some("Micah".into()));
        assert_eq!(normalize_book("Nah"), Some("Nahum".into()));
        assert_eq!(normalize_book("Hab"), Some("Habakkuk".into()));
        assert_eq!(normalize_book("Zeph"), Some("Zephaniah".into()));
        assert_eq!(normalize_book("Hag"), Some("Haggai".into()));
        assert_eq!(normalize_book("Zech"), Some("Zechariah".into()));
        assert_eq!(normalize_book("Mal"), Some("Malachi".into()));

        // NT books previously missing
        assert_eq!(normalize_book("1 Thess"), Some("1 Thessalonians".into()));
        assert_eq!(normalize_book("2 Thess"), Some("2 Thessalonians".into()));
        assert_eq!(normalize_book("1 Tim"), Some("1 Timothy".into()));
        assert_eq!(normalize_book("2 Tim"), Some("2 Timothy".into()));
        assert_eq!(normalize_book("Titus"), Some("Titus".into()));
        assert_eq!(normalize_book("Phm"), Some("Philemon".into()));
        assert_eq!(normalize_book("Jas"), Some("James".into()));
        assert_eq!(normalize_book("1 Pet"), Some("1 Peter".into()));
        assert_eq!(normalize_book("2 Pet"), Some("2 Peter".into()));
        assert_eq!(normalize_book("1 John"), Some("1 John".into()));
        assert_eq!(normalize_book("2 John"), Some("2 John".into()));
        assert_eq!(normalize_book("3 John"), Some("3 John".into()));
        assert_eq!(normalize_book("Jude"), Some("Jude".into()));
    }

    #[test]
    fn test_reference_parser() {
        assert_eq!(
            parse_reference("John 3:16"),
            Some(("John".into(), 3, Some(16)))
        );
        assert_eq!(
            parse_reference("Psalms 23"),
            Some(("Psalms".into(), 23, None))
        );
        assert_eq!(
            parse_reference("1 Cor 13:1"),
            Some(("1 Corinthians".into(), 13, Some(1)))
        );
        assert_eq!(parse_reference("love one another"), None);
    }

    #[test]
    fn test_no_translation_filter_returns_all_translations() {
        let engine = test_engine();
        let results = engine.search("shepherd", None, 50).unwrap();
        let translations: std::collections::HashSet<&str> =
            results.iter().map(|r| r.translation.as_str()).collect();
        assert!(translations.contains("KJV"));
        assert!(translations.contains("WEB"));
    }

    #[test]
    fn test_empty_index_returns_no_results() {
        let engine = SearchEngine::build(&[]).expect("empty index build");
        let results = engine.search("John 3:16", None, 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_malformed_query_does_not_panic() {
        let engine = test_engine();
        // These should gracefully use parse_query_lenient and not panic.
        let r1 = engine.search("AND OR NOT", None, 10).unwrap();
        let r2 = engine.search("+++ ---", None, 10).unwrap();
        // We don't assert on results — just that no panic occurs.
        let _ = r1;
        let _ = r2;
    }

    #[test]
    fn test_search_with_limit_zero() {
        let engine = test_engine();
        let results = engine.search("God", None, 0).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_result_fields_populated() {
        let engine = test_engine();
        let results = engine.search("John 3:16", Some("KJV"), 1).unwrap();
        assert_eq!(results.len(), 1);
        let v = &results[0];
        assert_eq!(v.translation, "KJV");
        assert_eq!(v.book, "John");
        assert_eq!(v.chapter, 3);
        assert_eq!(v.verse, 16);
        assert_eq!(v.reference, "John 3:16");
        assert!(!v.text.is_empty());
    }

    #[test]
    fn test_score_normalized_between_zero_and_one() {
        let engine = test_engine();
        let results = engine.search("love", None, 20).unwrap();
        assert!(!results.is_empty(), "should find results for 'love'");
        for r in &results {
            assert!(
                r.score >= 0.0 && r.score <= 1.0,
                "score {} out of [0,1] range for '{}'",
                r.score,
                r.reference
            );
        }
    }

    #[test]
    fn test_top_result_has_highest_score() {
        let engine = test_engine();
        let results = engine.search("love", None, 10).unwrap();
        if results.len() > 1 {
            // First result should have score >= all others (descending by relevance).
            let top = results[0].score;
            for r in &results[1..] {
                assert!(
                    top >= r.score,
                    "top score {} < subsequent score {} for '{}'",
                    top,
                    r.score,
                    r.reference
                );
            }
        }
    }

    #[test]
    fn test_parse_range_reference() {
        assert_eq!(
            parse_range_reference("Romans 8:38-39"),
            Some(("Romans".into(), 8, 38, 39))
        );
        assert_eq!(
            parse_range_reference("Genesis 1:1-3"),
            Some(("Genesis".into(), 1, 1, 3))
        );
        assert_eq!(
            parse_range_reference("1 John 3:16-18"),
            Some(("1 John".into(), 3, 16, 18))
        );
        assert_eq!(
            parse_range_reference("Psalm 23:1-6"),
            Some(("Psalms".into(), 23, 1, 6))
        );
        // En-dash and em-dash variants
        assert_eq!(
            parse_range_reference("Romans 8:38\u{2013}39"),
            Some(("Romans".into(), 8, 38, 39))
        );
        assert_eq!(
            parse_range_reference("Romans 8:38\u{2014}39"),
            Some(("Romans".into(), 8, 38, 39))
        );
        // Not a range — single verse
        assert_eq!(parse_range_reference("John 3:16"), None);
        // Not a range — free text
        assert_eq!(parse_range_reference("love one another"), None);
        // Invalid range (start > end)
        assert_eq!(parse_range_reference("Romans 8:39-38"), None);
    }

    #[test]
    fn test_search_range_returns_correct_verses() {
        let engine = test_engine();
        let results = engine
            .search_range("Psalms", 23, 1, 3, Some("KJV"))
            .unwrap();
        assert_eq!(results.len(), 3, "should return verses 1-3 of Psalm 23");
        assert_eq!(results[0].verse, 1);
        assert_eq!(results[1].verse, 2);
        assert_eq!(results[2].verse, 3);
        assert!(results.iter().all(|r| r.book == "Psalms" && r.chapter == 23));
        assert!(results.iter().all(|r| r.translation == "KJV"));
    }

    #[test]
    fn test_search_range_full_chapter_subset() {
        let engine = test_engine();
        // Psalm 23 has 6 verses; request all of them via range
        let results = engine
            .search_range("Psalms", 23, 1, 6, Some("KJV"))
            .unwrap();
        assert_eq!(results.len(), 6);
    }

    #[test]
    fn test_search_range_no_translation_filter() {
        let engine = test_engine();
        // Without translation filter, should return results from all translations
        let results = engine.search_range("John", 3, 16, 16, None).unwrap();
        assert!(results.len() >= 3, "should have John 3:16 from at least 3 translations");
    }

    #[test]
    fn test_exact_reference_score_field_present() {
        let engine = test_engine();
        let results = engine.search("John 3:16", Some("KJV"), 1).unwrap();
        assert_eq!(results.len(), 1);
        // Exact reference lookup: score field must be populated (non-negative).
        assert!(results[0].score >= 0.0);
    }

    // ── Additional parse_range_reference tests ───────────────────────────

    #[test]
    fn parse_range_reference_romans_8_38_39() {
        let result = parse_range_reference("Romans 8:38-39");
        assert_eq!(result, Some(("Romans".into(), 8, 38, 39)));
    }

    #[test]
    fn parse_range_reference_1_john_3_16_18() {
        let result = parse_range_reference("1 John 3:16-18");
        assert_eq!(result, Some(("1 John".into(), 3, 16, 18)));
    }

    #[test]
    fn parse_range_reference_returns_none_for_non_range() {
        assert_eq!(parse_range_reference("John 3:16"), None);
        assert_eq!(parse_range_reference("hello world"), None);
        assert_eq!(parse_range_reference("Psalm 23"), None);
        assert_eq!(parse_range_reference(""), None);
    }

    #[test]
    fn parse_range_reference_handles_en_dash() {
        let result = parse_range_reference("Genesis 1:1\u{2013}5");
        assert_eq!(result, Some(("Genesis".into(), 1, 1, 5)));
    }

    #[test]
    fn parse_range_reference_handles_em_dash() {
        let result = parse_range_reference("Genesis 1:1\u{2014}5");
        assert_eq!(result, Some(("Genesis".into(), 1, 1, 5)));
    }

    #[test]
    fn parse_range_reference_rejects_inverted_range() {
        assert_eq!(parse_range_reference("Romans 8:39-38"), None);
    }

    #[test]
    fn parse_reference_handles_abbreviations() {
        assert_eq!(
            parse_reference("Matt 5:3"),
            Some(("Matthew".into(), 5, Some(3)))
        );
        assert_eq!(
            parse_reference("Rev 22:21"),
            Some(("Revelation".into(), 22, Some(21)))
        );
    }
}
