//! Song lyrics library — persistent SQLite + FTS5 search, import parsers,
//! and semantic index for mid-lyric phrase detection.
//!
//! Storage: `~/.openworship/songs.db` (created on first use).
//! Schema:
//!   `songs`       — metadata + full lyrics
//!   `songs_fts`   — FTS5 virtual table for title/artist/lyrics search
//!
//! Import formats supported:
//!   • CCLI SongSelect plain-text export
//!   • OpenLP 2.x XML song export

use anyhow::{Context, Result};
use ow_core::SongRef;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ─── Domain types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: i64,
    pub title: String,
    pub artist: Option<String>,
    /// Import source: "ccli", "openlp", or "manual".
    pub source: Option<String>,
    pub ccli_number: Option<String>,
    /// Full lyrics, sections separated by blank lines.
    pub lyrics: String,
    pub created_at_ms: i64,
}

/// Parsed representation used during import (before insertion).
#[derive(Debug, Clone)]
pub struct SongImport {
    pub title: String,
    pub artist: Option<String>,
    pub ccli_number: Option<String>,
    pub source: String,
    pub lyrics: String,
}

// ─── Semantic index ───────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct SongSemanticMatch {
    pub song_id: i64,
    pub title: String,
    /// Cosine similarity [0, 1].
    pub score: f32,
}

/// In-memory vector index of embedded song lyric phrases.
pub struct SongSemanticIndex {
    /// `(song_id, title, embedding)` — one entry per lyric chunk.
    entries: Vec<(i64, String, Vec<f32>)>,
}

impl SongSemanticIndex {
    pub fn new(entries: Vec<(i64, String, Vec<f32>)>) -> Self {
        Self { entries }
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Return up to `limit` songs whose lyric embeddings exceed `threshold`
    /// similarity to `query_embedding`.
    pub fn search(
        &self,
        query_embedding: &[f32],
        threshold: f32,
        limit: usize,
    ) -> Vec<SongSemanticMatch> {
        let mut scored: Vec<SongSemanticMatch> = self
            .entries
            .iter()
            .filter_map(|(id, title, emb)| {
                let score = ow_embed::cosine_similarity(query_embedding, emb).max(0.0);
                if score >= threshold {
                    Some(SongSemanticMatch { song_id: *id, title: title.clone(), score })
                } else {
                    None
                }
            })
            .collect();
        scored.sort_by(|a, b| {
            b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal)
        });
        scored.truncate(limit);
        scored
    }
}

/// Build a semantic index from all songs in the DB.
///
/// Embeds the first substantive lyric section of each song (title + verse 1
/// / chorus) so mid-lyric phrases in the transcript can trigger a match.
pub async fn build_song_semantic_index(
    client: &ow_embed::OllamaClient,
    songs: &[Song],
) -> Result<SongSemanticIndex> {
    let total = songs.len();
    if total == 0 {
        return Ok(SongSemanticIndex::new(vec![]));
    }
    eprintln!("[song-embed] building semantic index for {total} songs…");

    let mut entries = Vec::with_capacity(total);
    for song in songs {
        // Embed a representative sample: title + first ~200 chars of lyrics.
        let sample = lyric_sample(&song.title, &song.lyrics);
        match client.embed(&sample).await {
            Ok(emb) => {
                entries.push((song.id, song.title.clone(), emb));
            }
            Err(e) => {
                eprintln!("[song-embed] failed for '{}': {e}", song.title);
            }
        }
    }
    eprintln!("[song-embed] semantic index ready ({} songs)", entries.len());
    Ok(SongSemanticIndex::new(entries))
}

/// Extract a short representative text from song lyrics (title + first verse).
fn lyric_sample(title: &str, lyrics: &str) -> String {
    let lines: Vec<&str> = lyrics
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('[') && !l.starts_with('#'))
        .collect();
    let excerpt: String = lines.iter().take(5).cloned().collect::<Vec<_>>().join(" ");
    format!("{title} {excerpt}")
}

// ─── Database ─────────────────────────────────────────────────────────────────

fn db_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Ok(PathBuf::from(home).join(".openworship").join("songs.db"))
}

