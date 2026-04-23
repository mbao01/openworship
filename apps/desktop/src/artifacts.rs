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

/// Reject names that contain path separators, traverse upward, or are otherwise unsafe.
fn safe_name(name: &str) -> Result<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        anyhow::bail!("artifact name must not be empty");
    }
    if name.contains('\0') {
        anyhow::bail!("artifact name contains null byte");
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        anyhow::bail!("artifact name contains unsafe path characters: {name}");
    }
    if name.len() > 255 {
        anyhow::bail!("artifact name too long (max 255 bytes)");
    }
    Ok(())
}

/// Assert that `path` is inside `base`, guarding against path traversal.
fn assert_within_base(base: &Path, path: &Path) -> Result<()> {
    let canonical_base = base
        .canonicalize()
        .unwrap_or_else(|_| base.to_path_buf());
    let canonical_path = path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf());
    if !canonical_path.starts_with(&canonical_base) {
        anyhow::bail!(
            "path traversal detected: {} is outside artifacts root {}",
            path.display(),
            base.display()
        );
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
    #[serde(default)]
    pub thumbnail_path: Option<String>,
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
                .join(".openworship")
                .join("artifacts")
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
               modified_at_ms INTEGER NOT NULL,
               thumbnail_path TEXT
             );
             CREATE INDEX IF NOT EXISTS idx_artifacts_service ON artifacts(service_id);
             CREATE INDEX IF NOT EXISTS idx_artifacts_parent  ON artifacts(parent_path);
             CREATE INDEX IF NOT EXISTS idx_artifacts_starred ON artifacts(starred);",
        )?;
        // Migration: add thumbnail_path column for existing databases.
        self.conn
            .execute_batch("ALTER TABLE artifacts ADD COLUMN thumbnail_path TEXT;")
            .ok(); // ignore error if column already exists
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
                    starred,created_at_ms,modified_at_ms,thumbnail_path
             FROM artifacts
             WHERE (service_id IS ?1 OR (?1 IS NULL AND service_id IS NULL))
               AND (parent_path IS ?2 OR (?2 IS NULL AND parent_path IS NULL))
               AND name != '_thumbnails' AND path NOT LIKE '%/_thumbnails/%'
             ORDER BY is_dir DESC, name ASC",
        )?;
        let rows = stmt.query_map(params![service_id, parent_path], map_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    #[allow(dead_code)]
    pub fn list_all(&self) -> Result<Vec<ArtifactEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,service_id,path,name,is_dir,parent_path,size_bytes,mime_type,
                    starred,created_at_ms,modified_at_ms,thumbnail_path
             FROM artifacts
             WHERE name != '_thumbnails' AND path NOT LIKE '%/_thumbnails/%'
             ORDER BY modified_at_ms DESC",
        )?;
        let rows = stmt.query_map([], map_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    pub fn list_recent(&self, limit: usize) -> Result<Vec<ArtifactEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,service_id,path,name,is_dir,parent_path,size_bytes,mime_type,
                    starred,created_at_ms,modified_at_ms,thumbnail_path
             FROM artifacts WHERE is_dir=0
               AND name != '_thumbnails' AND path NOT LIKE '%/_thumbnails/%'
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
                    starred,created_at_ms,modified_at_ms,thumbnail_path
             FROM artifacts WHERE starred=1
               AND name != '_thumbnails' AND path NOT LIKE '%/_thumbnails/%'
             ORDER BY name ASC",
        )?;
        let rows = stmt.query_map([], map_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    /// Returns all non-directory artifacts that have no thumbnail yet.
    pub fn list_missing_thumbnails(&self) -> Result<Vec<ArtifactEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,service_id,path,name,is_dir,parent_path,size_bytes,mime_type,
                    starred,created_at_ms,modified_at_ms,thumbnail_path
             FROM artifacts
             WHERE is_dir=0
               AND thumbnail_path IS NULL
               AND name != '_thumbnails' AND path NOT LIKE '%/_thumbnails/%'
             ORDER BY modified_at_ms DESC",
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
                    starred,created_at_ms,modified_at_ms,thumbnail_path
             FROM artifacts
             WHERE name LIKE ? COLLATE NOCASE
               AND (? IS NULL OR service_id=?)
               AND name != '_thumbnails' AND path NOT LIKE '%/_thumbnails/%'
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
                    starred,created_at_ms,modified_at_ms,thumbnail_path
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
                                    mime_type,starred,created_at_ms,modified_at_ms,thumbnail_path)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
             ON CONFLICT(path) DO UPDATE SET
               name=excluded.name, size_bytes=excluded.size_bytes,
               mime_type=excluded.mime_type, modified_at_ms=excluded.modified_at_ms,
               thumbnail_path=excluded.thumbnail_path",
            params![
                e.id, e.service_id, e.path, e.name, e.is_dir as i64,
                e.parent_path, e.size_bytes, e.mime_type, e.starred as i64,
                e.created_at_ms, e.modified_at_ms, e.thumbnail_path,
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

// ─── Thumbnail generation ─────────────────────────────────────────────────────

/// MIME types that should never get thumbnails.
fn skip_thumbnail(mime: &str) -> bool {
    matches!(
        mime,
        "text/plain"
            | "text/x-shellscript"
            | "application/x-sh"
            | "application/x-csh"
            | "application/x-executable"
            | "application/x-mach-binary"
            | "application/x-elf"
            | "application/x-dosexec"
            | "application/x-sharedlib"
            | "application/octet-stream"
            | "application/x-object"
    )
}

pub fn generate_thumbnail(abs_path: &std::path::Path, base_dir: &std::path::Path) -> Option<String> {
    let mime = mime_guess::from_path(abs_path).first_or_octet_stream();
    let mime_str = mime.to_string();

    if skip_thumbnail(&mime_str) {
        return None;
    }

    // Fast path: use the image crate for raster images (no subprocess needed)
    let img = if mime_str.starts_with("image/") && mime_str != "image/svg+xml" {
        image::open(abs_path).ok()?
    } else {
        // For everything else (video, PDF, Office docs, SVG, fonts, etc.)
        // use the platform-specific thumbnail generator.
        platform_thumbnail(abs_path, &mime_str)?
    };

    let thumb = img.thumbnail(128, 128);

    let parent = abs_path.parent()?;
    let thumb_dir = parent.join("_thumbnails");
    std::fs::create_dir_all(&thumb_dir).ok()?;

    let stem = abs_path.file_stem()?.to_str()?;
    let thumb_name = format!("{stem}.thumb.jpg");
    let thumb_abs = thumb_dir.join(&thumb_name);

    let file = std::fs::File::create(&thumb_abs).ok()?;
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(file, 85);
    thumb.write_with_encoder(encoder).ok()?;

    let rel = thumb_abs.strip_prefix(base_dir).ok()?;
    Some(rel.to_string_lossy().into_owned())
}

// ─── Platform-specific thumbnail backends ────────────────────────────────────

/// Dispatch to the best available thumbnail backend for the current OS.
/// Each backend handles videos, PDFs, Office docs, and more via native OS APIs.
fn platform_thumbnail(file_path: &std::path::Path, mime: &str) -> Option<image::DynamicImage> {
    // Try the OS-native thumbnailer first (handles the widest range of formats)
    if let Some(img) = os_native_thumbnail(file_path) {
        return Some(img);
    }
    eprintln!("[thumbnail] OS-native thumbnailer failed for {:?} ({})", file_path.file_name(), mime);
    // Fallback: use ffmpeg for video files (cross-platform)
    if mime.starts_with("video/") {
        if let Some(img) = ffmpeg_thumbnail(file_path) {
            return Some(img);
        }
        eprintln!("[thumbnail] ffmpeg fallback also failed for {:?} — is ffmpeg installed?", file_path.file_name());
    }
    None
}

/// Try to extract a video frame using ffmpeg (available on all platforms).
fn ffmpeg_thumbnail(file_path: &std::path::Path) -> Option<image::DynamicImage> {
    let tmp_dir = std::env::temp_dir().join("ow_ffmpeg_thumbs");
    std::fs::create_dir_all(&tmp_dir).ok()?;

    let stem = file_path.file_stem()?.to_str()?;
    let out_path = tmp_dir.join(format!("{stem}.thumb.png"));

    // Extract a frame at 1 second into the video
    let status = std::process::Command::new("ffmpeg")
        .args(["-y", "-i"])
        .arg(file_path)
        .args(["-ss", "1", "-vframes", "1", "-vf", "scale=256:-1"])
        .arg(&out_path)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .ok()?;

    if !status.success() {
        return None;
    }

    let img = image::open(&out_path).ok();
    let _ = std::fs::remove_file(&out_path);
    img
}

// ── macOS: Quick Look (qlmanage) ─────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn os_native_thumbnail(file_path: &std::path::Path) -> Option<image::DynamicImage> {
    let tmp_dir = std::env::temp_dir().join("ow_ql_thumbs");
    std::fs::create_dir_all(&tmp_dir).ok()?;

    let status = std::process::Command::new("qlmanage")
        .args(["-t", "-s", "256", "-o"])
        .arg(&tmp_dir)
        .arg(file_path)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .ok()?;

    if !status.success() {
        return None;
    }

    let file_name = file_path.file_name()?.to_str()?;
    let thumb_path = tmp_dir.join(format!("{file_name}.png"));
    let img = image::open(&thumb_path).ok();
    let _ = std::fs::remove_file(&thumb_path);
    img
}

