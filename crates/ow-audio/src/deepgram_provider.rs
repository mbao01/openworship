//! Deepgram cloud STT provider — online streaming transcription via WebSocket.
//!
//! Only compiled when the `deepgram` feature is enabled.

#![cfg(feature = "deepgram")]

use crate::provider::*;
use crate::transcribe::Transcriber;
use anyhow::Result;
use std::path::PathBuf;

/// The Deepgram cloud STT provider.
pub struct DeepgramProvider;

impl SttProvider for DeepgramProvider {
    fn info(&self) -> ProviderInfo {
        ProviderInfo {
            id: "deepgram".into(),
            name: "Deepgram (cloud)".into(),
            description: "Cloud-based speech-to-text using Deepgram Nova-2. Requires an API key and internet connection.".into(),
            is_local: false,
            config_fields: vec![ConfigField {
                key: "api_key".into(),
                label: "API key".into(),
                field_type: "password".into(),
                options: vec![],
                default: serde_json::Value::String(String::new()),
                description: "Your Deepgram API key (starts with dg_…)".into(),
                is_secret: true,
            }],
        }
    }

    fn check_status(&self, config: &serde_json::Value) -> ProviderStatus {
        let key = config
            .get("api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if key.is_empty() {
            ProviderStatus::NeedsConfig {
                missing_fields: vec!["api_key".into()],
            }
        } else {
            ProviderStatus::Ready
        }
    }

    fn available_models(&self) -> Vec<ModelInfo> {
        // Deepgram is a cloud service — no local models to download.
        vec![]
    }

    fn is_model_installed(&self, _model_id: &str) -> bool {
        // Cloud provider — always "installed".
        true
    }

    fn model_path(&self, _model_id: &str) -> Option<PathBuf> {
        None
    }

    fn validate_config(&self, config: &serde_json::Value) -> Result<()> {
        let key = config
            .get("api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if key.is_empty() {
            anyhow::bail!("Deepgram API key is required");
        }
        Ok(())
    }

    fn create_transcriber(
        &self,
        config: &serde_json::Value,
    ) -> Result<Box<dyn Transcriber>> {
        let key = config
            .get("api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if key.is_empty() {
            anyhow::bail!("Deepgram API key is required");
        }

        let transcriber = crate::deepgram::DeepgramTranscriber::new(key)?;
        Ok(Box::new(transcriber))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn info_has_correct_id() {
        let p = DeepgramProvider;
        let info = p.info();
        assert_eq!(info.id, "deepgram");
        assert!(!info.is_local);
        assert_eq!(info.config_fields.len(), 1);
        assert_eq!(info.config_fields[0].key, "api_key");
        assert!(info.config_fields[0].is_secret);
    }

    #[test]
    fn no_models_for_cloud_provider() {
        let p = DeepgramProvider;
        assert!(p.available_models().is_empty());
    }

    #[test]
    fn check_status_needs_config_when_no_key() {
        let p = DeepgramProvider;
        let config = serde_json::json!({});
        match p.check_status(&config) {
            ProviderStatus::NeedsConfig { missing_fields } => {
                assert!(missing_fields.contains(&"api_key".to_string()));
            }
            other => panic!("Expected NeedsConfig, got {other:?}"),
        }
    }

    #[test]
    fn check_status_ready_when_key_present() {
        let p = DeepgramProvider;
        let config = serde_json::json!({ "api_key": "dg_test123" });
        match p.check_status(&config) {
            ProviderStatus::Ready => {}
            other => panic!("Expected Ready, got {other:?}"),
        }
    }

    #[test]
    fn validate_rejects_empty_key() {
        let p = DeepgramProvider;
        let config = serde_json::json!({ "api_key": "" });
        assert!(p.validate_config(&config).is_err());
    }
}
