//! Artifacts module — local file management for worship service content.
//!
//! Files live on the native filesystem; this module manages a SQLite metadata
//! index in `~/.openworship/artifacts.db` for fast listing/search.

use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

// ─── ID / time helpers ────────────────────────────────────────────────────────

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn new_id() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros() as u64;
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{ts:016x}{n:08x}")
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Reject names that contain path separators or traverse upward.
/// Returns an error if the name is empty or unsafe.
fn safe_name(name: &str) -> Result<()> {
    if name.is_empty() {
        anyhow::bail!("artifact name must not be empty");
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        anyhow::bail!("artifact name contains unsafe path characters: {name}");
    }
    Ok(())
}

// ─── Domain types ─────────────────────────────────────────────────────────────

/// A single artifact (file or directory) in the metadata index.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactEntry {
    pub id: String,
    /// Associated service project ID, or `None` for the "Local" bucket.
    pub service_id: Option<String>,
    /// Relative path from the artifacts root (e.g. `"svc-abc/images/photo.jpg"`).
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub parent_path: Option<String>,
    pub size_bytes: Option<i64>,
    pub mime_type: Option<String>,
    pub starred: bool,
    pub created_at_ms: i64,
    pub modified_at_ms: i64,
}

/// User-configurable settings for the artifact store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactsSettings {
    /// Absolute path to the local artifacts root directory.
    pub base_path: String,
}

impl Default for ArtifactsSettings {
    fn default() -> Self {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
        Self {
            base_path: PathBuf::from(home)
                .join("OpenWorship")
                .join("Artifacts")
                .to_string_lossy()
                .into_owned(),
        }
    }
}

// ─── Database ─────────────────────────────────────────────────────────────────

pub struct ArtifactsDb {
    conn: Connection,
    settings: ArtifactsSettings,
}

