//! Service project and content bank persistence.
//!
//! Service projects are named containers for ordered content items used during
//! a worship service.  Once a service ends, the project is locked (read-only).
//!
//! The content bank is a global library of every content item ever sent to the
//! display, searchable across all past services.
//!
//! Both are persisted as JSON files in `~/.openworship/`.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

// ─── ID / timestamp helpers ───────────────────────────────────────────────────

static SERVICE_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Generate a stable, monotonic hex identifier (timestamp µs + atomic counter).
pub fn new_id() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros() as u64;
    let count = SERVICE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{ts:016x}{count:08x}")
}

/// Current wall-clock time as milliseconds since the Unix epoch.
pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

// ─── Domain types ─────────────────────────────────────────────────────────────

/// A single scripture item within a service project.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectItem {
    pub id: String,
    pub reference: String,
    pub text: String,
    pub translation: String,
    /// Display order (0-based).
    pub position: usize,
    pub added_at_ms: i64,
}

/// A named container for the ordered content plan of a single worship service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceProject {
    pub id: String,
    pub name: String,
    pub created_at_ms: i64,
    /// `None` while the service is active; set when the operator ends the service.
    pub closed_at_ms: Option<i64>,
    pub items: Vec<ProjectItem>,
}

impl ServiceProject {
    #[inline]
    pub fn is_open(&self) -> bool {
        self.closed_at_ms.is_none()
    }
}

/// An entry in the global content bank — populated whenever content is sent to
/// the display.  Re-using the same reference increments `use_count`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentBankEntry {
    pub id: String,
    pub reference: String,
    pub text: String,
    pub translation: String,
    pub last_used_ms: i64,
    pub use_count: u32,
}

// ─── Storage ──────────────────────────────────────────────────────────────────

fn projects_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Ok(PathBuf::from(home).join(".openworship").join("projects.json"))
}

fn content_bank_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Ok(PathBuf::from(home).join(".openworship").join("content_bank.json"))
}

pub fn load_projects() -> Vec<ServiceProject> {
    try_load_projects().unwrap_or_else(|e| {
        eprintln!("[service] failed to load projects: {e}; starting empty");
        vec![]
    })
}

fn try_load_projects() -> Result<Vec<ServiceProject>> {
    let path = projects_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    Ok(serde_json::from_slice(&std::fs::read(&path)?)?)
}

pub fn save_projects(projects: &[ServiceProject]) -> Result<()> {
    let path = projects_path()?;
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(&path, serde_json::to_vec_pretty(projects)?)?;
    Ok(())
}

pub fn load_content_bank() -> Vec<ContentBankEntry> {
    try_load_content_bank().unwrap_or_else(|e| {
        eprintln!("[service] failed to load content bank: {e}; starting empty");
        vec![]
    })
}

fn try_load_content_bank() -> Result<Vec<ContentBankEntry>> {
    let path = content_bank_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    Ok(serde_json::from_slice(&std::fs::read(&path)?)?)
}

pub fn save_content_bank(bank: &[ContentBankEntry]) -> Result<()> {
    let path = content_bank_path()?;
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(&path, serde_json::to_vec_pretty(bank)?)?;
    Ok(())
}
