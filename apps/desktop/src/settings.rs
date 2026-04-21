//! Persistent audio settings stored in `~/.openworship/settings.json`.
//!
//! The Deepgram API key is **not** written to `settings.json`; it is stored in
//! the OS keychain via [`crate::keychain`]. On first load after upgrading from
//! an older build that did store the key in plaintext JSON, the migration path
//! reads the key, saves it to the keychain, and re-saves the file without it.
//!
//! Display settings are persisted separately in `~/.openworship/display_settings.json`.

use anyhow::Result;
use ow_core::DetectionMode;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// UI colour scheme preference.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ThemeMode {
    /// Follow the OS `prefers-color-scheme` setting.
    #[default]
    System,
    /// Always use the light palette.
    Light,
    /// Always use the dark palette.
    Dark,
}

/// Which Whisper model size to use for local STT.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WhisperModel {
    /// ~75 MB — fastest, lowest quality.
    Tiny,
    /// ~140 MB — decent balance for older hardware.
    #[default]
    Base,
    /// ~460 MB — good quality, recommended for Apple Silicon.
    Small,
    /// ~1.5 GB — high quality, slower on CPU.
    Medium,
}

impl WhisperModel {
    /// Returns the ggml model filename for this variant.
    pub fn filename(&self) -> &'static str {
        match self {
            Self::Tiny => "ggml-tiny.en.bin",
            Self::Base => "ggml-base.en.bin",
            Self::Small => "ggml-small.en.bin",
            Self::Medium => "ggml-medium.en.bin",
        }
    }
}

/// Which STT backend the operator has selected.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SttBackend {
    /// Offline Whisper.cpp (default).
    /// Deserialises from both `"whisper"` (current) and `"offline"` (legacy).
    #[default]
    #[serde(alias = "offline")]
    Whisper,
    /// Online Deepgram streaming WebSocket.
    /// Deserialises from both `"deepgram"` (current) and `"online"` (legacy).
    #[serde(alias = "online")]
    Deepgram,
    /// STT disabled — no transcription will run.
    Off,
}

/// Operator-controlled audio settings, persisted across restarts.
///
/// `deepgram_api_key` is held in memory and exchanged over the Tauri command
/// bridge, but is **skipped during JSON serialisation** — the key lives in the
/// OS keychain (see [`crate::keychain`]).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AudioSettings {
    /// Selected STT backend.
    pub backend: SttBackend,
    /// Deepgram API key — runtime only, never written to disk.
    #[serde(skip_serializing)]
    pub deepgram_api_key: String,
    /// Enable semantic (paraphrase / story) scripture matching via Ollama.
    /// When `false` or when Ollama is unavailable, only exact detection runs.
    pub semantic_enabled: bool,
    /// Cosine-similarity threshold for semantic matches in Auto / Offline mode.
    /// Range `[0, 1]`; higher = stricter.  Default: 0.75.
    pub semantic_threshold_auto: f32,
    /// Cosine-similarity threshold for semantic matches in Copilot mode.
    /// Default: 0.82 (stricter, because the operator reviews before display).
    pub semantic_threshold_copilot: f32,
    /// Semantic match threshold for song lyrics in Auto / Offline mode. Default: 0.70.
    pub lyrics_threshold_auto: f32,
    /// Semantic match threshold for song lyrics in Copilot mode. Default: 0.78.
    pub lyrics_threshold_copilot: f32,
    /// Preferred audio input device name. `None` means system default.
    #[serde(default)]
    pub audio_input_device: Option<String>,
    /// UI colour scheme preference. Default: `System`.
    #[serde(default)]
    pub theme: ThemeMode,
    /// Detection mode persisted across restarts. Default: Copilot.
    #[serde(default)]
    pub detection_mode: DetectionMode,
    /// Which Whisper model to use for local STT.
    #[serde(default)]
    pub whisper_model: WhisperModel,
    /// Per-provider configuration blobs. Key = provider ID, value = provider-specific JSON.
    /// Example: `{ "whisper": { "model": "small" }, "deepgram": {} }`
    #[serde(default)]
    pub provider_config: HashMap<String, serde_json::Value>,
}

impl Default for AudioSettings {
    fn default() -> Self {
        Self {
            backend: SttBackend::default(),
            deepgram_api_key: String::new(),
            semantic_enabled: true,
            semantic_threshold_auto: 0.75,
            semantic_threshold_copilot: 0.82,
            lyrics_threshold_auto: 0.70,
            lyrics_threshold_copilot: 0.78,
            audio_input_device: None,
            theme: ThemeMode::System,
            detection_mode: DetectionMode::default(),
            whisper_model: WhisperModel::default(),
            provider_config: HashMap::new(),
        }
    }
}