impl ArtifactsDb {
    pub fn open() -> Result<Self> {
        let path = db_path()?;
        if let Some(p) = path.parent() {
            std::fs::create_dir_all(p)?;
        }
        let conn = Connection::open(&path)
            .with_context(|| format!("open artifacts db: {}", path.display()))?;
        let db = Self { conn, settings: load_settings() };
        db.migrate()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn, settings: ArtifactsSettings::default() };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS artifacts (
               id            TEXT PRIMARY KEY,
               service_id    TEXT,
               path          TEXT NOT NULL UNIQUE,
               name          TEXT NOT NULL,
               is_dir        INTEGER NOT NULL DEFAULT 0,
               parent_path   TEXT,
               size_bytes    INTEGER,
               mime_type     TEXT,
               starred       INTEGER NOT NULL DEFAULT 0,
               created_at_ms INTEGER NOT NULL,
               modified_at_ms INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_artifacts_service ON artifacts(service_id);
             CREATE INDEX IF NOT EXISTS idx_artifacts_parent  ON artifacts(parent_path);
             CREATE INDEX IF NOT EXISTS idx_artifacts_starred ON artifacts(starred);",
        )?;
        Ok(())
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    pub fn list(
        &self,
        service_id: Option<&str>,
        parent_path: Option<&str>,
    ) -> Result<Vec<ArtifactEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,service_id,path,name,is_dir,parent_path,size_bytes,mime_type,
                    starred,created_at_ms,modified_at_ms
             FROM artifacts
             WHERE (service_id IS ?1 OR (?1 IS NULL AND service_id IS NULL))
               AND (parent_path IS ?2 OR (?2 IS NULL AND parent_path IS NULL))
             ORDER BY is_dir DESC, name ASC",
        )?;
        let rows = stmt.query_map(params![service_id, parent_path], map_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    pub fn list_all(&self) -> Result<Vec<ArtifactEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,service_id,path,name,is_dir,parent_path,size_bytes,mime_type,
                    starred,created_at_ms,modified_at_ms
             FROM artifacts ORDER BY modified_at_ms DESC",
        )?;
        let rows = stmt.query_map([], map_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    pub fn list_recent(&self, limit: usize) -> Result<Vec<ArtifactEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,service_id,path,name,is_dir,parent_path,size_bytes,mime_type,
                    starred,created_at_ms,modified_at_ms
             FROM artifacts WHERE is_dir=0
             ORDER BY modified_at_ms DESC LIMIT ?",
        )?;
        let rows = stmt.query_map(params![limit as i64], map_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    pub fn list_starred(&self) -> Result<Vec<ArtifactEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,service_id,path,name,is_dir,parent_path,size_bytes,mime_type,
                    starred,created_at_ms,modified_at_ms
             FROM artifacts WHERE starred=1 ORDER BY name ASC",
        )?;
        let rows = stmt.query_map([], map_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    pub fn search(&self, query: &str, service_id: Option<&str>) -> Result<Vec<ArtifactEntry>> {
        let pattern = format!("%{query}%");
        let mut stmt = self.conn.prepare(
            "SELECT id,service_id,path,name,is_dir,parent_path,size_bytes,mime_type,
                    starred,created_at_ms,modified_at_ms
             FROM artifacts
             WHERE name LIKE ? COLLATE NOCASE
               AND (? IS NULL OR service_id=?)
             ORDER BY name ASC LIMIT 100",
        )?;
        let rows = stmt.query_map(params![pattern, service_id, service_id], map_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    pub fn get_by_id(&self, id: &str) -> Result<Option<ArtifactEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,service_id,path,name,is_dir,parent_path,size_bytes,mime_type,
                    starred,created_at_ms,modified_at_ms
             FROM artifacts WHERE id=?",
        )?;
        let rows = stmt.query_map(params![id], map_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out.into_iter().next())
    }

    pub fn upsert(&self, e: &ArtifactEntry) -> Result<()> {
        self.conn.execute(
            "INSERT INTO artifacts (id,service_id,path,name,is_dir,parent_path,size_bytes,
                                    mime_type,starred,created_at_ms,modified_at_ms)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
             ON CONFLICT(path) DO UPDATE SET
               name=excluded.name, size_bytes=excluded.size_bytes,
               mime_type=excluded.mime_type, modified_at_ms=excluded.modified_at_ms",
            params![
                e.id, e.service_id, e.path, e.name, e.is_dir as i64,
                e.parent_path, e.size_bytes, e.mime_type, e.starred as i64,
                e.created_at_ms, e.modified_at_ms,
            ],
        )?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM artifacts WHERE id=?", params![id])?;
        Ok(())
    }

    pub fn delete_by_path_prefix(&self, prefix: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM artifacts WHERE path LIKE ?",
            params![format!("{prefix}%")],
        )?;
        Ok(())
    }

    pub fn toggle_star(&self, id: &str, starred: bool) -> Result<()> {
        self.conn.execute(
            "UPDATE artifacts SET starred=? WHERE id=?",
            params![starred as i64, id],
        )?;
        Ok(())
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    pub fn settings(&self) -> &ArtifactsSettings {
        &self.settings
    }

    pub fn set_base_path(&mut self, path: String) -> Result<()> {
        self.settings.base_path = path;
        save_settings(&self.settings)
    }

    // ── FS helpers ────────────────────────────────────────────────────────────

    pub fn abs_path(&self, rel: &str) -> PathBuf {
        PathBuf::from(&self.settings.base_path).join(rel)
    }

    pub fn ensure_base_dir(&self) -> Result<()> {
        std::fs::create_dir_all(&self.settings.base_path)
            .with_context(|| format!("create artifacts dir: {}", self.settings.base_path))
    }
}

// ─── File operations ──────────────────────────────────────────────────────────

