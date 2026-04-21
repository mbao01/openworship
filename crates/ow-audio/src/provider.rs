//! STT Provider abstraction — allows plugging in any speech-to-text backend.
//!
//! Each provider declares its metadata, configuration fields, available models,
//! and how to create a `Transcriber` from a config blob. The frontend renders
//! the settings UI dynamically from `ProviderInfo`.

use crate::transcribe::Transcriber;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Static metadata about a provider, sent to the frontend to drive the settings UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    /// Unique slug: "whisper", "deepgram", etc.
    pub id: String,
    /// Display name: "Whisper (local)", "Deepgram (cloud)", etc.
    pub name: String,
    /// Short description for the UI.
    pub description: String,
    /// Whether this is a local (offline) or cloud provider.
    pub is_local: bool,
    /// Config fields this provider needs from the user.
    pub config_fields: Vec<ConfigField>,
}

/// Describes a single configuration field the provider needs.
/// The frontend renders the appropriate input based on `field_type`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigField {
    /// Machine key, used as the JSON key in provider_config.
    pub key: String,
    /// Human-readable label shown in the UI.
    pub label: String,
    /// Field type: "text", "password", "select", "toggle".
    pub field_type: String,
    /// For "select" fields: the allowed options.
    #[serde(default)]
    pub options: Vec<ConfigOption>,
    /// Default value.
    #[serde(default)]
    pub default: serde_json::Value,
    /// Help text shown below the field.
    #[serde(default)]
    pub description: String,
    /// Whether the field holds a secret (stored in OS keychain, not settings.json).
    #[serde(default)]
    pub is_secret: bool,
}

/// An option for a "select" config field.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigOption {
    pub value: String,
    pub label: String,
    #[serde(default)]
    pub description: String,
}

/// A downloadable model for providers that need local model files.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    /// Unique model identifier (e.g. "small").
    pub id: String,
    /// Human-readable label (e.g. "Small (~460 MB)").
    pub label: String,
    /// Approximate size in bytes.
    pub size_bytes: u64,
    /// URL to download the model from.
    pub download_url: String,
    /// Filename on disk (e.g. "ggml-small.en.bin").
    pub filename: String,
    /// Whether this model is recommended for most users.
    #[serde(default)]
    pub is_recommended: bool,
}

/// Status of a provider's readiness to transcribe.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ProviderStatus {
    /// Ready to transcribe.
    Ready,
    /// Needs a model download before use.
    NeedsModel { models: Vec<ModelInfo> },
    /// Needs configuration (e.g., API key).
    NeedsConfig { missing_fields: Vec<String> },
    /// Not available (feature not compiled in, platform mismatch, etc.).
    Unavailable { reason: String },
}

/// A full STT provider: metadata + setup + transcriber creation.
///
/// Implement this trait to add a new STT backend. Register your provider
/// in `ProviderRegistry::new()` behind a feature flag, and the settings UI,
/// model download, and startup wiring happen automatically.
pub trait SttProvider: Send + Sync + 'static {
    /// Return static metadata (display name, config fields, description).
    fn info(&self) -> ProviderInfo;

    /// Check readiness given the current config.
    fn check_status(&self, config: &serde_json::Value) -> ProviderStatus;

    /// List downloadable models (empty for cloud-only providers).
    fn available_models(&self) -> Vec<ModelInfo>;

    /// Check if a specific model is installed locally.
    fn is_model_installed(&self, model_id: &str) -> bool;

    /// Return the local path where a model file should live.
    fn model_path(&self, model_id: &str) -> Option<PathBuf>;

    /// Validate the config blob. Returns an error describing what's wrong.
    fn validate_config(&self, config: &serde_json::Value) -> Result<()>;

    /// Create a `Transcriber` from the given config.
    fn create_transcriber(
        &self,
        config: &serde_json::Value,
    ) -> Result<Box<dyn Transcriber>>;
}
