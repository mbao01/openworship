//! Branch Sync — HQ push / member pull for multi-location churches (OPE-64).
//!
//! HQ serialises songs, announcements, and sermon notes to JSON, uploads each
//! to the church shared S3 prefix, and writes a manifest with per-content
//! ETags. Member branches download the manifest, compare ETags, and pull only
//! the content that changed. Conflict resolution is last-write-wins (HQ is
//! authoritative for shared content).
//!
//! S3 layout:
//!   {church_id}/shared/manifest.json
//!   {church_id}/shared/songs.json
//!   {church_id}/shared/announcements.json
//!   {church_id}/shared/sermon_notes.json

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::cloud_sync::{s3_get_object, s3_head_object, s3_put_object, S3Config};
use crate::identity::BranchRole;
use crate::slides::{load_announcements, load_sermon_notes, save_announcements, save_sermon_notes};
use crate::songs::SongImport;

// ─── Types ────────────────────────────────────────────────────────────────────

/// Manifest stored in S3 at `{church_id}/shared/manifest.json`.
///
/// Written by HQ on every push; read by members to decide what to pull.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BranchSyncManifest {
    /// Unix timestamp (ms) of the last HQ push.
    pub pushed_at_ms: i64,
    /// Human-readable name of the HQ branch that pushed.
    pub hq_branch_name: String,
    /// ETag of the songs payload at last push; `None` if nothing was synced.
    pub songs_etag: Option<String>,
    /// ETag of the announcements payload at last push.
    pub announcements_etag: Option<String>,
    /// ETag of the sermon notes payload at last push.
    pub sermon_notes_etag: Option<String>,
}

/// Local sync state persisted to `~/.openworship/branch_sync.json`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BranchSyncState {
    /// HQ: timestamp of last successful push.
    pub last_pushed_ms: Option<i64>,
    /// Member: timestamp of last successful pull.
    pub last_pulled_ms: Option<i64>,
    /// ETag of the last manifest we pushed (HQ) or pulled (member).
    pub last_manifest_etag: Option<String>,
    /// ETags we have for each content type (for delta detection).
    pub songs_etag: Option<String>,
    pub announcements_etag: Option<String>,
    pub sermon_notes_etag: Option<String>,
}

/// Summary returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchSyncStatus {
    /// HQ: last push timestamp (ms).
    pub last_pushed_ms: Option<i64>,
    /// Member: last pull timestamp (ms).
    pub last_pulled_ms: Option<i64>,
    /// Name of the HQ branch that last pushed (member view).
    pub hq_branch_name: Option<String>,
    /// Error message from the most recent operation.
    pub error: Option<String>,
}

// ─── Persistence ──────────────────────────────────────────────────────────────

fn state_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".openworship").join("branch_sync.json")
}

