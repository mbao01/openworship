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

/// A single content/event item within a service project.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectItem {
    pub id: String,
    pub reference: String,
    pub text: String,
    pub translation: String,
    /// Display order (0-based).
    pub position: usize,
    pub added_at_ms: i64,
    /// Event type: "scripture", "song", "prayer", "sermon", "announcement", "other"
    #[serde(default = "default_item_type")]
    pub item_type: String,
    /// Planned duration in seconds (e.g. 300 for 5 minutes).
    #[serde(default)]
    pub duration_secs: Option<u32>,
    /// Operator notes for this event.
    #[serde(default)]
    pub notes: Option<String>,
    /// Linked artifact IDs (assets attached to this event).
    #[serde(default)]
    pub asset_ids: Vec<String>,
}

fn default_item_type() -> String {
    "scripture".into()
}

/// Task status for service planning.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Backlog,
    Todo,
    InProgress,
    Done,
    Cancelled,
}

/// A task within a service project (e.g. "Print bulletins", "Sound check").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceTask {
    pub id: String,
    pub service_id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub status: TaskStatus,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

/// A named container for the ordered content plan of a single worship service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceProject {
    pub id: String,
    pub name: String,
    pub created_at_ms: i64,
    /// `None` while the service is active; set when the operator ends the service.
    pub closed_at_ms: Option<i64>,
    /// Scheduled date/time for the service (operator-editable).
    /// Defaults to `created_at_ms` if not set.
    #[serde(default)]
    pub scheduled_at_ms: Option<i64>,
    /// Service description / notes.
    #[serde(default)]
    pub description: Option<String>,
    pub items: Vec<ProjectItem>,
    /// Per-service task list.
    #[serde(default)]
    pub tasks: Vec<ServiceTask>,
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
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_vec_pretty(projects)?)?;
    std::fs::rename(&tmp, &path)?;
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
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_vec_pretty(bank)?)?;
    std::fs::rename(&tmp, &path)?;
    Ok(())
}

// ─── Session memory ───────────────────────────────────────────────────────────

/// Lightweight per-church session memory — persisted between app restarts.
///
/// Stores the operator's last-used Bible translation so the app can restore it
/// on next launch without requiring a manual re-selection.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionMemory {
    /// The last Bible translation the operator selected (e.g. "KJV", "WEB").
    #[serde(default)]
    pub preferred_translation: Option<String>,
}

fn session_memory_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Ok(PathBuf::from(home)
        .join(".openworship")
        .join("session_memory.json"))
}

pub fn load_session_memory() -> SessionMemory {
    try_load_session_memory().unwrap_or_default()
}

fn try_load_session_memory() -> Result<SessionMemory> {
    let path = session_memory_path()?;
    if !path.exists() {
        return Ok(SessionMemory::default());
    }
    Ok(serde_json::from_slice(&std::fs::read(&path)?)?)
}

