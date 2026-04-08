// Tantivy-backed scripture search index.
// In-memory index built from the Bible DB on startup.
// Supports reference lookup ("John 3:16") and free-text keyword search.

use anyhow::{Context, Result};
use ow_db::Verse;
use serde::{Deserialize, Serialize};
use tantivy::{
    collector::TopDocs,
    query::{BooleanQuery, Occur, QueryParser, TermQuery},
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

    /// Search by scripture reference (e.g. "John 3:16") or free-text keywords.
    /// When `translation` is Some, results are filtered to that abbreviation.
    pub fn search(
        &self,
        query: &str,
        translation: Option<&str>,
        limit: usize,
    ) -> Result<Vec<VerseResult>> {
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

        let mut results = Vec::with_capacity(top_docs.len());
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
    let chapter = b.add_u64_field("chapter", FAST | INDEXED);
    let verse = b.add_u64_field("verse", FAST | INDEXED);
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
        "gen" | "genesis" => "Genesis",
        "ps" | "psa" | "psalm" | "psalms" => "Psalms",
        "isa" | "isaiah" => "Isaiah",
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
        "heb" | "hebrews" => "Hebrews",
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

    fn test_engine() -> SearchEngine {
        let conn = ow_db::open_and_seed().expect("db init");
        let verses = ow_db::get_all_verses(&conn).expect("get verses");
        SearchEngine::build(&verses).expect("index build")
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
        assert_eq!(normalize_book("ps"), Some("Psalms".into()));
        assert_eq!(normalize_book("Psalm"), Some("Psalms".into()));
        assert_eq!(normalize_book("jn"), Some("John".into()));
        assert_eq!(normalize_book("1 Cor"), Some("1 Corinthians".into()));
        assert_eq!(normalize_book("unknown book xyz"), None);
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
}