// ── Windows: PowerShell + Shell API thumbnail extraction ─────────────────────

#[cfg(target_os = "windows")]
fn os_native_thumbnail(file_path: &std::path::Path) -> Option<image::DynamicImage> {
    let tmp_dir = std::env::temp_dir().join("ow_win_thumbs");
    std::fs::create_dir_all(&tmp_dir).ok()?;

    let stem = file_path.file_stem()?.to_str()?;
    let out_path = tmp_dir.join(format!("{stem}.thumb.png"));
    let file_str = file_path.to_str()?;
    let out_str = out_path.to_str()?;

    // PowerShell script that uses the Windows Shell COM API to extract thumbnails.
    // Works for videos, PDFs, Office docs, images, and any file type with a
    // registered thumbnail handler.
    let script = format!(
        r#"
Add-Type -AssemblyName System.Drawing
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace((Split-Path -Parent '{file_str}'))
$item = $folder.ParseName((Split-Path -Leaf '{file_str}'))
$bmp = $null
try {{
    # Use ShellItem image factory via .NET interop
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IShellItemImageFactory {{
    void GetImage([In, MarshalAs(UnmanagedType.Struct)] SIZE size, [In] int flags, out IntPtr hBitmap);
}}
[StructLayout(LayoutKind.Sequential)]
public struct SIZE {{ public int cx; public int cy; }}
public class ShellThumb {{
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    static extern void SHCreateItemFromParsingName(string pszPath, IntPtr pbc, ref Guid riid, out IShellItemImageFactory ppv);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr hObject);
    public static void Save(string path, string outPath) {{
        Guid iid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
        IShellItemImageFactory factory;
        SHCreateItemFromParsingName(path, IntPtr.Zero, ref iid, out factory);
        SIZE sz; sz.cx = 256; sz.cy = 256;
        IntPtr hBmp;
        factory.GetImage(sz, 0, out hBmp);
        var bmp = System.Drawing.Image.FromHbitmap(hBmp);
        bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
        bmp.Dispose();
        DeleteObject(hBmp);
    }}
}}
"@
    [ShellThumb]::Save('{file_str}', '{out_str}')
}} catch {{
    exit 1
}}
"#
    );

    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .ok()?;

    if !status.success() {
        return None;
    }

    let img = image::open(&out_path).ok();
    let _ = std::fs::remove_file(&out_path);
    img
}

