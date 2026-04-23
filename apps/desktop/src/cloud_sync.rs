//! Phase 16: Cloud Sync, Multi-Branch Storage & Sharing.
//!
//! Provides S3-compatible cloud sync for artifacts:
//!  - Per-artifact sync toggle with offline-first queue
//!  - Per-branch namespace isolation (/{church_id}/{branch_id}/...)
//!  - Church shared space (/{church_id}/shared/...)
//!  - ACL per artifact: branch list + access level
//!  - Delta uploads via ETag comparison
//!  - Storage usage tracking

use anyhow::{Context, Result};
use reqwest::Client;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

// ─── Domain types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    /// File exists only locally — never synced.
    LocalOnly,
    /// Queued for upload; waiting for connectivity or explicit trigger.
    Queued,
    /// Upload in progress.
    Syncing,
    /// Download from cloud in progress.
    Downloading,
    /// Successfully synced to cloud; ETag matches local.
    Synced,
    /// Cloud and local versions diverged; needs resolution.
    Conflict,
    /// Last sync attempt failed; `sync_error` contains the reason.
    Error,
}

impl SyncStatus {
    fn as_str(&self) -> &'static str {
        match self {
            SyncStatus::LocalOnly => "local_only",
            SyncStatus::Queued => "queued",
            SyncStatus::Syncing => "syncing",
            SyncStatus::Downloading => "downloading",
            SyncStatus::Synced => "synced",
            SyncStatus::Conflict => "conflict",
            SyncStatus::Error => "error",
        }
    }
    fn from_str(s: &str) -> Self {
        match s {
            "queued" => SyncStatus::Queued,
            "syncing" => SyncStatus::Syncing,
            "downloading" => SyncStatus::Downloading,
            "synced" => SyncStatus::Synced,
            "conflict" => SyncStatus::Conflict,
            "error" => SyncStatus::Error,
            _ => SyncStatus::LocalOnly,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccessLevel {
    /// Only the owning branch can see this artifact.
    Restricted,
    /// Any branch within the church can view.
    BranchOnly,
    /// All branches and anyone with the link can access.
    AllBranches,
}

impl AccessLevel {
    fn as_str(&self) -> &'static str {
        match self {
            AccessLevel::Restricted => "restricted",
            AccessLevel::BranchOnly => "branch_only",
            AccessLevel::AllBranches => "all_branches",
        }
    }
    fn from_str(s: &str) -> Self {
        match s {
            "branch_only" => AccessLevel::BranchOnly,
            "all_branches" => AccessLevel::AllBranches,
            _ => AccessLevel::Restricted,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BranchPermission {
    View,
    Comment,
    Edit,
}

impl BranchPermission {
    fn as_str(&self) -> &'static str {
        match self {
            BranchPermission::View => "view",
            BranchPermission::Comment => "comment",
            BranchPermission::Edit => "edit",
        }
    }
    fn from_str(s: &str) -> Self {
        match s {
            "comment" => BranchPermission::Comment,
            "edit" => BranchPermission::Edit,
            _ => BranchPermission::View,
        }
    }
}

/// Per-branch ACL entry for an artifact.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AclEntry {
    pub branch_id: String,
    pub branch_name: String,
    pub permission: BranchPermission,
}

/// Cloud sync state for a single artifact (separate from ArtifactEntry).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncInfo {
    pub artifact_id: String,
    pub sync_enabled: bool,
    pub status: SyncStatus,
    /// S3 object key, set once the artifact has been uploaded.
    pub cloud_key: Option<String>,
    /// ETag from the last successful upload (for delta detection).
    pub last_etag: Option<String>,
    pub last_synced_ms: Option<i64>,
    pub sync_error: Option<String>,
    /// Upload progress [0.0–1.0]; `None` when not syncing.
    pub progress: Option<f32>,
}

/// S3-compatible storage configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Config {
    pub endpoint_url: String,
    pub bucket: String,
    pub region: String,
    pub access_key_id: String,
    /// Never serialised in responses — stored in keychain at runtime.
    #[serde(default)]
    pub secret_access_key: String,
}