impl AudioSettings {
    /// Get the provider config for a given provider ID, merging legacy fields.
    /// This ensures backward compatibility: old `whisper_model` and `deepgram_api_key`
    /// fields are reflected in provider_config.
    pub fn provider_config_for(&self, provider_id: &str) -> serde_json::Value {
        let mut config = self
            .provider_config
            .get(provider_id)
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));

        // Merge legacy fields if not already in provider_config
        match provider_id {
            "whisper" => {
                if config.get("model").is_none() {
                    let model = match self.whisper_model {
                        WhisperModel::Tiny => "tiny",
                        WhisperModel::Base => "base",
                        WhisperModel::Small => "small",
                        WhisperModel::Medium => "medium",
                    };
                    config["model"] = serde_json::Value::String(model.into());
                }
            }
            "deepgram" => {
                if config.get("api_key").is_none() && !self.deepgram_api_key.is_empty() {
                    config["api_key"] =
                        serde_json::Value::String(self.deepgram_api_key.clone());
                }
            }
            _ => {}
        }

        config
    }
}

/// Deserialisation target that can still read the old plaintext key field.
/// Used only for one-time migration.
#[derive(Deserialize, Default)]
#[serde(default)]
struct AudioSettingsFile {
    backend: SttBackend,
    /// Present in pre-keychain builds; absent (default empty) afterwards.
    deepgram_api_key: String,
    semantic_enabled: Option<bool>,
    semantic_threshold_auto: Option<f32>,
    semantic_threshold_copilot: Option<f32>,
    lyrics_threshold_auto: Option<f32>,
    lyrics_threshold_copilot: Option<f32>,
    audio_input_device: Option<String>,
    #[serde(default)]
    theme: ThemeMode,
    #[serde(default)]
    detection_mode: Option<DetectionMode>,
    #[serde(default)]
    whisper_model: Option<WhisperModel>,
    #[serde(default)]
    provider_config: Option<HashMap<String, serde_json::Value>>,
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
                ..Self::default()
            };
            if let Err(e) = clean.save() {
                eprintln!("[settings] failed to re-save after migration: {e}");
            }
        }

        // Load the key from keychain for in-memory use.
        let deepgram_api_key = crate::keychain::get_deepgram_api_key().unwrap_or_default();
        let defaults = Self::default();

        Ok(Self {
            backend: file.backend,
            deepgram_api_key,
            semantic_enabled: file.semantic_enabled.unwrap_or(defaults.semantic_enabled),
            semantic_threshold_auto: file
                .semantic_threshold_auto
                .unwrap_or(defaults.semantic_threshold_auto),
            semantic_threshold_copilot: file
                .semantic_threshold_copilot
                .unwrap_or(defaults.semantic_threshold_copilot),
            lyrics_threshold_auto: file
                .lyrics_threshold_auto
                .unwrap_or(defaults.lyrics_threshold_auto),
            lyrics_threshold_copilot: file
                .lyrics_threshold_copilot
                .unwrap_or(defaults.lyrics_threshold_copilot),
            audio_input_device: file.audio_input_device,
            theme: file.theme,
            detection_mode: file.detection_mode.unwrap_or(defaults.detection_mode),
            whisper_model: file.whisper_model.unwrap_or(defaults.whisper_model),
            provider_config: file.provider_config.unwrap_or_default(),
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

// ── Display settings ──────────────────────────────────────────────────────────

/// Display output settings, persisted to `~/.openworship/display_settings.json`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct DisplaySettings {
    /// Index into the monitor list returned by `available_monitors()`.
    /// `None` means "use primary monitor".
    pub selected_monitor_index: Option<usize>,
    /// When `true`, open the display window on every connected monitor.
    pub multi_output: bool,
}

impl DisplaySettings {
    /// Load from `~/.openworship/display_settings.json`, returning defaults on error.
    pub fn load() -> Self {
        match Self::try_load() {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[display_settings] failed to load: {e}; using defaults");
                Self::default()
            }
        }
    }

    fn try_load() -> Result<Self> {
        let path = display_settings_path()?;
        if !path.exists() {
            return Ok(Self::default());
        }
        let bytes = std::fs::read(&path)?;
        Ok(serde_json::from_slice(&bytes)?)
    }

    /// Persist to `~/.openworship/display_settings.json`.
    pub fn save(&self) -> Result<()> {
        let path = display_settings_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_vec_pretty(self)?;
        std::fs::write(&path, json)?;
        Ok(())
    }
}