// ── Linux: freedesktop thumbnailers ──────────────────────────────────────────

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn os_native_thumbnail(file_path: &std::path::Path) -> Option<image::DynamicImage> {
    let tmp_dir = std::env::temp_dir().join("ow_linux_thumbs");
    std::fs::create_dir_all(&tmp_dir).ok()?;

    let stem = file_path.file_stem()?.to_str()?;
    let out_path = tmp_dir.join(format!("{stem}.thumb.png"));

    // Try gnome-thumbnail (handles most file types on GNOME desktops)
    let gnome = std::process::Command::new("gnome-desktop-thumbnailer")
        .arg(file_path)
        .arg(&out_path)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    if gnome.map(|s| s.success()).unwrap_or(false) {
        let img = image::open(&out_path).ok();
        let _ = std::fs::remove_file(&out_path);
        return img;
    }

    // Fallback: ffmpegthumbnailer (common on Linux, handles videos well)
    let ffthumb = std::process::Command::new("ffmpegthumbnailer")
        .args(["-i"])
        .arg(file_path)
        .args(["-o"])
        .arg(&out_path)
        .args(["-s", "256", "-t", "10"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    if ffthumb.map(|s| s.success()).unwrap_or(false) {
        let img = image::open(&out_path).ok();
        let _ = std::fs::remove_file(&out_path);
        return img;
    }

    None
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
    let abs = db.abs_path(&rel);
    assert_within_base(PathBuf::from(&db.settings.base_path).as_path(), &abs)?;
    std::fs::create_dir_all(&abs)?;
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
        thumbnail_path: None,
    };
    db.upsert(&entry)?;
    Ok(entry)
}

#[allow(dead_code)]
pub fn import_file(
    db: &mut ArtifactsDb,
    service_id: Option<String>,
    parent_path: Option<String>,
    src: &Path,
) -> Result<ArtifactEntry> {
    let mut entry = import_file_no_thumb(db, service_id, parent_path, src)?;
    let base_dir = PathBuf::from(&db.settings.base_path);
    let dest = db.abs_path(&entry.path);
    entry.thumbnail_path = generate_thumbnail(&dest, &base_dir);
    db.upsert(&entry)?;
    Ok(entry)
}

/// Same as `import_file` but skips thumbnail generation.
/// Used when thumbnails are generated in a background thread.
pub fn import_file_no_thumb(
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
        thumbnail_path: None,
    };
    db.upsert(&entry)?;
    Ok(entry)
}

