//! Persistent audio settings stored in `~/.openworship/settings.json`.
//!
//! The Deepgram API key is **not** written to `settings.json`; it is stored in
//! the OS keychain via [`crate::keychain`]. On first load after upgrading from
//! an older build that did store the key in plaintext JSON, the migration path
//! reads the key, saves it to the keychain, and re-saves the file without it.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Which STT backend the operator has selected.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SttBackend {
    /// Offline Whisper.cpp (default).
    #[default]
    Offline,
    /// Online Deepgram streaming WebSocket.
    Online,
}

/// Operator-controlled audio settings, persisted across restarts.
///
/// `deepgram_api_key` is held in memory and exchanged over the Tauri command
/// bridge, but is **skipped during JSON serialisation** — the key lives in the
/// OS keychain (see [`crate::keychain`]).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct AudioSettings {
    /// Selected STT backend.
    pub backend: SttBackend,
    /// Deepgram API key — runtime only, never written to disk.
    #[serde(skip_serializing)]
    pub deepgram_api_key: String,
}

/// Deserialisation target that can still read the old plaintext key field.
/// Used only for one-time migration.
#[derive(Deserialize, Default)]
#[serde(default)]
struct AudioSettingsFile {
    backend: SttBackend,
    /// Present in pre-keychain builds; absent (default empty) afterwards.
    deepgram_api_key: String,
}

impl AudioSettings {
    /// Load from `~/.openworship/settings.json`, returning defaults on any error.
    ///
    /// If the file contains a plaintext `deepgram_api_key` from an older build,
    /// the key is migrated to the OS keychain and the file is re-saved without it.
    pub fn load() -> Self {
        match Self::try_load() {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[settings] failed to load: {e}; using defaults");
                Self::default()
            }
        }
    }

    fn try_load() -> Result<Self> {
        let path = settings_path()?;
        if !path.exists() {
            return Ok(Self::default());
        }
        let bytes = std::fs::read(&path)?;
        let file: AudioSettingsFile = serde_json::from_slice(&bytes)?;

        // ── Migration: plaintext key → keychain ──────────────────────────────
        if !file.deepgram_api_key.is_empty() {
            eprintln!("[settings] migrating plaintext Deepgram key to OS keychain");
            if let Err(e) = crate::keychain::set_deepgram_api_key(&file.deepgram_api_key) {
                eprintln!("[settings] keychain migration failed: {e}");
            }
            // Re-save without the key so the plaintext is removed from disk.
            let clean = Self {
                backend: file.backend.clone(),
                deepgram_api_key: String::new(),
            };
            if let Err(e) = clean.save() {
                eprintln!("[settings] failed to re-save after migration: {e}");
            }
        }

        // Load the key from keychain for in-memory use.
        let deepgram_api_key = crate::keychain::get_deepgram_api_key().unwrap_or_default();

        Ok(Self {
            backend: file.backend,
            deepgram_api_key,
        })
    }

    /// Persist to `~/.openworship/settings.json` (key is excluded by `#[serde(skip_serializing)]`).
    pub fn save(&self) -> Result<()> {
        let path = settings_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_vec_pretty(self)?;
        std::fs::write(&path, json)?;
        Ok(())
    }
}

fn settings_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Ok(PathBuf::from(home).join(".openworship").join("settings.json"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_backend_is_offline() {
        let s = AudioSettings::default();
        assert_eq!(s.backend, SttBackend::Offline);
        assert!(s.deepgram_api_key.is_empty());
    }

    #[test]
    fn key_not_serialized_to_json() {
        let s = AudioSettings {
            backend: SttBackend::Online,
            deepgram_api_key: "secret-key".into(),
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(!json.contains("secret-key"), "key must not appear in JSON");
        assert!(!json.contains("deepgram_api_key"), "key field must not appear in JSON");
    }

    #[test]
    fn missing_fields_use_defaults() {
        let json = r#"{}"#;
        let s: AudioSettings = serde_json::from_str(json).unwrap();
        assert_eq!(s.backend, SttBackend::Offline);
        assert!(s.deepgram_api_key.is_empty());
    }

    #[test]
    fn legacy_json_with_key_is_readable() {
        // Old format that included the key in JSON — migration path must parse it.
        let json = r#"{"backend":"online","deepgram_api_key":"old-plaintext-key"}"#;
        let file: AudioSettingsFile = serde_json::from_str(json).unwrap();
        assert_eq!(file.backend, SttBackend::Online);
        assert_eq!(file.deepgram_api_key, "old-plaintext-key");
    }
}
