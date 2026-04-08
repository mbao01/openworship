//! Persistent audio settings stored in `~/.openworship/settings.json`.

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
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct AudioSettings {
    /// Selected STT backend.
    pub backend: SttBackend,
    /// Deepgram API key. Empty string means not configured.
    pub deepgram_api_key: String,
}

impl AudioSettings {
    /// Load from `~/.openworship/settings.json`, returning defaults on any error.
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
        Ok(serde_json::from_slice(&bytes)?)
    }

    /// Persist to `~/.openworship/settings.json`.
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
    fn round_trip_json() {
        let s = AudioSettings {
            backend: SttBackend::Online,
            deepgram_api_key: "test-key-123".into(),
        };
        let json = serde_json::to_string(&s).unwrap();
        let back: AudioSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(back.backend, SttBackend::Online);
        assert_eq!(back.deepgram_api_key, "test-key-123");
    }

    #[test]
    fn missing_fields_use_defaults() {
        let json = r#"{}"#;
        let s: AudioSettings = serde_json::from_str(json).unwrap();
        assert_eq!(s.backend, SttBackend::Offline);
        assert!(s.deepgram_api_key.is_empty());
    }
}