/// Write raw bytes from the frontend directly into the artifact store.
/// This is the primary upload path for the Tauri webview, where the native
/// file path is not accessible via `<input type="file">`.
pub fn write_artifact_bytes(
    db: &mut ArtifactsDb,
    service_id: Option<String>,
    parent_path: Option<String>,
    file_name: String,
    data: Vec<u8>,
) -> Result<ArtifactEntry> {
    safe_name(&file_name)?;
    db.ensure_base_dir()?;
    let bucket = parent_path
        .clone()
        .unwrap_or_else(|| service_id.as_deref().unwrap_or("_local").to_string());
    let rel = format!("{bucket}/{file_name}");
    let dest = db.abs_path(&rel);
    if let Some(p) = dest.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(&dest, &data)
        .with_context(|| format!("write artifact: {}", dest.display()))?;
    let mime_type = mime_guess::from_path(&dest).first().map(|m| m.to_string());
    let base_dir = PathBuf::from(&db.settings.base_path);
    let thumbnail_path = generate_thumbnail(&dest, &base_dir);
    let entry = ArtifactEntry {
        id: new_id(),
        service_id,
        path: rel,
        name: file_name,
        is_dir: false,
        parent_path: Some(bucket),
        size_bytes: Some(data.len() as i64),
        mime_type,
        starred: false,
        created_at_ms: now_ms(),
        modified_at_ms: now_ms(),
        thumbnail_path,
    };
    db.upsert(&entry)?;
    Ok(entry)
}