fn create_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS songs (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            title        TEXT NOT NULL,
            artist       TEXT,
            source       TEXT,
            ccli_number  TEXT,
            lyrics       TEXT NOT NULL,
            created_at_ms INTEGER NOT NULL
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
            title, artist, lyrics, content=songs, content_rowid=id
        );
        CREATE TRIGGER IF NOT EXISTS songs_ai AFTER INSERT ON songs BEGIN
            INSERT INTO songs_fts(rowid, title, artist, lyrics)
            VALUES (new.id, new.title, COALESCE(new.artist,''), new.lyrics);
        END;
        CREATE TRIGGER IF NOT EXISTS songs_ad AFTER DELETE ON songs BEGIN
            INSERT INTO songs_fts(songs_fts, rowid, title, artist, lyrics)
            VALUES ('delete', old.id, old.title, COALESCE(old.artist,''), old.lyrics);
        END;
        CREATE TRIGGER IF NOT EXISTS songs_au AFTER UPDATE ON songs BEGIN
            INSERT INTO songs_fts(songs_fts, rowid, title, artist, lyrics)
            VALUES ('delete', old.id, old.title, COALESCE(old.artist,''), old.lyrics);
            INSERT INTO songs_fts(rowid, title, artist, lyrics)
            VALUES (new.id, new.title, COALESCE(new.artist,''), new.lyrics);
        END;",
    )?;
    Ok(())
}

/// Persistent song library backed by SQLite with FTS5 search.
pub struct SongsDb {
    conn: Connection,
}

impl SongsDb {
    /// Open (or create) the songs database at `~/.openworship/songs.db`.
    pub fn open() -> Result<Self> {
        let path = db_path()?;
        if let Some(p) = path.parent() {
            std::fs::create_dir_all(p)?;
        }
        let conn = Connection::open(&path)
            .with_context(|| format!("failed to open songs DB at {}", path.display()))?;
        // Enable WAL for better concurrent read performance.
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        create_schema(&conn)?;
        Ok(Self { conn })
    }

    /// Open an in-memory songs database (used as fallback and in tests).
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        create_schema(&conn)?;
        Ok(Self { conn })
    }

    /// Insert a new song and return it (with the assigned `id`).
    pub fn add_song(
        &self,
        title: &str,
        artist: Option<&str>,
        lyrics: &str,
        source: Option<&str>,
        ccli_number: Option<&str>,
    ) -> Result<Song> {
        let now_ms = now_ms();
        self.conn.execute(
            "INSERT INTO songs (title, artist, source, ccli_number, lyrics, created_at_ms)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![title, artist, source, ccli_number, lyrics, now_ms],
        )?;
        let id = self.conn.last_insert_rowid();
        Ok(Song {
            id,
            title: title.to_owned(),
            artist: artist.map(str::to_owned),
            source: source.map(str::to_owned),
            ccli_number: ccli_number.map(str::to_owned),
            lyrics: lyrics.to_owned(),
            created_at_ms: now_ms,
        })
    }

    /// Update an existing song's fields.
    pub fn update_song(
        &self,
        id: i64,
        title: &str,
        artist: Option<&str>,
        lyrics: &str,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE songs SET title = ?1, artist = ?2, lyrics = ?3 WHERE id = ?4",
            params![title, artist, lyrics, id],
        )?;
        Ok(())
    }

    pub fn get_song(&self, id: i64) -> Result<Option<Song>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, artist, source, ccli_number, lyrics, created_at_ms
             FROM songs WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map([id], row_to_song)?;
        Ok(rows.next().transpose()?)
    }

    pub fn delete_song(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM songs WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn list_songs(&self) -> Result<Vec<Song>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, artist, source, ccli_number, lyrics, created_at_ms
             FROM songs ORDER BY title ASC",
        )?;
        let rows = stmt.query_map([], row_to_song)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// FTS5 search by title, artist, or any lyric phrase.
    ///
    /// Empty query returns all songs ordered by title.
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<Song>> {
        if query.trim().is_empty() {
            let mut stmt = self.conn.prepare(
                "SELECT id, title, artist, source, ccli_number, lyrics, created_at_ms
                 FROM songs ORDER BY title ASC LIMIT ?1",
            )?;
            let rows = stmt.query_map([limit as i64], row_to_song)?;
            return Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?);
        }

        // Escape FTS5 special characters and append wildcard for prefix match.
        let fts_query = fts5_escape(query);
        let mut stmt = self.conn.prepare(
            "SELECT s.id, s.title, s.artist, s.source, s.ccli_number, s.lyrics, s.created_at_ms
             FROM songs_fts f
             JOIN songs s ON s.id = f.rowid
             WHERE songs_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![fts_query, limit as i64], row_to_song)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// Return all songs as `SongRef` list for building the title detector.
    pub fn all_refs(&self) -> Result<Vec<SongRef>> {
        let mut stmt = self.conn.prepare("SELECT id, title FROM songs ORDER BY title")?;
        let rows = stmt.query_map([], |row| Ok(SongRef { id: row.get(0)?, title: row.get(1)? }))?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// Import a batch of songs, skipping exact title duplicates.
    ///
    /// Returns the songs actually inserted.
    pub fn import_batch(&self, imports: &[SongImport]) -> Result<Vec<Song>> {
        let mut inserted = Vec::new();
        for imp in imports {
            // Skip if a song with the exact same title already exists.
            let exists: bool = self
                .conn
                .query_row(
                    "SELECT 1 FROM songs WHERE title = ?1 LIMIT 1",
                    [&imp.title],
                    |_| Ok(true),
                )
                .unwrap_or(false);
            if exists {
                continue;
            }
            let song = self.add_song(
                &imp.title,
                imp.artist.as_deref(),
                &imp.lyrics,
                Some(&imp.source),
                imp.ccli_number.as_deref(),
            )?;
            inserted.push(song);
        }
        Ok(inserted)
    }
}