pub fn create_dir(
    db: &mut ArtifactsDb,
    service_id: Option<String>,
    parent_path: Option<String>,
    name: String,
) -> Result<ArtifactEntry> {
    safe_name(&name)?;
    db.ensure_base_dir()?;
    let rel = match &parent_path {
        Some(p) => format!("{p}/{name}"),
        None => format!("{}/{name}", service_id.as_deref().unwrap_or("_local")),
    };
    std::fs::create_dir_all(db.abs_path(&rel))?;
    let entry = ArtifactEntry {
        id: new_id(),
        service_id,
        path: rel,
        name,
        is_dir: true,
        parent_path,
        size_bytes: None,
        mime_type: None,
        starred: false,
        created_at_ms: now_ms(),
        modified_at_ms: now_ms(),
    };
    db.upsert(&entry)?;
    Ok(entry)
}

pub fn import_file(
    db: &mut ArtifactsDb,
    service_id: Option<String>,
    parent_path: Option<String>,
    src: &Path,
) -> Result<ArtifactEntry> {
    db.ensure_base_dir()?;
    let name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    let bucket = parent_path
        .clone()
        .unwrap_or_else(|| service_id.as_deref().unwrap_or("_local").to_string());
    let rel = format!("{bucket}/{name}");
    let dest = db.abs_path(&rel);
    if let Some(p) = dest.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::copy(src, &dest)
        .with_context(|| format!("copy {} -> {}", src.display(), dest.display()))?;
    let meta = std::fs::metadata(&dest)?;
    let mime_type = mime_guess::from_path(&dest).first().map(|m| m.to_string());
    let entry = ArtifactEntry {
        id: new_id(),
        service_id,
        path: rel,
        name,
        is_dir: false,
        parent_path: Some(bucket),
        size_bytes: Some(meta.len() as i64),
        mime_type,
        starred: false,
        created_at_ms: now_ms(),
        modified_at_ms: now_ms(),
    };
    db.upsert(&entry)?;
    Ok(entry)
}

pub fn rename_artifact(db: &mut ArtifactsDb, id: &str, new_name: String) -> Result<ArtifactEntry> {
    safe_name(&new_name)?;
    let mut e = db
        .get_by_id(id)?
        .ok_or_else(|| anyhow::anyhow!("artifact not found: {id}"))?;
    let old_abs = db.abs_path(&e.path);
    let new_rel = match &e.parent_path {
        Some(p) => format!("{p}/{new_name}"),
        None => new_name.clone(),
    };
    std::fs::rename(&old_abs, db.abs_path(&new_rel))
        .with_context(|| format!("rename {}", old_abs.display()))?;
    if e.is_dir {
        db.conn.execute(
            "UPDATE artifacts SET
               path = replace(path, ?1, ?2),
               parent_path = replace(parent_path, ?1, ?2)
             WHERE path LIKE ?3",
            params![e.path, new_rel, format!("{}%", e.path)],
        )?;
    }
    db.delete(id)?;
    e.path = new_rel;
    e.name = new_name;
    e.modified_at_ms = now_ms();
    db.upsert(&e)?;
    Ok(e)
}

pub fn delete_artifact(db: &mut ArtifactsDb, id: &str) -> Result<()> {
    let e = db
        .get_by_id(id)?
        .ok_or_else(|| anyhow::anyhow!("artifact not found: {id}"))?;
    let abs = db.abs_path(&e.path);
    if e.is_dir {
        if abs.exists() {
            std::fs::remove_dir_all(&abs)?;
        }
        db.delete_by_path_prefix(&e.path)?;
    } else {
        if abs.exists() {
            std::fs::remove_file(&abs)?;
        }
        db.delete(id)?;
    }
    Ok(())
}

pub fn move_artifact(
    db: &mut ArtifactsDb,
    id: &str,
    new_parent: String,
) -> Result<ArtifactEntry> {
    let mut e = db
        .get_by_id(id)?
        .ok_or_else(|| anyhow::anyhow!("artifact not found: {id}"))?;
    let new_rel = format!("{new_parent}/{}", e.name);
    let new_abs = db.abs_path(&new_rel);
    if let Some(p) = new_abs.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::rename(db.abs_path(&e.path), &new_abs)
        .with_context(|| format!("mv -> {}", new_abs.display()))?;
    db.delete(&e.id)?;
    e.path = new_rel;
    e.parent_path = Some(new_parent);
    e.modified_at_ms = now_ms();
    db.upsert(&e)?;
    Ok(e)
}

