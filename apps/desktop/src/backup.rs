//! Local backup and restore for all church data.
//!
//! Archive format: `.openworship-backup` — a gzip-compressed tar archive.
//!
//! Contents:
//!   manifest.json              — version metadata (format "1")
//!   data/settings.json         — audio / STT settings
//!   data/display_settings.json
//!   data/identity.json
//!   data/projects.json
//!   data/content_bank.json
//!   data/announcements.json
//!   data/sermon_notes.json
//!   data/summaries.json
//!   data/subscribers.json
//!   data/email_settings.json
//!   data/cloud_config.json
//!   songs.db
//!   artifacts.db
//!   cloud_sync.db
//!   artifacts/                 — user-uploaded media files (recursive)
//!
//! Sensitive keychain entries (API keys, passwords) are NOT included.
//! Restore is transactional: the archive is fully extracted and validated
//! to a staging directory before any live file is overwritten.

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const BACKUP_FORMAT_VERSION: &str = "1";

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupManifest {
    pub version: String,
    pub created_at_ms: u64,
    pub app_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupInfo {
    pub path: String,
    pub size_bytes: u64,
    pub created_at_ms: u64,
}

pub fn openworship_dir() -> Result<PathBuf> {
    let home = std::env::var("HOME").context("HOME environment variable not set")?;
    Ok(PathBuf::from(home).join(".openworship"))
}

const DATA_FILES: &[&str] = &[
    "settings.json",
    "display_settings.json",
    "identity.json",
    "projects.json",
    "content_bank.json",
    "announcements.json",
    "sermon_notes.json",
    "summaries.json",
    "subscribers.json",
    "email_settings.json",
    "cloud_config.json",
];

const DB_FILES: &[&str] = &["songs.db", "artifacts.db", "cloud_sync.db"];

/// Create a backup archive and write it to `dest_path`.
#[tauri::command]
pub fn create_backup(dest_path: String) -> Result<BackupInfo, String> {
    create_backup_inner(&dest_path).map_err(|e| e.to_string())
}

/// Restore data from a backup archive at `src_path`.
///
/// Transactional: the archive is fully extracted to a staging directory and
/// validated before any live data is replaced.  Restart the app after restore.
#[tauri::command]
pub fn restore_backup(src_path: String) -> Result<(), String> {
    restore_backup_inner(&src_path).map_err(|e| e.to_string())
}

fn create_backup_inner(dest_path: &str) -> Result<BackupInfo> {
    use flate2::write::GzEncoder;
    use flate2::Compression;

    let data_dir = openworship_dir()?;
    let dest = Path::new(dest_path);

    if let Some(parent) = dest.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent)?;
        }
    }

    let file = std::fs::File::create(dest)
        .with_context(|| format!("create backup file: {}", dest.display()))?;

    let gz = GzEncoder::new(file, Compression::default());
    let mut ar = tar::Builder::new(gz);

    let created_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let manifest = BackupManifest {
        version: BACKUP_FORMAT_VERSION.into(),
        created_at_ms,
        app_version: env!("CARGO_PKG_VERSION").into(),
    };
    let manifest_json = serde_json::to_vec_pretty(&manifest)?;
    let mut header = tar::Header::new_gnu();
    header.set_size(manifest_json.len() as u64);
    header.set_mode(0o644);
    header.set_mtime(created_at_ms / 1000);
    header.set_cksum();
    ar.append_data(&mut header, "manifest.json", manifest_json.as_slice())
        .context("append manifest.json")?;

    for name in DATA_FILES {
        let path = data_dir.join(name);
        if path.exists() {
            ar.append_path_with_name(&path, format!("data/{name}"))
                .with_context(|| format!("append data/{name}"))?;
        }
    }

    for name in DB_FILES {
        let path = data_dir.join(name);
        if path.exists() {
            ar.append_path_with_name(&path, name)
                .with_context(|| format!("append {name}"))?;
        }
    }

    let artifacts_dir = data_dir.join("artifacts");
    if artifacts_dir.is_dir() {
        append_dir_recursive(&mut ar, &artifacts_dir, Path::new("artifacts"))?;
    }

    let gz_enc = ar.into_inner().context("finalise tar archive")?;
    gz_enc.finish().context("finalise gzip stream")?;

    let size_bytes = std::fs::metadata(dest).map(|m| m.len()).unwrap_or(0);

    Ok(BackupInfo {
        path: dest_path.to_string(),
        size_bytes,
        created_at_ms,
    })
}

