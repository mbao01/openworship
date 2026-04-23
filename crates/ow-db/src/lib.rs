// SQLite persistence layer — Bible translations and verse data.
// Seeded in-memory at startup from public-domain scripture text.

use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────
// Public types
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Translation {
    pub id: String,
    pub name: String,
    pub abbreviation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Verse {
    pub translation: String,
    pub book: String,
    pub book_number: u32,
    pub chapter: u32,
    pub verse: u32,
    pub text: String,
    pub reference: String,
}

// ─────────────────────────────────────────
// Schema
// ─────────────────────────────────────────

fn create_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS translations (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            abbreviation TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS verses (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            translation_id TEXT NOT NULL REFERENCES translations(id),
            book           TEXT NOT NULL,
            book_number    INTEGER NOT NULL,
            chapter        INTEGER NOT NULL,
            verse          INTEGER NOT NULL,
            text           TEXT NOT NULL,
            UNIQUE(translation_id, book_number, chapter, verse)
        );
        CREATE INDEX IF NOT EXISTS idx_verses_ref
            ON verses(translation_id, book_number, chapter, verse);",
    )?;
    Ok(())
}

// ─────────────────────────────────────────
// Seed data (public-domain translations)
// KJV — King James Version (public domain)
// WEB — World English Bible (public domain)
// BSB — Berean Standard Bible (CC BY 4.0)
//
// Data files are pipe-delimited:
//   book_number|book|chapter|verse|text
// ─────────────────────────────────────────

const KJV_DATA: &str = include_str!("../data/kjv.txt");
const WEB_DATA: &str = include_str!("../data/web.txt");
const BSB_DATA: &str = include_str!("../data/bsb.txt");

fn parse_and_seed(conn: &Connection, translation: &str, data: &str) -> Result<()> {
    let mut stmt = conn.prepare_cached(
        "INSERT OR IGNORE INTO verses
            (translation_id, book, book_number, chapter, verse, text)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )?;
    for line in data.lines() {
        if line.is_empty() {
            continue;
        }
        let mut parts = line.splitn(5, '|');
        let book_number: u32 = match parts.next().and_then(|s| s.parse().ok()) {
            Some(n) if n > 0 => n,
            _ => continue,
        };
        let book = match parts.next() {
            Some(b) if !b.is_empty() => b,
            _ => continue,
        };
        let chapter: u32 = match parts.next().and_then(|s| s.parse().ok()) {
            Some(n) if n > 0 => n,
            _ => continue,
        };
        let verse_num: u32 = match parts.next().and_then(|s| s.parse().ok()) {
            Some(n) if n > 0 => n,
            _ => continue,
        };
        let text = match parts.next() {
            Some(t) if !t.is_empty() => t,
            _ => continue,
        };
        stmt.execute(params![translation, book, book_number, chapter, verse_num, text])?;
    }
    Ok(())
}

fn seed_data(conn: &Connection) -> Result<()> {
    let translations = [
        ("KJV", "King James Version"),
        ("WEB", "World English Bible"),
        ("BSB", "Berean Standard Bible"),
    ];
    for (id, name) in &translations {
        conn.execute(
            "INSERT OR IGNORE INTO translations (id, name, abbreviation) VALUES (?1, ?2, ?1)",
            params![id, name],
        )?;
    }
    conn.execute_batch("BEGIN")?;
    parse_and_seed(conn, "KJV", KJV_DATA)?;
    parse_and_seed(conn, "WEB", WEB_DATA)?;
    parse_and_seed(conn, "BSB", BSB_DATA)?;
    conn.execute_batch("COMMIT")?;
    Ok(())
}

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

/// Open an in-memory SQLite DB, create schema, and seed scripture data.
pub fn open_and_seed() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    create_schema(&conn)?;
    seed_data(&conn)?;
    Ok(conn)
}