// ─── Settings persistence ─────────────────────────────────────────────────────

fn db_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Ok(PathBuf::from(home).join(".openworship").join("artifacts.db"))
}

fn settings_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".openworship").join("artifacts_settings.json")
}

fn load_settings() -> ArtifactsSettings {
    let path = settings_path();
    if !path.exists() {
        return ArtifactsSettings::default();
    }
    std::fs::read(&path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn save_settings(s: &ArtifactsSettings) -> Result<()> {
    let path = settings_path();
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(&path, serde_json::to_vec_pretty(s)?)?;
    Ok(())
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ArtifactEntry> {
    Ok(ArtifactEntry {
        id: row.get(0)?,
        service_id: row.get(1)?,
        path: row.get(2)?,
        name: row.get(3)?,
        is_dir: row.get::<_, i64>(4)? != 0,
        parent_path: row.get(5)?,
        size_bytes: row.get(6)?,
        mime_type: row.get(7)?,
        starred: row.get::<_, i64>(8)? != 0,
        created_at_ms: row.get(9)?,
        modified_at_ms: row.get(10)?,
    })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_empty_db() {
        let db = ArtifactsDb::open_in_memory().unwrap();
        assert!(db.list(None, None).unwrap().is_empty());
    }

    #[test]
    fn upsert_and_list() {
        let db = ArtifactsDb::open_in_memory().unwrap();
        let e = ArtifactEntry {
            id: "e1".into(), service_id: Some("s1".into()),
            path: "s1/img.jpg".into(), name: "img.jpg".into(), is_dir: false,
            parent_path: Some("s1".into()), size_bytes: Some(1024),
            mime_type: Some("image/jpeg".into()), starred: false,
            created_at_ms: 1000, modified_at_ms: 1000,
        };
        db.upsert(&e).unwrap();
        let list = db.list(Some("s1"), Some("s1")).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "img.jpg");
    }

    #[test]
    fn search_by_name() {
        let db = ArtifactsDb::open_in_memory().unwrap();
        for name in &["sermon.pdf", "song.mp3", "slides.pptx"] {
            db.upsert(&ArtifactEntry {
                id: new_id(), service_id: None, path: format!("_local/{name}"),
                name: name.to_string(), is_dir: false, parent_path: Some("_local".into()),
                size_bytes: Some(512), mime_type: None, starred: false,
                created_at_ms: now_ms(), modified_at_ms: now_ms(),
            }).unwrap();
        }
        let r = db.search("sermon", None).unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].name, "sermon.pdf");
    }

    #[test]
    fn star_toggle() {
        let db = ArtifactsDb::open_in_memory().unwrap();
        db.upsert(&ArtifactEntry {
            id: "s1".into(), service_id: None, path: "_local/f.txt".into(),
            name: "f.txt".into(), is_dir: false, parent_path: Some("_local".into()),
            size_bytes: Some(10), mime_type: None, starred: false,
            created_at_ms: 1, modified_at_ms: 1,
        }).unwrap();
        db.toggle_star("s1", true).unwrap();
        assert_eq!(db.list_starred().unwrap().len(), 1);
        db.toggle_star("s1", false).unwrap();
        assert!(db.list_starred().unwrap().is_empty());
    }

    #[test]
    fn delete_entry() {
        let db = ArtifactsDb::open_in_memory().unwrap();
        db.upsert(&ArtifactEntry {
            id: "d1".into(), service_id: None, path: "_local/del.txt".into(),
            name: "del.txt".into(), is_dir: false, parent_path: Some("_local".into()),
            size_bytes: None, mime_type: None, starred: false,
            created_at_ms: 1, modified_at_ms: 1,
        }).unwrap();
        db.delete("d1").unwrap();
        assert!(db.list(None, None).unwrap().is_empty());
    }
}
