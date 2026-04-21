//! Service summary persistence, email subscription management, and SMTP settings.
//!
//! Data files (all in `~/.openworship/`):
//!   summaries.json    – generated service summaries
//!   subscribers.json  – per-church email subscribers
//!   email_settings.json – SMTP config + send-delay

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::service::{new_id, now_ms};

// ─── Domain types ─────────────────────────────────────────────────────────────

/// A generated summary for one completed service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceSummary {
    /// Stable unique ID.
    pub id: String,
    /// ID of the source `ServiceProject`.
    pub project_id: String,
    /// Human-readable service name (copied from the project).
    pub service_name: String,
    /// Church ID that owns this summary.
    pub church_id: String,
    /// Markdown-formatted AI-generated summary text.
    pub summary_text: String,
    /// When the summary was generated (Unix ms).
    pub generated_at_ms: i64,
    /// Whether the summary email has been sent.
    pub email_sent: bool,
    /// When the email was sent (Unix ms), `None` if not yet sent.
    pub email_sent_at_ms: Option<i64>,
}

impl ServiceSummary {
    pub fn new(
        project_id: String,
        service_name: String,
        church_id: String,
        summary_text: String,
    ) -> Self {
        Self {
            id: new_id(),
            project_id,
            service_name,
            church_id,
            summary_text,
            generated_at_ms: now_ms(),
            email_sent: false,
            email_sent_at_ms: None,
        }
    }
}

/// An email address subscribed to service summaries for a specific church.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailSubscriber {
    pub id: String,
    /// Church ID this subscription belongs to.
    pub church_id: String,
    pub email: String,
    pub name: Option<String>,
    pub subscribed_at_ms: i64,
}

impl EmailSubscriber {
    pub fn new(church_id: String, email: String, name: Option<String>) -> Self {
        Self {
            id: new_id(),
            church_id,
            email,
            name,
            subscribed_at_ms: now_ms(),
        }
    }
}

/// SMTP configuration + optional send-delay after service ends.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailSettings {
    /// SMTP host (e.g. "smtp.gmail.com").
    pub smtp_host: String,
    /// SMTP port (typically 587 for STARTTLS or 465 for SSL).
    pub smtp_port: u16,
    /// SMTP username / sender address.
    pub smtp_username: String,
    /// SMTP password — held in memory only; never written to disk.
    /// Stored in the OS keychain; loaded into this field at runtime.
    #[serde(skip_serializing, default)]
    pub smtp_password: String,
    /// Display name used in the From header.
    pub from_name: String,
    /// Delay in hours before the summary email is sent after a service ends.
    /// 0 = send immediately when summary is generated.
    pub send_delay_hours: u32,
    /// Whether automatic email delivery is enabled.
    pub auto_send: bool,
}

impl Default for EmailSettings {
    fn default() -> Self {
        Self {
            smtp_host: String::new(),
            smtp_port: 587,
            smtp_username: String::new(),
            smtp_password: String::new(),
            from_name: "OpenWorship".into(),
            send_delay_hours: 0,
            auto_send: false,
        }
    }
}

/// Deserialisation target that can read the legacy plaintext `smtp_password` field.
/// Used only for one-time migration to the OS keychain.
#[derive(Deserialize, Default)]
#[serde(default)]
struct EmailSettingsFile {
    smtp_host: String,
    smtp_port: u16,
    smtp_username: String,
    /// Present in pre-keychain builds; absent (default empty) afterwards.
    smtp_password: String,
    from_name: String,
    send_delay_hours: u32,
    auto_send: bool,
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

fn ow_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".openworship")
}

fn summaries_path() -> PathBuf {
    ow_dir().join("summaries.json")
}

fn subscribers_path() -> PathBuf {
    ow_dir().join("subscribers.json")
}

fn email_settings_path() -> PathBuf {
    ow_dir().join("email_settings.json")
}

fn ensure_dir(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    Ok(())
}

// ── Summaries ────────────────────────────────────────────────────────────────

pub fn load_summaries() -> Vec<ServiceSummary> {
    try_load_summaries().unwrap_or_else(|e| {
        eprintln!("[summaries] failed to load summaries: {e}");
        vec![]
    })
}

fn try_load_summaries() -> Result<Vec<ServiceSummary>> {
    let path = summaries_path();
    if !path.exists() {
        return Ok(vec![]);
    }
    Ok(serde_json::from_slice(&std::fs::read(&path)?)?)
}

pub fn save_summaries(summaries: &[ServiceSummary]) -> Result<()> {
    let path = summaries_path();
    ensure_dir(&path)?;
    std::fs::write(&path, serde_json::to_vec_pretty(summaries)?)?;
    Ok(())
}

// ── Subscribers ──────────────────────────────────────────────────────────────