pub fn load_state() -> BranchSyncState {
    let path = state_path();
    if !path.exists() {
        return BranchSyncState::default();
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_state(state: &BranchSyncState) -> Result<()> {
    let path = state_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(state).context("serialize branch_sync state")?;
    std::fs::write(&path, json).context("write branch_sync.json")
}

// ─── S3 key helpers ───────────────────────────────────────────────────────────

fn manifest_key(church_id: &str) -> String {
    format!("{church_id}/shared/manifest.json")
}

fn songs_key(church_id: &str) -> String {
    format!("{church_id}/shared/songs.json")
}

fn announcements_key(church_id: &str) -> String {
    format!("{church_id}/shared/announcements.json")
}

fn sermon_notes_key(church_id: &str) -> String {
    format!("{church_id}/shared/sermon_notes.json")
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

// ─── HQ push ──────────────────────────────────────────────────────────────────

/// Upload all local content (songs, announcements, sermon notes) to the church
/// shared S3 prefix. Uses ETag-based delta detection to skip unchanged data.
///
/// Only callable by HQ branches. Returns the updated [`BranchSyncStatus`].
///
/// Takes `songs` as owned data so the `SongsDb` lock is not held across awaits.
pub async fn do_push(
    config: &S3Config,
    church_id: &str,
    hq_branch_name: &str,
    songs: Vec<crate::songs::Song>,
) -> Result<BranchSyncStatus> {
    let client = reqwest::Client::new();
    let mut local = load_state();
    let mut manifest = BranchSyncManifest {
        pushed_at_ms: now_ms(),
        hq_branch_name: hq_branch_name.to_string(),
        ..Default::default()
    };

    // ── Songs ──────────────────────────────────────────────────────────────────
    {
        let payload = serde_json::to_vec(&songs).context("serialize songs")?;
        let key = songs_key(church_id);

        // Delta: check remote ETag before uploading.
        let should_upload = if let Some(known) = &local.songs_etag {
            match s3_head_object(&client, config, &key).await {
                Ok(Some(remote)) => &remote != known,
                _ => true,
            }
        } else {
            true
        };

        let etag = if should_upload {
            s3_put_object(&client, config, &key, payload, "application/json").await?
        } else {
            local.songs_etag.clone().unwrap_or_default()
        };
        local.songs_etag = Some(etag.clone());
        manifest.songs_etag = Some(etag);
    }

    // ── Announcements ─────────────────────────────────────────────────────────
    {
        let items = load_announcements();
        let payload = serde_json::to_vec(&items).context("serialize announcements")?;
        let key = announcements_key(church_id);

        let should_upload = if let Some(known) = &local.announcements_etag {
            match s3_head_object(&client, config, &key).await {
                Ok(Some(remote)) => &remote != known,
                _ => true,
            }
        } else {
            true
        };

        let etag = if should_upload {
            s3_put_object(&client, config, &key, payload, "application/json").await?
        } else {
            local.announcements_etag.clone().unwrap_or_default()
        };
        local.announcements_etag = Some(etag.clone());
        manifest.announcements_etag = Some(etag);
    }

    // ── Sermon notes ──────────────────────────────────────────────────────────
    {
        let notes = load_sermon_notes();
        let payload = serde_json::to_vec(&notes).context("serialize sermon notes")?;
        let key = sermon_notes_key(church_id);

        let should_upload = if let Some(known) = &local.sermon_notes_etag {
            match s3_head_object(&client, config, &key).await {
                Ok(Some(remote)) => &remote != known,
                _ => true,
            }
        } else {
            true
        };

        let etag = if should_upload {
            s3_put_object(&client, config, &key, payload, "application/json").await?
        } else {
            local.sermon_notes_etag.clone().unwrap_or_default()
        };
        local.sermon_notes_etag = Some(etag.clone());
        manifest.sermon_notes_etag = Some(etag);
    }

    // ── Manifest ──────────────────────────────────────────────────────────────
    {
        let payload = serde_json::to_vec(&manifest).context("serialize manifest")?;
        let key = manifest_key(church_id);
        let etag = s3_put_object(&client, config, &key, payload, "application/json").await?;
        local.last_manifest_etag = Some(etag);
    }

    local.last_pushed_ms = Some(manifest.pushed_at_ms);
    save_state(&local)?;

    Ok(BranchSyncStatus {
        last_pushed_ms: local.last_pushed_ms,
        last_pulled_ms: local.last_pulled_ms,
        hq_branch_name: None,
        error: None,
    })
}

// ─── Member pull ──────────────────────────────────────────────────────────────

/// Download content from HQ's shared S3 prefix and merge into local storage.
///
/// Uses delta detection: compares each content ETag from the manifest against
/// our last-known ETags, skipping content that hasn't changed.
///
/// Songs are merged (new HQ songs are added; existing titles are skipped).
/// Announcements and sermon notes are replaced with HQ's versions.
///
/// Returns `(status, songs_to_import)` — the caller must import songs into the
/// db after this returns, keeping the db lock outside the async boundary.
pub async fn do_pull(
    config: &S3Config,
    church_id: &str,
) -> Result<(BranchSyncStatus, Vec<SongImport>)> {
    let client = reqwest::Client::new();
    let mut local = load_state();

    // ── Fetch manifest ────────────────────────────────────────────────────────
    let manifest: BranchSyncManifest = {
        let key = manifest_key(church_id);
        let (bytes, etag) = s3_get_object(&client, config, &key)
            .await
            .context("fetch sync manifest from HQ")?;

        // If manifest hasn't changed, nothing to do.
        if local.last_manifest_etag.as_deref() == Some(etag.as_str()) {
            return Ok((
                BranchSyncStatus {
                    last_pushed_ms: None,
                    last_pulled_ms: local.last_pulled_ms,
                    hq_branch_name: None,
                    error: None,
                },
                vec![],
            ));
        }

        let m: BranchSyncManifest =
            serde_json::from_slice(&bytes).context("parse sync manifest")?;
        local.last_manifest_etag = Some(etag);
        m
    };

    let hq_name = manifest.hq_branch_name.clone();
    let mut song_imports: Vec<SongImport> = vec![];

    // ── Songs ──────────────────────────────────────────────────────────────────
    if let Some(remote_etag) = &manifest.songs_etag {
        let needs_pull = local.songs_etag.as_deref() != Some(remote_etag.as_str());
        if needs_pull {
            let key = songs_key(church_id);
            let (bytes, etag) = s3_get_object(&client, config, &key)
                .await
                .context("fetch songs from HQ")?;

            #[derive(Deserialize)]
            struct SongRow {
                title: String,
                artist: Option<String>,
                source: Option<String>,
                ccli_number: Option<String>,
                lyrics: String,
            }

            let rows: Vec<SongRow> =
                serde_json::from_slice(&bytes).context("parse HQ songs")?;
            song_imports = rows
                .into_iter()
                .map(|r| SongImport {
                    title: r.title,
                    artist: r.artist,
                    ccli_number: r.ccli_number,
                    source: r.source.unwrap_or_else(|| "branch_sync".into()),
                    lyrics: r.lyrics,
                })
                .collect();
            local.songs_etag = Some(etag);
        }
    }

    // ── Announcements ─────────────────────────────────────────────────────────
    if let Some(remote_etag) = &manifest.announcements_etag {
        let needs_pull = local.announcements_etag.as_deref() != Some(remote_etag.as_str());
        if needs_pull {
            let key = announcements_key(church_id);
            let (bytes, etag) = s3_get_object(&client, config, &key)
                .await
                .context("fetch announcements from HQ")?;

            let items: Vec<crate::slides::AnnouncementItem> =
                serde_json::from_slice(&bytes).context("parse HQ announcements")?;
            save_announcements(&items).context("save HQ announcements")?;
            local.announcements_etag = Some(etag);
        }
    }

    // ── Sermon notes ──────────────────────────────────────────────────────────
    if let Some(remote_etag) = &manifest.sermon_notes_etag {
        let needs_pull = local.sermon_notes_etag.as_deref() != Some(remote_etag.as_str());
        if needs_pull {
            let key = sermon_notes_key(church_id);
            let (bytes, etag) = s3_get_object(&client, config, &key)
                .await
                .context("fetch sermon notes from HQ")?;

            let notes: Vec<crate::slides::SermonNote> =
                serde_json::from_slice(&bytes).context("parse HQ sermon notes")?;
            save_sermon_notes(&notes).context("save HQ sermon notes")?;
            local.sermon_notes_etag = Some(etag);
        }
    }

    local.last_pulled_ms = Some(now_ms());
    save_state(&local)?;

    Ok((
        BranchSyncStatus {
            last_pushed_ms: None,
            last_pulled_ms: local.last_pulled_ms,
            hq_branch_name: Some(hq_name),
            error: None,
        },
        song_imports,
    ))
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

/// HQ: push all local content to the church shared S3 prefix.
#[tauri::command]
pub async fn push_to_branches(
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<BranchSyncStatus, String> {
    let (church_id, branch_name, role) = {
        let id = state.identity.read().map_err(|e| e.to_string())?;
        match id.as_ref() {
            Some(i) => (i.church_id.clone(), i.branch_name.clone(), i.role.clone()),
            None => return Err("No church identity configured.".into()),
        }
    };
    if role != BranchRole::Hq {
        return Err("Only HQ branches can push content to members.".into());
    }

    let config = {
        let cfg = state.cloud_config.read().map_err(|e| e.to_string())?;
        cfg.clone().ok_or_else(|| "Cloud storage is not configured.".to_string())?
    };

    // Collect songs before the async boundary so we don't hold the Mutex across awaits.
    let songs = {
        let db = state.songs_db.lock().map_err(|e| e.to_string())?;
        db.list_songs().map_err(|e| e.to_string())?
    };

    do_push(&config, &church_id, &branch_name, songs)
        .await
        .map_err(|e| e.to_string())
}

/// Member: pull content from HQ's shared S3 prefix and merge locally.
#[tauri::command]
pub async fn pull_from_hq(
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<BranchSyncStatus, String> {
    let (church_id, role) = {
        let id = state.identity.read().map_err(|e| e.to_string())?;
        match id.as_ref() {
            Some(i) => (i.church_id.clone(), i.role.clone()),
            None => return Err("No church identity configured.".into()),
        }
    };
    if role != BranchRole::Member {
        return Err("Only member branches can pull content from HQ.".into());
    }

    let config = {
        let cfg = state.cloud_config.read().map_err(|e| e.to_string())?;
        cfg.clone().ok_or_else(|| "Cloud storage is not configured.".to_string())?
    };

    // Fetch content over the network (no locks held during await).
    let (status, song_imports) = do_pull(&config, &church_id)
        .await
        .map_err(|e| e.to_string())?;

    // Import songs after the async work is done, inside a lock.
    if !song_imports.is_empty() {
        let db = state.songs_db.lock().map_err(|e| e.to_string())?;
        db.import_batch(&song_imports).map_err(|e| e.to_string())?;
    }

    Ok(status)
}

/// Return local branch sync state (timestamps, no network call).
#[tauri::command]
pub fn get_branch_sync_status(
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<BranchSyncStatus, String> {
    let role = {
        let id = state.identity.read().map_err(|e| e.to_string())?;
        id.as_ref().map(|i| i.role.clone())
    };
    let local = load_state();
    Ok(BranchSyncStatus {
        last_pushed_ms: if role.as_ref() == Some(&BranchRole::Hq) {
            local.last_pushed_ms
        } else {
            None
        },
        last_pulled_ms: if role.as_ref() == Some(&BranchRole::Member) {
            local.last_pulled_ms
        } else {
            None
        },
        hq_branch_name: None,
        error: None,
    })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_round_trips_json() {
        let state = BranchSyncState {
            last_pushed_ms: Some(1_700_000_000_000),
            last_pulled_ms: None,
            last_manifest_etag: Some("abc123".into()),
            songs_etag: Some("etag1".into()),
            announcements_etag: None,
            sermon_notes_etag: Some("etag3".into()),
        };
        let json = serde_json::to_string(&state).unwrap();
        let back: BranchSyncState = serde_json::from_str(&json).unwrap();
        assert_eq!(back.last_pushed_ms, Some(1_700_000_000_000));
        assert_eq!(back.songs_etag, Some("etag1".into()));
        assert!(back.last_pulled_ms.is_none());
    }

    #[test]
    fn manifest_key_format() {
        let church_id = "abc12345-0000-4000-8000-000000000001";
        assert_eq!(
            manifest_key(church_id),
            "abc12345-0000-4000-8000-000000000001/shared/manifest.json"
        );
    }

    #[test]
    fn songs_key_format() {
        let church_id = "abc12345-0000-4000-8000-000000000001";
        assert_eq!(
            songs_key(church_id),
            "abc12345-0000-4000-8000-000000000001/shared/songs.json"
        );
    }
}