pub fn save_session_memory(mem: &SessionMemory) -> Result<()> {
    let path = session_memory_path()?;
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p)?;
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_vec_pretty(mem)?)?;
    std::fs::rename(&tmp, &path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Serialize tests that mutate HOME so they don't race each other.
    static HOME_LOCK: Mutex<()> = Mutex::new(());

    fn with_temp_home<F: FnOnce()>(f: F) {
        let _guard = HOME_LOCK.lock().unwrap();
        let dir = std::env::temp_dir().join(format!("ow_test_{}", new_id()));
        std::fs::create_dir_all(&dir).unwrap();
        let prev = std::env::var("HOME").ok();
        unsafe { std::env::set_var("HOME", &dir); }
        f();
        // Restore HOME
        match prev {
            Some(h) => unsafe { std::env::set_var("HOME", h) },
            None => unsafe { std::env::remove_var("HOME") },
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn new_id_generates_unique_ids() {
        let a = new_id();
        let b = new_id();
        assert_ne!(a, b);
        // Should be 24 hex chars: 16 (timestamp) + 8 (counter)
        assert_eq!(a.len(), 24);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn now_ms_returns_reasonable_timestamp() {
        let ts = now_ms();
        // Should be after 2020-01-01 and positive
        assert!(ts > 1_577_836_800_000);
        assert!(ts > 0);
    }

    #[test]
    fn save_and_load_projects_round_trip() {
        with_temp_home(|| {
            let projects = vec![ServiceProject {
                id: "p1".into(),
                name: "Sunday Service".into(),
                created_at_ms: 1000,
                closed_at_ms: None,
                scheduled_at_ms: None,
                description: Some("Test service".into()),
                items: vec![ProjectItem {
                    id: "i1".into(),
                    reference: "John 3:16".into(),
                    text: "For God so loved".into(),
                    translation: "KJV".into(),
                    position: 0,
                    added_at_ms: 1000,
                    item_type: "scripture".into(),
                    duration_secs: None,
                    notes: None,
                    asset_ids: vec![],
                }],
                tasks: vec![],
            }];
            save_projects(&projects).unwrap();
            let loaded = load_projects();
            assert_eq!(loaded.len(), 1);
            assert_eq!(loaded[0].name, "Sunday Service");
            assert_eq!(loaded[0].items.len(), 1);
            assert_eq!(loaded[0].items[0].reference, "John 3:16");
        });
    }

    #[test]
    fn load_projects_returns_empty_when_no_file() {
        with_temp_home(|| {
            let loaded = load_projects();
            assert!(loaded.is_empty());
        });
    }

    #[test]
    fn save_and_load_content_bank_round_trip() {
        with_temp_home(|| {
            let bank = vec![ContentBankEntry {
                id: "cb1".into(),
                reference: "Romans 8:28".into(),
                text: "And we know".into(),
                translation: "KJV".into(),
                last_used_ms: 2000,
                use_count: 3,
            }];
            save_content_bank(&bank).unwrap();
            let loaded = load_content_bank();
            assert_eq!(loaded.len(), 1);
            assert_eq!(loaded[0].reference, "Romans 8:28");
            assert_eq!(loaded[0].use_count, 3);
        });
    }

    #[test]
    fn load_content_bank_returns_empty_when_no_file() {
        with_temp_home(|| {
            let loaded = load_content_bank();
            assert!(loaded.is_empty());
        });
    }

    #[test]
    fn save_and_load_session_memory_round_trip() {
        with_temp_home(|| {
            let mem = SessionMemory {
                preferred_translation: Some("WEB".into()),
            };
            save_session_memory(&mem).unwrap();
            let loaded = load_session_memory();
            assert_eq!(loaded.preferred_translation, Some("WEB".into()));
        });
    }

    #[test]
    fn load_session_memory_returns_default_when_no_file() {
        with_temp_home(|| {
            let loaded = load_session_memory();
            assert!(loaded.preferred_translation.is_none());
        });
    }

    #[test]
    fn atomic_write_temp_file_does_not_persist_on_success() {
        with_temp_home(|| {
            save_projects(&[]).unwrap();
            let path = projects_path().unwrap();
            let tmp = path.with_extension("json.tmp");
            assert!(!tmp.exists(), "temp file should be removed after rename");
            assert!(path.exists(), "final file should exist");
        });
    }

    #[test]
    fn service_project_is_open_when_not_closed() {
        let p = ServiceProject {
            id: "x".into(),
            name: "Test".into(),
            created_at_ms: 0,
            closed_at_ms: None,
            scheduled_at_ms: None,
            description: None,
            items: vec![],
            tasks: vec![],
        };
        assert!(p.is_open());
    }

    #[test]
    fn service_project_is_not_open_when_closed() {
        let p = ServiceProject {
            id: "x".into(),
            name: "Test".into(),
            created_at_ms: 0,
            closed_at_ms: Some(1000),
            scheduled_at_ms: None,
            description: None,
            items: vec![],
            tasks: vec![],
        };
        assert!(!p.is_open());
    }
}