pub fn list_translations(conn: &Connection) -> Result<Vec<Translation>> {
    let mut stmt =
        conn.prepare("SELECT id, name, abbreviation FROM translations ORDER BY name")?;
    let rows = stmt.query_map([], |row| {
        Ok(Translation {
            id: row.get(0)?,
            name: row.get(1)?,
            abbreviation: row.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Return all verses for a single translation, identified by its abbreviation (e.g. `"KJV"`).
///
/// Returns an empty vec (not an error) if the translation code is not found.
pub fn get_verses_by_translation(conn: &Connection, translation: &str) -> Result<Vec<Verse>> {
    let mut stmt = conn.prepare(
        "SELECT t.abbreviation, v.book, v.book_number, v.chapter, v.verse, v.text
         FROM verses v JOIN translations t ON v.translation_id = t.id
         WHERE t.abbreviation = ?1
         ORDER BY v.book_number, v.chapter, v.verse",
    )?;
    let rows = stmt.query_map([translation], |row| {
        let translation: String = row.get(0)?;
        let book: String = row.get(1)?;
        let book_number: u32 = row.get(2)?;
        let chapter: u32 = row.get(3)?;
        let verse: u32 = row.get(4)?;
        let text: String = row.get(5)?;
        Ok(Verse {
            reference: format!("{} {}:{}", book, chapter, verse),
            translation,
            book,
            book_number,
            chapter,
            verse,
            text,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn get_all_verses(conn: &Connection) -> Result<Vec<Verse>> {
    let mut stmt = conn.prepare(
        "SELECT t.abbreviation, v.book, v.book_number, v.chapter, v.verse, v.text
         FROM verses v JOIN translations t ON v.translation_id = t.id
         ORDER BY t.id, v.book_number, v.chapter, v.verse",
    )?;
    let rows = stmt.query_map([], |row| {
        let translation: String = row.get(0)?;
        let book: String = row.get(1)?;
        let book_number: u32 = row.get(2)?;
        let chapter: u32 = row.get(3)?;
        let verse: u32 = row.get(4)?;
        let text: String = row.get(5)?;
        Ok(Verse {
            reference: format!("{} {}:{}", book, chapter, verse),
            translation,
            book,
            book_number,
            chapter,
            verse,
            text,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Return the distinct chapter numbers for a given book (across all translations).
pub fn get_chapters(conn: &Connection, book: &str) -> Result<Vec<u32>> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT chapter FROM verses WHERE book = ?1 ORDER BY chapter",
    )?;
    let rows = stmt.query_map([book], |row| row.get::<_, u32>(0))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Return the distinct verse numbers for a given book and chapter.
pub fn get_verses(conn: &Connection, book: &str, chapter: u32) -> Result<Vec<u32>> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT verse FROM verses WHERE book = ?1 AND chapter = ?2 ORDER BY verse",
    )?;
    let rows = stmt.query_map(params![book, chapter], |row| row.get::<_, u32>(0))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

// ─────────────────────────────────────────
// Tests
// ─────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Connection {
        open_and_seed().expect("test db init failed")
    }

    #[test]
    fn test_translations_seeded() {
        let conn = test_db();
        let translations = list_translations(&conn).unwrap();
        assert_eq!(translations.len(), 3);
        let abbrevs: Vec<&str> = translations.iter().map(|t| t.abbreviation.as_str()).collect();
        assert!(abbrevs.contains(&"KJV"));
        assert!(abbrevs.contains(&"WEB"));
        assert!(abbrevs.contains(&"BSB"));
    }

    #[test]
    fn test_verses_seeded() {
        let conn = test_db();
        let verses = get_all_verses(&conn).unwrap();
        assert!(!verses.is_empty());
        let john_316 = verses.iter().find(|v| {
            v.translation == "KJV" && v.book == "John" && v.chapter == 3 && v.verse == 16
        });
        assert!(john_316.is_some());
        assert!(john_316.unwrap().text.contains("God so loved"));
    }

    #[test]
    fn test_verse_reference_format() {
        let conn = test_db();
        let verses = get_all_verses(&conn).unwrap();
        let v = verses
            .iter()
            .find(|v| {
                v.translation == "KJV"
                    && v.book == "Psalms"
                    && v.chapter == 23
                    && v.verse == 1
            })
            .unwrap();
        assert_eq!(v.reference, "Psalms 23:1");
    }

    #[test]
    fn test_seed_is_idempotent() {
        // Calling open_and_seed twice on different connections should produce the same count.
        let conn1 = open_and_seed().unwrap();
        let conn2 = open_and_seed().unwrap();
        let count1: i64 = conn1
            .query_row("SELECT COUNT(*) FROM verses", [], |r| r.get(0))
            .unwrap();
        let count2: i64 = conn2
            .query_row("SELECT COUNT(*) FROM verses", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count1, count2);
    }

    #[test]
    fn test_all_three_translations_have_john_316() {
        let conn = test_db();
        let verses = get_all_verses(&conn).unwrap();
        for abbrev in &["KJV", "WEB", "BSB"] {
            let found = verses.iter().any(|v| {
                v.translation.as_str() == *abbrev
                    && v.book == "John"
                    && v.chapter == 3
                    && v.verse == 16
            });
            assert!(found, "Missing John 3:16 for {abbrev}");
        }
    }

    #[test]
    fn test_verse_fields_populated() {
        let conn = test_db();
        // Spot-check a known verse from each translation rather than iterating the full corpus.
        for abbrev in &["KJV", "WEB", "BSB"] {
            let v: (String, String, u32, u32, u32, String) = conn
                .query_row(
                    "SELECT t.abbreviation, v.book, v.book_number, v.chapter, v.verse, v.text
                     FROM verses v JOIN translations t ON v.translation_id = t.id
                     WHERE t.abbreviation = ?1 AND v.chapter = 3 AND v.verse = 16
                     AND v.book = 'John'",
                    [abbrev],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
                )
                .unwrap_or_else(|_| panic!("John 3:16 missing for {abbrev}"));
            assert!(!v.0.is_empty());
            assert!(!v.1.is_empty());
            assert!(v.2 > 0);
            assert!(v.3 > 0);
            assert!(v.4 > 0);
            assert!(!v.5.is_empty());
        }
    }

    #[test]
    fn test_get_verses_by_translation_returns_only_that_translation() {
        let conn = test_db();
        let kjv = get_verses_by_translation(&conn, "KJV").unwrap();
        assert!(!kjv.is_empty());
        assert!(kjv.iter().all(|v| v.translation == "KJV"));
        // Should not contain other translations
        assert!(kjv.iter().all(|v| v.translation != "WEB" && v.translation != "BSB"));
    }

    #[test]
    fn test_get_verses_by_translation_unknown_returns_empty() {
        let conn = test_db();
        let result = get_verses_by_translation(&conn, "UNKNOWN").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_full_corpus_loaded() {
        let conn = test_db();
        // Each translation should have the full Bible (~31 102 verses).
        for abbrev in &["KJV", "WEB", "BSB"] {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM verses v
                     JOIN translations t ON v.translation_id = t.id
                     WHERE t.abbreviation = ?1",
                    [abbrev],
                    |r| r.get(0),
                )
                .unwrap();
            assert!(
                count > 30_000,
                "{abbrev} only has {count} verses — full corpus not loaded"
            );
        }
    }
}