fn display_settings_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Ok(PathBuf::from(home)
        .join(".openworship")
        .join("display_settings.json"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_backend_is_whisper() {
        let s = AudioSettings::default();
        assert_eq!(s.backend, SttBackend::Whisper);
        assert!(s.deepgram_api_key.is_empty());
    }

    #[test]
    fn key_not_serialized_to_json() {
        let s = AudioSettings {
            backend: SttBackend::Deepgram,
            deepgram_api_key: "secret-key".into(),
            ..AudioSettings::default()
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(!json.contains("secret-key"), "key must not appear in JSON");
        assert!(!json.contains("deepgram_api_key"), "key field must not appear in JSON");
    }

    #[test]
    fn missing_fields_use_defaults() {
        let json = r#"{}"#;
        let s: AudioSettings = serde_json::from_str(json).unwrap();
        assert_eq!(s.backend, SttBackend::Whisper);
        assert!(s.deepgram_api_key.is_empty());
    }

    #[test]
    fn legacy_json_with_key_is_readable() {
        // Old format that included the key in JSON — migration path must parse it.
        let json = r#"{"backend":"online","deepgram_api_key":"old-plaintext-key"}"#;
        let file: AudioSettingsFile = serde_json::from_str(json).unwrap();
        assert_eq!(file.backend, SttBackend::Deepgram);
        assert_eq!(file.deepgram_api_key, "old-plaintext-key");
    }

    #[test]
    fn legacy_offline_backend_deserialises_as_whisper() {
        let json = r#"{"backend":"offline"}"#;
        let s: AudioSettings = serde_json::from_str(json).unwrap();
        assert_eq!(s.backend, SttBackend::Whisper);
    }

    #[test]
    fn new_backend_values_round_trip() {
        for backend in [SttBackend::Whisper, SttBackend::Deepgram, SttBackend::Off] {
            let json = serde_json::to_string(&AudioSettings { backend: backend.clone(), ..Default::default() }).unwrap();
            let parsed: AudioSettings = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed.backend, backend);
        }
    }

    #[test]
    fn lyrics_thresholds_have_correct_defaults() {
        let s = AudioSettings::default();
        assert!(
            (s.lyrics_threshold_auto - 0.70).abs() < f32::EPSILON,
            "lyrics_threshold_auto default should be 0.70, got {}",
            s.lyrics_threshold_auto
        );
        assert!(
            (s.lyrics_threshold_copilot - 0.78).abs() < f32::EPSILON,
            "lyrics_threshold_copilot default should be 0.78, got {}",
            s.lyrics_threshold_copilot
        );
    }

    #[test]
    fn lyrics_thresholds_lower_than_scripture_thresholds() {
        let s = AudioSettings::default();
        assert!(
            s.lyrics_threshold_auto < s.semantic_threshold_auto,
            "lyrics auto ({}) should be lower than scripture auto ({})",
            s.lyrics_threshold_auto,
            s.semantic_threshold_auto
        );
        assert!(
            s.lyrics_threshold_copilot < s.semantic_threshold_copilot,
            "lyrics copilot ({}) should be lower than scripture copilot ({})",
            s.lyrics_threshold_copilot,
            s.semantic_threshold_copilot
        );
    }

    #[test]
    fn missing_lyrics_fields_use_defaults() {
        let json = r#"{"backend":"offline"}"#;
        let s: AudioSettings = serde_json::from_str(json).unwrap();
        assert!((s.lyrics_threshold_auto - 0.70).abs() < f32::EPSILON);
        assert!((s.lyrics_threshold_copilot - 0.78).abs() < f32::EPSILON);
    }

    #[test]
    fn default_has_expected_values() {
        let s = AudioSettings::default();
        assert_eq!(s.backend, SttBackend::Whisper);
        assert!(s.deepgram_api_key.is_empty());
        assert!(s.semantic_enabled);
        assert!((s.semantic_threshold_auto - 0.75).abs() < f32::EPSILON);
        assert!((s.semantic_threshold_copilot - 0.82).abs() < f32::EPSILON);
        assert!(s.audio_input_device.is_none());
        assert_eq!(s.theme, ThemeMode::System);
    }

    #[test]
    fn default_includes_detection_mode() {
        let s = AudioSettings::default();
        // detection_mode should default to Copilot (from ow_core::DetectionMode::default())
        assert_eq!(s.detection_mode, DetectionMode::Copilot);
    }

    #[test]
    fn detection_mode_survives_json_round_trip() {
        let s = AudioSettings {
            detection_mode: DetectionMode::Auto,
            ..AudioSettings::default()
        };
        let json = serde_json::to_string(&s).unwrap();
        let parsed: AudioSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.detection_mode, DetectionMode::Auto);
    }

    #[test]
    fn load_returns_defaults_when_no_file() {
        // AudioSettings::load() reads from HOME-based path.
        // When HOME points to a non-existent dir, try_load returns defaults.
        // We test the fallback by deserializing an empty JSON object.
        let json = r#"{}"#;
        let s: AudioSettings = serde_json::from_str(json).unwrap();
        assert_eq!(s.backend, SttBackend::Whisper);
        assert_eq!(s.detection_mode, DetectionMode::Copilot);
    }
}