impl Default for S3Config {
    fn default() -> Self {
        Self {
            endpoint_url: String::new(),
            bucket: String::new(),
            region: "us-east-1".into(),
            access_key_id: String::new(),
            secret_access_key: String::new(),
        }
    }
}

/// Cloud storage usage summary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageUsage {
    /// Total bytes used across all synced artifacts.
    pub used_bytes: i64,
    /// Optional storage quota in bytes. `None` = unlimited / unknown.
    pub quota_bytes: Option<i64>,
    /// Number of artifacts currently synced.
    pub synced_count: u32,
    /// Timestamp of the last usage update (ms since epoch).
    pub last_updated_ms: i64,
}

/// Section of the cloud sidebar.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CloudSection {
    /// This branch's private cloud storage.
    Branch,
    /// Church-wide shared space managed by HQ.
    Shared,
}

/// A cloud-visible artifact entry returned to the frontend.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudArtifact {
    pub artifact_id: String,
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: Option<i64>,
    pub mime_type: Option<String>,
    pub sync_status: SyncStatus,
    pub cloud_key: Option<String>,
    pub last_synced_ms: Option<i64>,
    /// Owning branch name (for shared section).
    pub owner_branch: Option<String>,
    pub access_level: AccessLevel,
    pub acl: Vec<AclEntry>,
}

// ─── Database ─────────────────────────────────────────────────────────────────

pub struct CloudSyncDb {
    conn: Connection,
}

impl CloudSyncDb {
    pub fn open() -> Result<Self> {
        let path = db_path()?;
        if let Some(p) = path.parent() {
            std::fs::create_dir_all(p)?;
        }
        let conn = Connection::open(&path)
            .with_context(|| format!("open cloud_sync db: {}", path.display()))?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch(
            "PRAGMA journal_mode=WAL;

             CREATE TABLE IF NOT EXISTS cloud_sync (
               artifact_id    TEXT PRIMARY KEY,
               sync_enabled   INTEGER NOT NULL DEFAULT 0,
               status         TEXT NOT NULL DEFAULT 'local_only',
               cloud_key      TEXT,
               last_etag      TEXT,
               last_synced_ms INTEGER,
               sync_error     TEXT
             );

             CREATE TABLE IF NOT EXISTS artifact_acl (
               artifact_id  TEXT NOT NULL,
               branch_id    TEXT NOT NULL,
               branch_name  TEXT NOT NULL,
               permission   TEXT NOT NULL DEFAULT 'view',
               PRIMARY KEY (artifact_id, branch_id)
             );

             CREATE TABLE IF NOT EXISTS cloud_access (
               artifact_id  TEXT PRIMARY KEY,
               access_level TEXT NOT NULL DEFAULT 'restricted'
             );

             CREATE TABLE IF NOT EXISTS storage_usage (
               id             INTEGER PRIMARY KEY CHECK (id = 1),
               used_bytes     INTEGER NOT NULL DEFAULT 0,
               quota_bytes    INTEGER,
               synced_count   INTEGER NOT NULL DEFAULT 0,
               last_updated_ms INTEGER NOT NULL DEFAULT 0
             );
             INSERT OR IGNORE INTO storage_usage (id, used_bytes, synced_count, last_updated_ms)
               VALUES (1, 0, 0, 0);",
        )?;
        Ok(())
    }

    // ── Sync info ─────────────────────────────────────────────────────────────

    pub fn get_sync_info(&self, artifact_id: &str) -> Result<Option<CloudSyncInfo>> {
        let mut stmt = self.conn.prepare(
            "SELECT artifact_id, sync_enabled, status, cloud_key, last_etag,
                    last_synced_ms, sync_error
             FROM cloud_sync WHERE artifact_id=?",
        )?;
        let rows = stmt.query_map(params![artifact_id], map_sync_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out.into_iter().next())
    }

