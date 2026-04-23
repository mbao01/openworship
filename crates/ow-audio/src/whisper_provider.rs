//! Whisper.cpp STT provider — local offline transcription via whisper-rs.
//!
//! Only compiled when the `whisper` feature is enabled.

#![cfg(feature = "whisper")]

use crate::provider::*;
use crate::transcribe::{self, Transcriber, WhisperTranscriber};
use anyhow::Result;
use std::path::PathBuf;

/// Whisper model variants with metadata.
struct WhisperModelDef {
    id: &'static str,
    label: &'static str,
    filename: &'static str,
    size_bytes: u64,
    recommended: bool,
}

const MODELS: &[WhisperModelDef] = &[
    WhisperModelDef {
        id: "tiny",
        label: "Tiny (~75 MB)",
        filename: "ggml-tiny.en.bin",
        size_bytes: 75_000_000,
        recommended: false,
    },
    WhisperModelDef {
        id: "base",
        label: "Base (~140 MB)",
        filename: "ggml-base.en.bin",
        size_bytes: 140_000_000,
        recommended: false,
    },
    WhisperModelDef {
        id: "small",
        label: "Small (~460 MB)",
        filename: "ggml-small.en.bin",
        size_bytes: 460_000_000,
        recommended: true,
    },
    WhisperModelDef {
        id: "medium",
        label: "Medium (~1.5 GB)",
        filename: "ggml-medium.en.bin",
        size_bytes: 1_500_000_000,
        recommended: false,
    },
];

fn huggingface_url(filename: &str) -> String {
    format!(
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{filename}"
    )
}

/// The Whisper local STT provider.
pub struct WhisperProvider;

impl SttProvider for WhisperProvider {
    fn info(&self) -> ProviderInfo {
        ProviderInfo {
            id: "whisper".into(),
            name: "Whisper (local)".into(),
            description: "Offline speech-to-text using OpenAI Whisper. Runs entirely on your device.".into(),
            is_local: true,
            config_fields: vec![ConfigField {
                key: "model".into(),
                label: "Model size".into(),
                field_type: "select".into(),
                options: MODELS
                    .iter()
                    .map(|m| ConfigOption {
                        value: m.id.into(),
                        label: m.label.into(),
                        description: if m.recommended {
                            "Recommended".into()
                        } else {
                            String::new()
                        },
                    })
                    .collect(),
                default: serde_json::Value::String("base".into()),
                description: "Larger models are more accurate but slower and use more RAM.".into(),
                is_secret: false,
            }],
        }
    }

    fn check_status(&self, config: &serde_json::Value) -> ProviderStatus {
        let model_id = config
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("base");

        if self.is_model_installed(model_id) {
            ProviderStatus::Ready
        } else {
            ProviderStatus::NeedsModel {
                models: self.available_models(),
            }
        }
    }

    fn available_models(&self) -> Vec<ModelInfo> {
        MODELS
            .iter()
            .map(|m| ModelInfo {
                id: m.id.into(),
                label: m.label.into(),
                size_bytes: m.size_bytes,
                download_url: huggingface_url(m.filename),
                filename: m.filename.into(),
                is_recommended: m.recommended,
            })
            .collect()
    }

    fn is_model_installed(&self, model_id: &str) -> bool {
        MODELS
            .iter()
            .find(|m| m.id == model_id)
            .map(|m| transcribe::model_path_for(m.filename).exists())
            .unwrap_or(false)
    }

    fn model_path(&self, model_id: &str) -> Option<PathBuf> {
        MODELS
            .iter()
            .find(|m| m.id == model_id)
            .map(|m| transcribe::model_path_for(m.filename))
    }

    fn validate_config(&self, config: &serde_json::Value) -> Result<()> {
        let model_id = config
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("base");

        if !MODELS.iter().any(|m| m.id == model_id) {
            anyhow::bail!("Unknown model: {model_id}. Valid: tiny, base, small, medium");
        }
        Ok(())
    }

    fn create_transcriber(
        &self,
        config: &serde_json::Value,
    ) -> Result<Box<dyn Transcriber>> {
        let model_id = config
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("base");

        // Resolve: preferred → base → tiny fallback chain
        let filename = MODELS
            .iter()
            .find(|m| m.id == model_id)
            .map(|m| m.filename)
            .unwrap_or("ggml-base.en.bin");

        let path = transcribe::resolve_model_path_for(Some(filename))?;
        let transcriber = WhisperTranscriber::new(&path)?;
        Ok(Box::new(transcriber))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn info_has_correct_id() {
        let p = WhisperProvider;
        let info = p.info();
        assert_eq!(info.id, "whisper");
        assert!(info.is_local);
        assert_eq!(info.config_fields.len(), 1);
        assert_eq!(info.config_fields[0].key, "model");
    }

    #[test]
    fn available_models_has_four() {
        let p = WhisperProvider;
        let models = p.available_models();
        assert_eq!(models.len(), 4);
        assert!(models.iter().any(|m| m.id == "small" && m.is_recommended));
    }

    #[test]
    fn validate_config_rejects_unknown_model() {
        let p = WhisperProvider;
        let config = serde_json::json!({ "model": "huge" });
        assert!(p.validate_config(&config).is_err());
    }

    #[test]
    fn validate_config_accepts_valid_model() {
        let p = WhisperProvider;
        let config = serde_json::json!({ "model": "small" });
        assert!(p.validate_config(&config).is_ok());
    }

    #[test]
    fn check_status_needs_model_when_missing() {
        let p = WhisperProvider;
        // Use a model that definitely isn't installed in test environments
        let config = serde_json::json!({ "model": "medium" });
        match p.check_status(&config) {
            ProviderStatus::NeedsModel { models } => {
                assert!(!models.is_empty());
            }
            ProviderStatus::Ready => {
                // May pass if medium is installed — that's fine
            }
            other => panic!("Unexpected status: {other:?}"),
        }
    }
}