pub fn load_subscribers() -> Vec<EmailSubscriber> {
    try_load_subscribers().unwrap_or_else(|e| {
        eprintln!("[summaries] failed to load subscribers: {e}");
        vec![]
    })
}

fn try_load_subscribers() -> Result<Vec<EmailSubscriber>> {
    let path = subscribers_path();
    if !path.exists() {
        return Ok(vec![]);
    }
    Ok(serde_json::from_slice(&std::fs::read(&path)?)?)
}

pub fn save_subscribers(subscribers: &[EmailSubscriber]) -> Result<()> {
    let path = subscribers_path();
    ensure_dir(&path)?;
    std::fs::write(&path, serde_json::to_vec_pretty(subscribers)?)?;
    Ok(())
}

// ── Email settings ───────────────────────────────────────────────────────────

pub fn load_email_settings() -> EmailSettings {
    try_load_email_settings().unwrap_or_else(|e| {
        eprintln!("[summaries] failed to load email settings: {e}");
        EmailSettings::default()
    })
}

fn try_load_email_settings() -> Result<EmailSettings> {
    let path = email_settings_path();
    if !path.exists() {
        let smtp_password = crate::keychain::get_smtp_password().unwrap_or_default();
        return Ok(EmailSettings { smtp_password, ..EmailSettings::default() });
    }
    let file: EmailSettingsFile = serde_json::from_slice(&std::fs::read(&path)?)?;

    // ── Migration: plaintext password → keychain ──────────────────────────
    if !file.smtp_password.is_empty() {
        eprintln!("[summaries] migrating plaintext SMTP password to OS keychain");
        if let Err(e) = crate::keychain::set_smtp_password(&file.smtp_password) {
            eprintln!("[summaries] keychain migration failed: {e}");
        }
        // Re-save without the plaintext password so it is removed from disk.
        let clean = EmailSettings {
            smtp_host: file.smtp_host.clone(),
            smtp_port: if file.smtp_port == 0 { 587 } else { file.smtp_port },
            smtp_username: file.smtp_username.clone(),
            smtp_password: String::new(),
            from_name: file.from_name.clone(),
            send_delay_hours: file.send_delay_hours,
            auto_send: file.auto_send,
        };
        if let Err(e) = save_email_settings(&clean) {
            eprintln!("[summaries] failed to re-save after migration: {e}");
        }
    }

    // Load the password from keychain for in-memory use.
    let smtp_password = crate::keychain::get_smtp_password().unwrap_or_default();
    let defaults = EmailSettings::default();

    Ok(EmailSettings {
        smtp_host: file.smtp_host,
        smtp_port: if file.smtp_port == 0 { defaults.smtp_port } else { file.smtp_port },
        smtp_username: file.smtp_username,
        smtp_password,
        from_name: if file.from_name.is_empty() { defaults.from_name } else { file.from_name },
        send_delay_hours: file.send_delay_hours,
        auto_send: file.auto_send,
    })
}

pub fn save_email_settings(settings: &EmailSettings) -> Result<()> {
    let path = email_settings_path();
    ensure_dir(&path)?;
    std::fs::write(&path, serde_json::to_vec_pretty(settings)?)?;
    Ok(())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summary_new_has_id_and_timestamp() {
        let s = ServiceSummary::new(
            "proj1".into(),
            "Sunday Service".into(),
            "church1".into(),
            "Summary text".into(),
        );
        assert!(!s.id.is_empty());
        assert!(s.generated_at_ms > 0);
        assert!(!s.email_sent);
        assert!(s.email_sent_at_ms.is_none());
    }

    #[test]
    fn subscriber_new_has_id() {
        let sub = EmailSubscriber::new(
            "church1".into(),
            "user@example.com".into(),
            Some("Alice".into()),
        );
        assert!(!sub.id.is_empty());
        assert_eq!(sub.email, "user@example.com");
    }

    #[test]
    fn email_settings_default_port() {
        let s = EmailSettings::default();
        assert_eq!(s.smtp_port, 587);
        assert!(!s.auto_send);
    }

    #[test]
    fn roundtrip_summary_json() {
        let s = ServiceSummary::new(
            "p1".into(),
            "Easter".into(),
            "c1".into(),
            "Great service".into(),
        );
        let json = serde_json::to_string(&s).unwrap();
        let back: ServiceSummary = serde_json::from_str(&json).unwrap();
        assert_eq!(back.id, s.id);
        assert_eq!(back.summary_text, "Great service");
    }

    #[test]
    fn roundtrip_email_settings_json() {
        let settings = EmailSettings {
            smtp_host: "smtp.gmail.com".into(),
            send_delay_hours: 2,
            ..EmailSettings::default()
        };
        let json = serde_json::to_string(&settings).unwrap();
        let back: EmailSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(back.smtp_host, "smtp.gmail.com");
        assert_eq!(back.send_delay_hours, 2);
    }
}