    /// Batch-fetch sync info for a list of artifact IDs in a single SQL query.
    pub fn get_sync_infos_batch(&self, artifact_ids: &[String]) -> Result<Vec<CloudSyncInfo>> {
        if artifact_ids.is_empty() {
            return Ok(Vec::new());
        }
        // Build parameterised placeholders: ?,?,?,...
        let placeholders = artifact_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT artifact_id, sync_enabled, status, cloud_key, last_etag,
                    last_synced_ms, sync_error
             FROM cloud_sync WHERE artifact_id IN ({placeholders})"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        // rusqlite requires a slice of &dyn ToSql; build it from the owned Strings.
        let params: Vec<&dyn rusqlite::types::ToSql> = artifact_ids
            .iter()
            .map(|s| s as &dyn rusqlite::types::ToSql)
            .collect();
        let rows = stmt.query_map(params.as_slice(), map_sync_row)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn upsert_sync_info(&self, info: &CloudSyncInfo) -> Result<()> {
        self.conn.execute(
            "INSERT INTO cloud_sync
               (artifact_id, sync_enabled, status, cloud_key, last_etag, last_synced_ms, sync_error)
             VALUES (?1,?2,?3,?4,?5,?6,?7)
             ON CONFLICT(artifact_id) DO UPDATE SET
               sync_enabled=excluded.sync_enabled,
               status=excluded.status,
               cloud_key=excluded.cloud_key,
               last_etag=excluded.last_etag,
               last_synced_ms=excluded.last_synced_ms,
               sync_error=excluded.sync_error",
            params![
                info.artifact_id,
                info.sync_enabled as i64,
                info.status.as_str(),
                info.cloud_key,
                info.last_etag,
                info.last_synced_ms,
                info.sync_error,
            ],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn list_queued(&self) -> Result<Vec<CloudSyncInfo>> {
        let mut stmt = self.conn.prepare(
            "SELECT artifact_id, sync_enabled, status, cloud_key, last_etag,
                    last_synced_ms, sync_error
             FROM cloud_sync WHERE status IN ('queued','error') AND sync_enabled=1",
        )?;
        let rows = stmt.query_map([], map_sync_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    pub fn list_enabled(&self) -> Result<Vec<CloudSyncInfo>> {
        let mut stmt = self.conn.prepare(
            "SELECT artifact_id, sync_enabled, status, cloud_key, last_etag,
                    last_synced_ms, sync_error
             FROM cloud_sync WHERE sync_enabled=1",
        )?;
        let rows = stmt.query_map([], map_sync_row)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    // ── ACL ───────────────────────────────────────────────────────────────────

    pub fn get_acl(&self, artifact_id: &str) -> Result<Vec<AclEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT branch_id, branch_name, permission FROM artifact_acl
             WHERE artifact_id=? ORDER BY branch_name ASC",
        )?;
        let rows = stmt.query_map(params![artifact_id], |row| {
            Ok(AclEntry {
                branch_id: row.get(0)?,
                branch_name: row.get(1)?,
                permission: BranchPermission::from_str(&row.get::<_, String>(2)?),
            })
        })?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    pub fn set_acl(&self, artifact_id: &str, entries: &[AclEntry]) -> Result<()> {
        self.conn.execute(
            "DELETE FROM artifact_acl WHERE artifact_id=?",
            params![artifact_id],
        )?;
        for e in entries {
            self.conn.execute(
                "INSERT INTO artifact_acl (artifact_id, branch_id, branch_name, permission)
                 VALUES (?1,?2,?3,?4)
                 ON CONFLICT(artifact_id, branch_id) DO UPDATE SET
                   branch_name=excluded.branch_name, permission=excluded.permission",
                params![artifact_id, e.branch_id, e.branch_name, e.permission.as_str()],
            )?;
        }
        Ok(())
    }

    // ── Access level ──────────────────────────────────────────────────────────

    pub fn get_access_level(&self, artifact_id: &str) -> Result<AccessLevel> {
        let result: Option<String> = self.conn.query_row(
            "SELECT access_level FROM cloud_access WHERE artifact_id=?",
            params![artifact_id],
            |row| row.get(0),
        ).ok();
        Ok(result.as_deref().map(AccessLevel::from_str).unwrap_or(AccessLevel::Restricted))
    }

    pub fn set_access_level(&self, artifact_id: &str, level: &AccessLevel) -> Result<()> {
        self.conn.execute(
            "INSERT INTO cloud_access (artifact_id, access_level)
             VALUES (?1,?2)
             ON CONFLICT(artifact_id) DO UPDATE SET access_level=excluded.access_level",
            params![artifact_id, level.as_str()],
        )?;
        Ok(())
    }

    // ── Storage usage ─────────────────────────────────────────────────────────

    pub fn get_storage_usage(&self) -> Result<StorageUsage> {
        self.conn.query_row(
            "SELECT used_bytes, quota_bytes, synced_count, last_updated_ms
             FROM storage_usage WHERE id=1",
            [],
            |row| Ok(StorageUsage {
                used_bytes: row.get(0)?,
                quota_bytes: row.get(1)?,
                synced_count: row.get::<_, i64>(2)? as u32,
                last_updated_ms: row.get(3)?,
            }),
        ).map_err(|e| anyhow::anyhow!("storage_usage read: {e}"))
    }

    pub fn update_storage_usage(&self, used_bytes: i64, synced_count: u32) -> Result<()> {
        let now = now_ms();
        self.conn.execute(
            "UPDATE storage_usage SET used_bytes=?1, synced_count=?2, last_updated_ms=?3
             WHERE id=1",
            params![used_bytes, synced_count as i64, now],
        )?;
        Ok(())
    }
}

// ─── S3 client ────────────────────────────────────────────────────────────────
//
// Minimal AWS Sig V4 implementation using hmac-sha256 (no heavy SDK dep).

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn sha256_hex(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    hex_encode(&Sha256::digest(data))
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Result<Vec<u8>> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    let mut mac = Hmac::<Sha256>::new_from_slice(key)
        .map_err(|e| anyhow::anyhow!("invalid HMAC key: {e}"))?;
    mac.update(data);
    Ok(mac.finalize().into_bytes().to_vec())
}

fn derive_signing_key(secret: &str, date: &str, region: &str, service: &str) -> Result<Vec<u8>> {
    let k_date = hmac_sha256(format!("AWS4{secret}").as_bytes(), date.as_bytes())?;
    let k_region = hmac_sha256(&k_date, region.as_bytes())?;
    let k_service = hmac_sha256(&k_region, service.as_bytes())?;
    hmac_sha256(&k_service, b"aws4_request")
}

/// Build AWS Sig V4 Authorization header for S3 requests.
fn sign_request(
    method: &str,
    url: &reqwest::Url,
    headers: &[(&str, &str)],
    payload: &[u8],
    config: &S3Config,
    datetime: &str, // "20260101T120000Z"
) -> Result<String> {
    let date = &datetime[..8];
    let region = &config.region;

    // Canonical URI
    let canonical_uri = url.path();

    // Canonical query string (sorted)
    let mut query_pairs: Vec<(String, String)> = url
        .query_pairs()
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    query_pairs.sort();
    let canonical_qs = query_pairs
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("&");

    // Canonical headers (sorted, lowercase)
    let payload_hash = sha256_hex(payload);
    let mut all_headers: Vec<(String, String)> = headers
        .iter()
        .map(|(k, v)| (k.to_lowercase(), v.trim().to_string()))
        .collect();
    all_headers.push(("x-amz-content-sha256".into(), payload_hash.clone()));
    all_headers.push(("x-amz-date".into(), datetime.to_string()));
    all_headers.sort_by(|a, b| a.0.cmp(&b.0));

    let canonical_headers: String = all_headers
        .iter()
        .map(|(k, v)| format!("{k}:{v}\n"))
        .collect();
    let signed_headers: String = all_headers
        .iter()
        .map(|(k, _)| k.as_str())
        .collect::<Vec<_>>()
        .join(";");

    let canonical_request = format!(
        "{method}\n{canonical_uri}\n{canonical_qs}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    );

    // String to sign
    let credential_scope = format!("{date}/{region}/s3/aws4_request");
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{datetime}\n{credential_scope}\n{}",
        sha256_hex(canonical_request.as_bytes())
    );

    // Signature
    let signing_key = derive_signing_key(&config.secret_access_key, date, region, "s3")?;
    let signature = hex_encode(&hmac_sha256(&signing_key, string_to_sign.as_bytes())?);

    Ok(format!(
        "AWS4-HMAC-SHA256 Credential={}/{},SignedHeaders={},Signature={}",
        config.access_key_id, credential_scope, signed_headers, signature
    ))
}

fn s3_datetime_now() -> String {
    // Format: 20260101T120000Z — derived from system clock
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let s = secs;
    let sec = s % 60;
    let min = (s / 60) % 60;
    let hour = (s / 3600) % 24;
    let days_since_epoch = s / 86400;
    // Simple Gregorian date calculation
    let (year, month, day) = days_since_epoch_to_ymd(days_since_epoch);
    format!("{year:04}{month:02}{day:02}T{hour:02}{min:02}{sec:02}Z")
}

fn days_since_epoch_to_ymd(days: u64) -> (u64, u64, u64) {
    let mut y = 1970u64;
    let mut d = days;
    loop {
        let leap = (y.is_multiple_of(4) && !y.is_multiple_of(100)) || y.is_multiple_of(400);
        let dy = if leap { 366 } else { 365 };
        if d < dy { break; }
        d -= dy;
        y += 1;
    }
    let leap = (y.is_multiple_of(4) && !y.is_multiple_of(100)) || y.is_multiple_of(400);
    let months = [31u64, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut m = 1u64;
    for &dm in &months {
        if d < dm { break; }
        d -= dm;
        m += 1;
    }
    (y, m, d + 1)
}

fn s3_url(config: &S3Config, key: &str) -> Result<reqwest::Url> {
    let base = config.endpoint_url.trim_end_matches('/');
    let url_str = if base.contains('{') || !base.is_empty() && !base.contains('{') {
        // Standard: endpoint/bucket/key
        format!("{base}/{}/{key}", config.bucket)
    } else {
        anyhow::bail!("cloud config: empty endpoint_url")
    };
    reqwest::Url::parse(&url_str).context("invalid S3 URL")
}

/// Upload bytes to S3, returns ETag.
pub async fn s3_put_object(
    client: &Client,
    config: &S3Config,
    key: &str,
    data: Vec<u8>,
    content_type: &str,
) -> Result<String> {
    let url = s3_url(config, key)?;
    let datetime = s3_datetime_now();
    let host = url.host_str().unwrap_or_default().to_string();
    let host_with_port = match url.port() {
        Some(p) => format!("{host}:{p}"),
        None => host.clone(),
    };
    let headers = [
        ("content-type", content_type),
        ("host", host_with_port.as_str()),
    ];
    let auth = sign_request("PUT", &url, &headers, &data, config, &datetime)?;
    let resp = client
        .put(url)
        .header("Authorization", auth)
        .header("Content-Type", content_type)
        .header("x-amz-date", &datetime)
        .header("x-amz-content-sha256", sha256_hex(&data))
        .body(data)
        .send()
        .await
        .context("S3 PUT request failed")?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        anyhow::bail!("S3 PUT {key} failed: {status}: {body}");
    }
    let etag = resp
        .headers()
        .get("etag")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim_matches('"')
        .to_string();
    Ok(etag)
}

/// Check whether an S3 object exists and return its ETag.
pub async fn s3_head_object(
    client: &Client,
    config: &S3Config,
    key: &str,
) -> Result<Option<String>> {
    let url = s3_url(config, key)?;
    let datetime = s3_datetime_now();
    let host = url.host_str().unwrap_or_default().to_string();
    let host_with_port = match url.port() {
        Some(p) => format!("{host}:{p}"),
        None => host.clone(),
    };
    let headers = [("host", host_with_port.as_str())];
    let auth = sign_request("HEAD", &url, &headers, &[], config, &datetime)?;
    let resp = client
        .head(url)
        .header("Authorization", auth)
        .header("x-amz-date", &datetime)
        .header("x-amz-content-sha256", sha256_hex(&[]))
        .send()
        .await
        .context("S3 HEAD request failed")?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !resp.status().is_success() {
        anyhow::bail!("S3 HEAD {key}: {}", resp.status());
    }
    let etag = resp
        .headers()
        .get("etag")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim_matches('"')
        .to_string();
    Ok(Some(etag))
}

/// Download an S3 object, returning its bytes and ETag.
pub async fn s3_get_object(
    client: &Client,
    config: &S3Config,
    key: &str,
) -> Result<(Vec<u8>, String)> {
    let url = s3_url(config, key)?;
    let datetime = s3_datetime_now();
    let host = url.host_str().unwrap_or_default().to_string();
    let host_with_port = match url.port() {
        Some(p) => format!("{host}:{p}"),
        None => host.clone(),
    };
    let headers = [("host", host_with_port.as_str())];
    let auth = sign_request("GET", &url, &headers, &[], config, &datetime)?;
    let resp = client
        .get(url)
        .header("Authorization", auth)
        .header("x-amz-date", &datetime)
        .header("x-amz-content-sha256", sha256_hex(&[]))
        .send()
        .await
        .context("S3 GET request failed")?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        anyhow::bail!("S3 GET {key}: not found");
    }
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        anyhow::bail!("S3 GET {key} failed: {status}: {body}");
    }
    let etag = resp
        .headers()
        .get("etag")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim_matches('"')
        .to_string();
    let bytes = resp.bytes().await.context("S3 GET: read body")?.to_vec();
    Ok((bytes, etag))
}

/// Delete an S3 object.
#[allow(dead_code)]
pub async fn s3_delete_object(
    client: &Client,
    config: &S3Config,
    key: &str,
) -> Result<()> {
    let url = s3_url(config, key)?;
    let datetime = s3_datetime_now();
    let host = url.host_str().unwrap_or_default().to_string();
    let host_with_port = match url.port() {
        Some(p) => format!("{host}:{p}"),
        None => host.clone(),
    };
    let headers = [("host", host_with_port.as_str())];
    let auth = sign_request("DELETE", &url, &headers, &[], config, &datetime)?;
    let resp = client
        .delete(url)
        .header("Authorization", auth)
        .header("x-amz-date", &datetime)
        .header("x-amz-content-sha256", sha256_hex(&[]))
        .send()
        .await
        .context("S3 DELETE request failed")?;
    if !resp.status().is_success() && resp.status() != reqwest::StatusCode::NOT_FOUND {
        anyhow::bail!("S3 DELETE {key}: {}", resp.status());
    }
    Ok(())
}

// ─── Cloud key generation ──────────────────────────────────────────────────────

/// Compute the S3 key for an artifact given its local relative path and the
/// owning church/branch identity.
pub fn cloud_key_for(church_id: &str, branch_id: &str, artifact_path: &str) -> String {
    format!("{church_id}/{branch_id}/{artifact_path}")
}

/// Compute the S3 key in the church shared space.
#[allow(dead_code)]
pub fn shared_cloud_key_for(church_id: &str, artifact_path: &str) -> String {
    format!("{church_id}/shared/{artifact_path}")
}

/// Generate a human-readable shareable link for a cloud-synced artifact.
pub fn share_link_for(config: &S3Config, cloud_key: &str) -> String {
    let base = config.endpoint_url.trim_end_matches('/');
    format!("{base}/{}/{cloud_key}", config.bucket)
}

// ─── Upload logic ─────────────────────────────────────────────────────────────

/// Attempt to upload a single artifact to S3. Returns the ETag on success.
///
/// Uses delta detection: if `last_etag` matches the remote ETag, skips the
/// upload and returns the existing ETag (no-op, already in sync).
pub async fn upload_artifact(
    client: &Client,
    config: &S3Config,
    last_etag: Option<&str>,
    local_path: &std::path::Path,
    cloud_key: &str,
    mime_type: Option<&str>,
) -> Result<String> {
    // Delta check: skip if remote matches last known ETag.
    if let Some(known_etag) = last_etag {
        if let Ok(Some(remote_etag)) = s3_head_object(client, config, cloud_key).await {
            if remote_etag == known_etag {
                return Ok(remote_etag); // already in sync
            }
        }
    }

    let data = std::fs::read(local_path)
        .with_context(|| format!("read artifact for upload: {}", local_path.display()))?;
    let content_type = mime_type.unwrap_or("application/octet-stream");
    let etag = s3_put_object(client, config, cloud_key, data, content_type).await?;
    Ok(etag)
}

/// Download a single artifact from S3.  Creates parent directories and writes
/// atomically via a temp file.  Returns the ETag on success.
pub async fn download_artifact(
    client: &Client,
    config: &S3Config,
    cloud_key: &str,
    local_path: &std::path::Path,
) -> Result<String> {
    let (bytes, etag) = s3_get_object(client, config, cloud_key).await?;
    if let Some(parent) = local_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("create dirs for download: {}", local_path.display()))?;
    }
    // Atomic write via temp file to avoid partial reads on crash.
    let tmp = local_path.with_extension("download.tmp");
    std::fs::write(&tmp, &bytes)
        .with_context(|| format!("write download tmp: {}", tmp.display()))?;
    std::fs::rename(&tmp, local_path)
        .with_context(|| format!("rename download: {}", local_path.display()))?;
    Ok(etag)
}

/// Process the offline upload queue: upload all `queued` artifacts.
/// Silently skips artifacts whose local files are missing.
#[allow(dead_code)]
pub async fn flush_sync_queue(
    client: &Client,
    config: &S3Config,
    sync_db: &CloudSyncDb,
    base_path: &str,
) -> Vec<(String, Result<String>)> {
    let queued = match sync_db.list_queued() {
        Ok(q) => q,
        Err(e) => {
            eprintln!("[cloud_sync] list_queued failed: {e}");
            return vec![];
        }
    };
    let mut results = Vec::new();
    for info in queued {
        let key = match &info.cloud_key {
            Some(k) => k.clone(),
            None => {
                results.push((info.artifact_id.clone(), Err(anyhow::anyhow!("no cloud key"))));
                continue;
            }
        };
        let local = PathBuf::from(base_path).join(&key);
        if !local.exists() {
            results.push((info.artifact_id, Err(anyhow::anyhow!("local file missing"))));
            continue;
        }
        let etag = upload_artifact(client, config, info.last_etag.as_deref(), &local, &key, None).await;
        results.push((info.artifact_id, etag));
    }
    results
}

// ─── Config persistence ────────────────────────────────────────────────────────

fn db_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Ok(PathBuf::from(home).join(".openworship").join("cloud_sync.db"))
}