fn append_dir_recursive<W: std::io::Write>(
    ar: &mut tar::Builder<W>,
    src_dir: &Path,
    entry_prefix: &Path,
) -> Result<()> {
    for entry in std::fs::read_dir(src_dir)
        .with_context(|| format!("read dir: {}", src_dir.display()))?
    {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name();
        let entry_path = entry_prefix.join(&file_name);

        if path.is_dir() {
            append_dir_recursive(ar, &path, &entry_path)?;
        } else {
            ar.append_path_with_name(&path, &entry_path)
                .with_context(|| format!("append artifact: {}", path.display()))?;
        }
    }
    Ok(())
}

fn restore_backup_inner(src_path: &str) -> Result<()> {
    use flate2::read::GzDecoder;

    let src = Path::new(src_path);
    if !src.exists() {
        bail!("backup file not found: {src_path}");
    }

    let data_dir = openworship_dir()?;
    let staging = data_dir.join(".restore_staging");
    if staging.exists() {
        std::fs::remove_dir_all(&staging).context("remove old staging directory")?;
    }
    std::fs::create_dir_all(&staging).context("create staging directory")?;

    {
        let file = std::fs::File::open(src)
            .with_context(|| format!("open backup: {src_path}"))?;
        let gz = GzDecoder::new(file);
        let mut ar = tar::Archive::new(gz);
        ar.unpack(&staging).context("extract backup archive")?;
    }

    let manifest_path = staging.join("manifest.json");
    if !manifest_path.exists() {
        let _ = std::fs::remove_dir_all(&staging);
        bail!("invalid backup archive: manifest.json not found");
    }

    let manifest_bytes = std::fs::read(&manifest_path)?;
    let manifest: BackupManifest =
        serde_json::from_slice(&manifest_bytes).context("parse manifest.json")?;

    if manifest.version != BACKUP_FORMAT_VERSION {
        eprintln!(
            "[backup] manifest version {} differs from expected {}; attempting restore anyway",
            manifest.version, BACKUP_FORMAT_VERSION
        );
    }

    std::fs::create_dir_all(&data_dir)?;

    let staged_data = staging.join("data");
    if staged_data.is_dir() {
        for name in DATA_FILES {
            let src_file = staged_data.join(name);
            if src_file.exists() {
                std::fs::copy(&src_file, data_dir.join(name))
                    .with_context(|| format!("restore data/{name}"))?;
            }
        }
    }

    for name in DB_FILES {
        let src_file = staging.join(name);
        if src_file.exists() {
            std::fs::copy(&src_file, data_dir.join(name))
                .with_context(|| format!("restore {name}"))?;
        }
    }

    let staged_artifacts = staging.join("artifacts");
    if staged_artifacts.is_dir() {
        let dst_artifacts = data_dir.join("artifacts");
        std::fs::create_dir_all(&dst_artifacts)?;
        copy_dir_recursive(&staged_artifacts, &dst_artifacts)?;
    }

    let _ = std::fs::remove_dir_all(&staging);

    eprintln!(
        "[backup] restore complete — backup created {} (format v{})",
        manifest.created_at_ms, manifest.version
    );

    Ok(())
}

fn copy_dir_recursive(src_dir: &Path, dst_dir: &Path) -> Result<()> {
    for entry in std::fs::read_dir(src_dir)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst_dir.join(entry.file_name());
        if src_path.is_dir() {
            std::fs::create_dir_all(&dst_path)?;
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)
                .with_context(|| format!("copy artifact: {}", src_path.display()))?;
        }
    }
    Ok(())
}