/// Same as `write_artifact_bytes` but skips thumbnail generation.
/// Used when thumbnails are generated in a background thread.
pub fn write_artifact_bytes_no_thumb(
    db: &mut ArtifactsDb,
    service_id: Option<String>,
    parent_path: Option<String>,
    file_name: String,
    data: Vec<u8>,
) -> Result<ArtifactEntry> {
    safe_name(&file_name)?;
    db.ensure_base_dir()?;
    let bucket = parent_path
        .clone()
        .unwrap_or_else(|| service_id.as_deref().unwrap_or("_local").to_string());
    let rel = format!("{bucket}/{file_name}");
    let dest = db.abs_path(&rel);
    if let Some(p) = dest.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(&dest, &data)
        .with_context(|| format!("write artifact: {}", dest.display()))?;
    let mime_type = mime_guess::from_path(&dest).first().map(|m| m.to_string());
    let entry = ArtifactEntry {
        id: new_id(),
        service_id,
        path: rel,
        name: file_name,
        is_dir: false,
        parent_path: Some(bucket),
        size_bytes: Some(data.len() as i64),
        mime_type,
        starred: false,
        created_at_ms: now_ms(),
        modified_at_ms: now_ms(),
        thumbnail_path: None,
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
            // Replace the leading prefix exactly, not all occurrences.
            // ?1 = old prefix, ?2 = new prefix, ?3 = old prefix length, ?4 = LIKE pattern
            "UPDATE artifacts SET
               path = ?2 || substr(path, ?3),
               parent_path = CASE
                 WHEN parent_path = ?1 THEN ?2
                 WHEN parent_path LIKE ?4 THEN ?2 || substr(parent_path, ?3)
                 ELSE parent_path
               END
             WHERE path LIKE ?4",
            params![
                e.path,
                new_rel,
                (e.path.len() + 1) as i64,
                format!("{}/%", e.path)
            ],
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
    // Delete from DB first so a crash mid-operation doesn't leave ghost rows.
    if e.is_dir {
        db.delete_by_path_prefix(&e.path)?;
        if abs.exists() {
            std::fs::remove_dir_all(&abs)?;
        }
    } else {
        db.delete(id)?;
        if abs.exists() {
            std::fs::remove_file(&abs)?;
        }
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
    assert_within_base(PathBuf::from(&db.settings.base_path).as_path(), &new_abs)?;
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
        thumbnail_path: row.get(11)?,
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
            created_at_ms: 1000, modified_at_ms: 1000, thumbnail_path: None,
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
                created_at_ms: now_ms(), modified_at_ms: now_ms(), thumbnail_path: None,
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
            created_at_ms: 1, modified_at_ms: 1, thumbnail_path: None,
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
            created_at_ms: 1, modified_at_ms: 1, thumbnail_path: None,
        }).unwrap();
        db.delete("d1").unwrap();
        assert!(db.list(None, None).unwrap().is_empty());
    }

    // ── safe_name tests ──────────────────────────────────────────────────

    #[test]
    fn safe_name_accepts_normal_names() {
        assert!(safe_name("photo.jpg").is_ok());
        assert!(safe_name("my-file_2024.pdf").is_ok());
        assert!(safe_name("sermon notes.docx").is_ok());
    }

    #[test]
    fn safe_name_rejects_forward_slash() {
        assert!(safe_name("path/file.txt").is_err());
    }

    #[test]
    fn safe_name_rejects_backslash() {
        assert!(safe_name("path\\file.txt").is_err());
    }

    #[test]
    fn safe_name_rejects_dot_dot_traversal() {
        assert!(safe_name("../etc/passwd").is_err());
        assert!(safe_name("foo..bar").is_err());
    }

    #[test]
    fn safe_name_rejects_null_bytes() {
        assert!(safe_name("file\0name.txt").is_err());
    }

    #[test]
    fn safe_name_rejects_empty_string() {
        assert!(safe_name("").is_err());
        assert!(safe_name("   ").is_err());
    }

    #[test]
    fn safe_name_rejects_names_over_255_chars() {
        let long_name = "a".repeat(256);
        assert!(safe_name(&long_name).is_err());
        // Exactly 255 should be ok
        let ok_name = "a".repeat(255);
        assert!(safe_name(&ok_name).is_ok());
    }

    // ── assert_within_base tests ─────────────────────────────────────────

    #[test]
    fn assert_within_base_rejects_path_traversal() {
        // Create real directories so canonicalize resolves the paths
        let base = std::env::temp_dir().join("ow_traversal_test_base");
        std::fs::create_dir_all(&base).unwrap();
        // An evil path that resolves outside base (e.g. /tmp itself)
        let evil = base.join("..").join("ow_traversal_evil_target");
        std::fs::create_dir_all(&evil).unwrap();
        let result = assert_within_base(&base, &evil);
        assert!(result.is_err(), "path traversal should be rejected");
        let _ = std::fs::remove_dir_all(&base);
        let _ = std::fs::remove_dir_all(&evil);
    }

    #[test]
    fn assert_within_base_accepts_child_path() {
        // Use temp dir so canonicalize works
        let base = std::env::temp_dir().join("ow_base_test");
        let child = base.join("subdir").join("file.txt");
        std::fs::create_dir_all(base.join("subdir")).ok();
        std::fs::write(&child, b"test").ok();
        let result = assert_within_base(&base, &child);
        assert!(result.is_ok(), "child path should be accepted: {:?}", result);
        let _ = std::fs::remove_dir_all(&base);
    }
}