pub fn config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".openworship").join("cloud_config.json")
}

pub fn load_config() -> Option<S3Config> {
    let path = config_path();
    if !path.exists() { return None; }
    std::fs::read(&path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
}

pub fn save_config(config: &S3Config) -> Result<()> {
    let path = config_path();
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p)?;
    }
    // Never persist the secret_access_key to disk — caller stores it in keychain.
    let mut safe = config.clone();
    safe.secret_access_key = String::new();
    std::fs::write(&path, serde_json::to_vec_pretty(&safe)?)?;
    Ok(())
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

fn map_sync_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CloudSyncInfo> {
    Ok(CloudSyncInfo {
        artifact_id: row.get(0)?,
        sync_enabled: row.get::<_, i64>(1)? != 0,
        status: SyncStatus::from_str(&row.get::<_, String>(2)?),
        cloud_key: row.get(3)?,
        last_etag: row.get(4)?,
        last_synced_ms: row.get(5)?,
        sync_error: row.get(6)?,
        progress: None,
    })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_empty_db() {
        let db = CloudSyncDb::open_in_memory().unwrap();
        let usage = db.get_storage_usage().unwrap();
        assert_eq!(usage.used_bytes, 0);
    }

    #[test]
    fn upsert_and_get_sync_info() {
        let db = CloudSyncDb::open_in_memory().unwrap();
        let info = CloudSyncInfo {
            artifact_id: "a1".into(),
            sync_enabled: true,
            status: SyncStatus::Queued,
            cloud_key: Some("church1/branch1/file.pdf".into()),
            last_etag: None,
            last_synced_ms: None,
            sync_error: None,
            progress: None,
        };
        db.upsert_sync_info(&info).unwrap();
        let got = db.get_sync_info("a1").unwrap().unwrap();
        assert_eq!(got.artifact_id, "a1");
        assert!(got.sync_enabled);
        assert_eq!(got.status, SyncStatus::Queued);
    }

    #[test]
    fn list_queued() {
        let db = CloudSyncDb::open_in_memory().unwrap();
        for (id, status) in &[("q1", SyncStatus::Queued), ("s1", SyncStatus::Synced), ("e1", SyncStatus::Error)] {
            db.upsert_sync_info(&CloudSyncInfo {
                artifact_id: id.to_string(),
                sync_enabled: true,
                status: status.clone(),
                cloud_key: Some(format!("c/b/{id}")),
                last_etag: None, last_synced_ms: None, sync_error: None, progress: None,
            }).unwrap();
        }
        let queued = db.list_queued().unwrap();
        assert_eq!(queued.len(), 2); // queued + error
    }

    #[test]
    fn acl_set_and_get() {
        let db = CloudSyncDb::open_in_memory().unwrap();
        let entries = vec![
            AclEntry { branch_id: "b1".into(), branch_name: "Campus A".into(), permission: BranchPermission::Edit },
            AclEntry { branch_id: "b2".into(), branch_name: "Campus B".into(), permission: BranchPermission::View },
        ];
        db.set_acl("a1", &entries).unwrap();
        let got = db.get_acl("a1").unwrap();
        assert_eq!(got.len(), 2);
        assert_eq!(got[0].branch_name, "Campus A");
    }

    #[test]
    fn access_level_roundtrip() {
        let db = CloudSyncDb::open_in_memory().unwrap();
        db.set_access_level("a1", &AccessLevel::BranchOnly).unwrap();
        assert_eq!(db.get_access_level("a1").unwrap(), AccessLevel::BranchOnly);
        db.set_access_level("a1", &AccessLevel::AllBranches).unwrap();
        assert_eq!(db.get_access_level("a1").unwrap(), AccessLevel::AllBranches);
    }

    #[test]
    fn cloud_key_format() {
        let key = cloud_key_for("church-1", "branch-a", "svc/video.mp4");
        assert_eq!(key, "church-1/branch-a/svc/video.mp4");
        let shared = shared_cloud_key_for("church-1", "assets/logo.png");
        assert_eq!(shared, "church-1/shared/assets/logo.png");
    }

    #[test]
    fn storage_usage_update() {
        let db = CloudSyncDb::open_in_memory().unwrap();
        db.update_storage_usage(1024 * 1024, 3).unwrap();
        let u = db.get_storage_usage().unwrap();
        assert_eq!(u.used_bytes, 1024 * 1024);
        assert_eq!(u.synced_count, 3);
    }

    #[test]
    fn s3_datetime_format() {
        let dt = s3_datetime_now();
        assert_eq!(dt.len(), 16);
        assert!(dt.ends_with('Z'));
    }
}