fn row_to_song(row: &rusqlite::Row<'_>) -> rusqlite::Result<Song> {
    Ok(Song {
        id: row.get(0)?,
        title: row.get(1)?,
        artist: row.get(2)?,
        source: row.get(3)?,
        ccli_number: row.get(4)?,
        lyrics: row.get(5)?,
        created_at_ms: row.get(6)?,
    })
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Escape FTS5 special characters and append `*` for prefix matching.
fn fts5_escape(raw: &str) -> String {
    // FTS5 special characters: " ( ) * : ^
    // Simplest safe approach: wrap each token in double-quotes.
    let tokens: Vec<String> = raw
        .split_whitespace()
        .map(|t| format!(r#""{}" "#, t.replace('"', "")))
        .collect();
    if tokens.is_empty() {
        return String::new();
    }
    // Last token gets a prefix wildcard for partial-word matching.
    let mut result = tokens[..tokens.len().saturating_sub(1)].join(" ");
    if let Some(last) = tokens.last() {
        let trimmed = last.trim_end_matches('"').trim_end_matches(' ');
        if !result.is_empty() {
            result.push(' ');
        }
        result.push_str(&format!("{trimmed}*\""));
    }
    result
}

// ─── CCLI SongSelect text parser ─────────────────────────────────────────────

/// Parse a CCLI SongSelect plain-text export.
///
/// Supports the two common export layouts:
///   1. `Key: Value` header lines followed by section-labelled verses.
///   2. Free-form with section headings on their own line.
pub fn parse_ccli_text(input: &str) -> Result<Vec<SongImport>> {
    let mut songs: Vec<SongImport> = Vec::new();
    let mut title = String::new();
    let mut artist: Option<String> = None;
    let mut ccli: Option<String> = None;
    let mut lyric_sections: Vec<String> = Vec::new();
    let mut current_section: Vec<String> = Vec::new();
    let mut in_header = true;

    for raw_line in input.lines() {
        let line = raw_line.trim();

        // Key: Value header parsing
        if in_header {
            if let Some(val) = strip_prefix_ci(line, "title:") {
                title = val.trim().to_owned();
                continue;
            }
            if let Some(val) = strip_prefix_ci(line, "author:") {
                artist = Some(val.trim().to_owned());
                continue;
            }
            if let Some(val) = strip_prefix_ci(line, "ccli song #:") {
                ccli = Some(val.trim().to_owned());
                continue;
            }
            if let Some(val) = strip_prefix_ci(line, "ccli#:") {
                ccli = Some(val.trim().to_owned());
                continue;
            }
            // Copyright / other metadata lines — skip
            if strip_prefix_ci(line, "copyright:").is_some() {
                continue;
            }
            // Blank line after header signals start of lyrics
            if line.is_empty() && !title.is_empty() {
                in_header = false;
                continue;
            }
            // If we see a section header before a blank line, flip modes
            if !line.is_empty() && is_section_header(line) {
                in_header = false;
            }
        }

        if !in_header {
            if is_section_header(line) {
                if !current_section.is_empty() {
                    lyric_sections.push(current_section.join("\n"));
                    current_section.clear();
                }
                current_section.push(format!("[{line}]"));
            } else if line.is_empty() {
                if !current_section.is_empty()
                    && current_section.last().map(|l: &String| !l.is_empty()).unwrap_or(false)
                {
                    current_section.push(String::new());
                }
            } else {
                current_section.push(line.to_owned());
            }
        }
    }
    if !current_section.is_empty() {
        lyric_sections.push(current_section.join("\n"));
    }

    if title.is_empty() {
        anyhow::bail!("CCLI text missing title");
    }

    let lyrics = lyric_sections.join("\n\n");
    songs.push(SongImport {
        title,
        artist,
        ccli_number: ccli,
        source: "ccli".to_owned(),
        lyrics,
    });
    Ok(songs)
}

fn strip_prefix_ci<'a>(s: &'a str, prefix: &str) -> Option<&'a str> {
    if s.to_ascii_lowercase().starts_with(&prefix.to_ascii_lowercase()) {
        Some(&s[prefix.len()..])
    } else {
        None
    }
}

fn is_section_header(line: &str) -> bool {
    let lower = line.to_ascii_lowercase();
    lower.starts_with("verse")
        || lower.starts_with("chorus")
        || lower.starts_with("bridge")
        || lower.starts_with("pre-chorus")
        || lower.starts_with("prechorus")
        || lower.starts_with("intro")
        || lower.starts_with("outro")
        || lower.starts_with("tag")
        || (line.starts_with('[') && line.ends_with(']'))
}

// ─── OpenLP XML parser ────────────────────────────────────────────────────────

/// Parse OpenLP 2.x XML song export.
///
/// Supports both the canonical `<song>` root element and the alternate
/// `<songs>` wrapper that some export tools produce.
pub fn parse_openlp_xml(input: &str) -> Result<Vec<SongImport>> {
    let mut songs = Vec::new();

    // Parse each <song> block found in the input.
    let mut search_pos = 0;
    while let Some(start) = find_tag_start(input, "<song", search_pos) {
        let end = match find_tag_end(input, start) {
            Some(e) => e,
            None => break,
        };
        let block = &input[start..end];
        if let Ok(song) = parse_openlp_song_block(block) {
            songs.push(song);
        }
        search_pos = end;
    }

    if songs.is_empty() {
        anyhow::bail!("No valid <song> elements found in OpenLP XML");
    }
    Ok(songs)
}

fn parse_openlp_song_block(block: &str) -> Result<SongImport> {
    let title = extract_first_tag(block, "title")
        .or_else(|| extract_attr(block, "song", "name"))
        .unwrap_or_default();
    if title.is_empty() {
        anyhow::bail!("song block has no title");
    }

    let artist = extract_first_tag(block, "author");
    let ccli_number = extract_first_tag(block, "cclinumber")
        .or_else(|| extract_first_tag(block, "ccli_number"));

    // Collect verse blocks preserving order.
    let mut verses: Vec<String> = Vec::new();
    let mut search = 0;
    while let Some(vs) = find_tag_start(block, "<verse", search) {
        let ve = match find_tag_end(block, vs) {
            Some(e) => e,
            None => break,
        };
        let verse_block = &block[vs..ve];
        // Extract <lines> content; fall back to inner text of the verse block.
        let lines_text = extract_first_tag(verse_block, "lines")
            .unwrap_or_else(|| inner_text(verse_block));
        let cleaned = lines_text
            .replace("<br/>", "\n")
            .replace("<br />", "\n")
            .replace("<br>", "\n");
        let section = cleaned.trim().to_owned();
        if !section.is_empty() {
            verses.push(section);
        }
        search = ve;
    }

    let lyrics = verses.join("\n\n");
    Ok(SongImport {
        title,
        artist,
        ccli_number,
        source: "openlp".to_owned(),
        lyrics,
    })
}

fn find_tag_start(text: &str, tag: &str, from: usize) -> Option<usize> {
    text[from..].find(tag).map(|p| from + p)
}

fn find_tag_end(text: &str, start: usize) -> Option<usize> {
    // Find the matching closing tag or self-close of the outermost element.
    let tag_name: String = text[start + 1..]
        .chars()
        .take_while(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if tag_name.is_empty() {
        return None;
    }
    let open = format!("<{tag_name}");
    let close = format!("</{tag_name}>");
    let mut depth = 0usize;
    let mut pos = start;
    let bytes = text.as_bytes();
    while pos < bytes.len() {
        if text[pos..].starts_with(&close) {
            if depth == 1 {
                return Some(pos + close.len());
            }
            depth = depth.saturating_sub(1);
            pos += close.len();
        } else if text[pos..].starts_with(&open) {
            // Check for self-closing
            let tag_end = text[pos..].find('>').map(|p| pos + p + 1).unwrap_or(pos + 1);
            if text[pos..tag_end].ends_with("/>") {
                if depth == 0 {
                    return Some(tag_end);
                }
            } else {
                depth += 1;
            }
            pos = tag_end;
        } else {
            pos += 1;
        }
    }
    None
}

fn extract_first_tag(text: &str, tag: &str) -> Option<String> {
    let close = format!("</{tag}>");
    // Search for exact tag boundary: `<tag>`, `<tag `, or `<tag/>`
    let candidate = format!("<{tag}");
    let mut search = 0;
    loop {
        let pos = text[search..].find(&candidate)? + search;
        // Character after the tag name must be >, whitespace, or /
        let after_name = pos + 1 + tag.len();
        let boundary = text.as_bytes().get(after_name).copied();
        if matches!(boundary, Some(b'>') | Some(b' ') | Some(b'\t') | Some(b'\n') | Some(b'\r') | Some(b'/')) {
            let after_open = text[pos..].find('>')? + pos + 1;
            let end = text[after_open..].find(&close)? + after_open;
            return Some(html_unescape(&text[after_open..end]));
        }
        search = pos + 1;
    }
}

fn inner_text(text: &str) -> String {
    // Strip all tags and return plain text.
    let mut out = String::new();
    let mut in_tag = false;
    for c in text.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

fn extract_attr(text: &str, _tag: &str, attr: &str) -> Option<String> {
    let pat = format!(r#"{attr}=""#);
    let start = text.find(&pat)? + pat.len();
    let end = text[start..].find('"')? + start;
    Some(html_unescape(&text[start..end]))
}

fn html_unescape(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .trim()
        .to_owned()
}

// ─── Lyric chunk helpers ──────────────────────────────────────────────────────

/// Split song lyrics into display chunks of `lines_per_chunk` lyric lines,
/// preserving section boundaries.
pub fn split_into_chunks(lyrics: &str, lines_per_chunk: usize) -> Vec<String> {
    let mut chunks: Vec<String> = Vec::new();
    let mut current: Vec<String> = Vec::new();
    let mut lyric_line_count = 0usize;

    for line in lyrics.lines() {
        let trimmed = line.trim();
        if is_section_header(trimmed) {
            // Flush current chunk before starting a new section.
            if !current.is_empty() {
                chunks.push(current.join("\n"));
                current.clear();
                lyric_line_count = 0;
            }
            current.push(trimmed.to_owned());
        } else if trimmed.is_empty() {
            // Blank line — treat as soft break but don't count as lyric line.
            if !current.is_empty() {
                current.push(String::new());
            }
        } else {
            current.push(trimmed.to_owned());
            lyric_line_count += 1;
            if lyric_line_count >= lines_per_chunk {
                chunks.push(current.join("\n"));
                current.clear();
                lyric_line_count = 0;
            }
        }
    }
    if !current.is_empty() {
        chunks.push(current.join("\n"));
    }
    chunks
}

// ─── Line-advance speech pacing ───────────────────────────────────────────────

/// Determine the next lyric chunk index based on transcript content.
///
/// Compares `transcript` against the lyrics of `song` to find the best-matching
/// chunk.  Returns `None` if no chunk matches well enough, or if `current_idx`
/// is already the last chunk.
pub fn pacing_advance(
    transcript: &str,
    lyrics: &str,
    current_idx: usize,
    chunks_per_slide: usize,
) -> Option<usize> {
    let chunks = split_into_chunks(lyrics, chunks_per_slide);
    if current_idx + 1 >= chunks.len() {
        return None;
    }
    // Check whether the NEXT expected chunk words appear in the transcript.
    let next_chunk = &chunks[current_idx + 1];
    let chunk_words: Vec<&str> = next_chunk
        .split_whitespace()
        .filter(|w| w.len() > 3)
        .take(8)
        .collect();
    if chunk_words.is_empty() {
        return None;
    }
    let tr_lower = transcript.to_ascii_lowercase();
    let matched = chunk_words
        .iter()
        .filter(|w| tr_lower.contains(&w.to_ascii_lowercase()))
        .count();
    // Advance if at least half the key words appear.
    if matched * 2 >= chunk_words.len() {
        Some(current_idx + 1)
    } else {
        None
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ccli_basic() {
        let input = "Title: Amazing Grace\nAuthor: John Newton\nCCLI Song #: 12345\n\nVerse 1\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\nChorus\nMy chains are gone\n";
        let songs = parse_ccli_text(input).unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].title, "Amazing Grace");
        assert_eq!(songs[0].artist.as_deref(), Some("John Newton"));
        assert_eq!(songs[0].ccli_number.as_deref(), Some("12345"));
        assert!(songs[0].lyrics.contains("Amazing grace"));
        assert!(songs[0].lyrics.contains("My chains are gone"));
    }

    #[test]
    fn test_parse_openlp_basic() {
        let xml = r#"<?xml version="1.0"?>
<song version="1.0">
  <properties>
    <titles><title>How Great Thou Art</title></titles>
    <authors><author type="words">Stuart K. Hine</author></authors>
    <cclinumber>14181</cclinumber>
  </properties>
  <lyrics>
    <verse label="v1" type="verse">
      <lines>O Lord my God when I in awesome wonder<br/>Consider all the worlds thy hands have made</lines>
    </verse>
    <verse label="c1" type="chorus">
      <lines>Then sings my soul my Saviour God to thee<br/>How great thou art how great thou art</lines>
    </verse>
  </lyrics>
</song>"#;
        let songs = parse_openlp_xml(xml).unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].title, "How Great Thou Art");
        assert_eq!(songs[0].artist.as_deref(), Some("Stuart K. Hine"));
        assert!(songs[0].lyrics.contains("awesome wonder"));
        assert!(songs[0].lyrics.contains("sings my soul"));
    }

    #[test]
    fn test_songs_db_roundtrip() {
        // Use an in-memory DB for the test.
        let conn = Connection::open_in_memory().unwrap();
        create_schema(&conn).unwrap();
        let db = SongsDb { conn };

        let song = db
            .add_song("Amazing Grace", Some("John Newton"), "Amazing grace…", Some("manual"), None)
            .unwrap();
        assert!(song.id > 0);
        assert_eq!(song.title, "Amazing Grace");

        let fetched = db.get_song(song.id).unwrap().unwrap();
        assert_eq!(fetched.title, "Amazing Grace");
        assert_eq!(fetched.artist.as_deref(), Some("John Newton"));

        db.delete_song(song.id).unwrap();
        assert!(db.get_song(song.id).unwrap().is_none());
    }

    #[test]
    fn test_split_into_chunks() {
        let lyrics = "Verse 1\nLine one\nLine two\nLine three\n\nChorus\nChorus line\n";
        let chunks = split_into_chunks(lyrics, 2);
        assert!(!chunks.is_empty());
        // Should have at least 2 chunks (verse split at 2 lines + chorus).
        assert!(chunks.len() >= 2);
    }

    #[test]
    fn test_pacing_advance_matches() {
        let lyrics = "Verse 1\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\nVerse 2\nT'was grace that taught my heart to fear\n";
        // Pretend we're on chunk 0, transcript contains next chunk words.
        let result = pacing_advance(
            "was grace that taught my heart",
            lyrics,
            0,
            2,
        );
        assert!(result.is_some());
    }

    #[test]
    fn test_fts5_escape() {
        let q = fts5_escape("amazing grace");
        // Should not crash and should contain the words
        assert!(q.contains("amazing"));
        assert!(q.contains("grace"));
    }
}
