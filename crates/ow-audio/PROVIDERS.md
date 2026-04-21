# STT Provider Guide

This document explains how to add a new speech-to-text (STT) backend to OpenWorship.

## Architecture

```
ProviderRegistry        (holds all compiled-in providers)
  |
  +-- WhisperProvider   (local, needs model files)
  +-- DeepgramProvider  (cloud, needs API key)
  +-- YourProvider      (add your own!)
  |
  v
SttProvider trait        (metadata, config fields, model management)
  |
  v
Transcriber trait        (the actual transcription: audio in, text out)
  |
  v
SttEngine               (sliding window, VAD, diff, event emission)
  |
  v
Frontend Settings UI    (data-driven from ProviderInfo.config_fields)
```

The frontend settings UI renders **automatically** from the `ProviderInfo` your provider returns. You don't need to write any React code.

## Adding a New Provider

### Step 1: Create the provider file

Create `crates/ow-audio/src/{name}_provider.rs`:

```rust
//! {Name} STT provider.

#![cfg(feature = "{name}")]

use crate::provider::*;
use crate::transcribe::Transcriber;
use anyhow::Result;
use std::path::PathBuf;

pub struct {Name}Provider;

impl SttProvider for {Name}Provider {
    fn info(&self) -> ProviderInfo {
        ProviderInfo {
            id: "{name}".into(),
            name: "{Name} (local)".into(),
            description: "Description of your provider.".into(),
            is_local: true,  // or false for cloud providers
            config_fields: vec![
                // Define what config your provider needs from the user.
                // The settings UI renders these automatically.
                ConfigField {
                    key: "model".into(),
                    label: "Model".into(),
                    field_type: "select".into(),
                    options: vec![
                        ConfigOption {
                            value: "default".into(),
                            label: "Default Model".into(),
                            description: "".into(),
                        },
                    ],
                    default: serde_json::Value::String("default".into()),
                    description: "Select the model to use.".into(),
                    is_secret: false,
                },
            ],
        }
    }

    fn check_status(&self, config: &serde_json::Value) -> ProviderStatus {
        let model_id = config.get("model").and_then(|v| v.as_str()).unwrap_or("default");
        if self.is_model_installed(model_id) {
            ProviderStatus::Ready
        } else {
            ProviderStatus::NeedsModel { models: self.available_models() }
        }
    }

    fn available_models(&self) -> Vec<ModelInfo> {
        vec![ModelInfo {
            id: "default".into(),
            label: "Default (~100 MB)".into(),
            size_bytes: 100_000_000,
            download_url: "https://example.com/model.bin".into(),
            filename: "model.bin".into(),
            is_recommended: true,
        }]
    }

    fn is_model_installed(&self, model_id: &str) -> bool {
        self.model_path(model_id)
            .map(|p| p.exists())
            .unwrap_or(false)
    }

    fn model_path(&self, _model_id: &str) -> Option<PathBuf> {
        let home = std::env::var("HOME").unwrap_or_default();
        Some(PathBuf::from(home)
            .join(".openworship")
            .join("models")
            .join("your-model.bin"))
    }

    fn validate_config(&self, _config: &serde_json::Value) -> Result<()> {
        Ok(())
    }

    fn create_transcriber(
        &self,
        config: &serde_json::Value,
    ) -> Result<Box<dyn Transcriber>> {
        // Load your model and create a Transcriber
        let _model_id = config.get("model").and_then(|v| v.as_str()).unwrap_or("default");
        todo!("Create your transcriber here")
    }
}
```

### Step 2: Implement the Transcriber trait

Your transcriber just needs one method:

```rust
impl Transcriber for YourTranscriber {
    fn transcribe(&mut self, samples: &[f32]) -> Result<String> {
        // samples: 16 kHz mono f32 audio
        // Return the transcribed text
        Ok("transcribed text".into())
    }
}
```

### Step 3: Add a feature flag

In `crates/ow-audio/Cargo.toml`:

```toml
[features]
{name} = ["dep:your-dependency"]

[dependencies]
your-dependency = { version = "...", optional = true }
```

### Step 4: Register the provider

In `crates/ow-audio/src/registry.rs`, add:

```rust
#[cfg(feature = "{name}")]
reg.register(Box::new(crate::{name}_provider::{Name}Provider));
```

In `crates/ow-audio/src/lib.rs`, add:

```rust
mod {name}_provider;
```

### Step 5: Enable the feature in the desktop app

In `apps/desktop/Cargo.toml`:

```toml
[features]
default = ["whisper", "deepgram", "{name}"]
{name} = ["ow-audio/{name}"]
```

That's it! The settings UI will automatically show your provider in the backend selector, render its config fields, and handle model download if needed.

## Provider Trait Reference

| Method | Purpose |
|--------|---------|
| `info()` | Returns metadata: ID, name, description, config fields |
| `check_status(config)` | Returns Ready / NeedsModel / NeedsConfig / Unavailable |
| `available_models()` | Returns downloadable models (empty for cloud providers) |
| `is_model_installed(model_id)` | Checks if a model file exists locally |
| `model_path(model_id)` | Returns where the model file should live |
| `validate_config(config)` | Validates the config blob |
| `create_transcriber(config)` | Creates a `Box<dyn Transcriber>` from config |

## ConfigField Types

| `field_type` | UI Rendering | Example |
|-------------|-------------|---------|
| `"text"` | Text input | Server URL, model name |
| `"password"` | Masked input with save button | API keys |
| `"select"` | Dropdown from `options` | Model size selection |
| `"toggle"` | On/off switch | Enable/disable features |

## Secrets

Fields with `is_secret: true` are:
- **Never written** to `settings.json`
- Stored in the OS keychain (macOS Keychain, Windows Credential Manager, Linux libsecret)
- Keychain key pattern: `stt_{provider_id}_{field_key}`
- Hydrated into the config at runtime before passing to `create_transcriber()`

## Model Management

When `check_status()` returns `NeedsModel`:
1. The UI shows a model selector from `available_models()`
2. User clicks "Download" for their chosen model
3. The app downloads from `ModelInfo.download_url` to `model_path(model_id)`
4. Progress events are emitted via `stt://model-download-progress`
5. On completion, `is_model_installed()` returns `true` and `check_status()` returns `Ready`

## Existing Providers

| Provider | Feature Flag | Type | Config Fields |
|----------|-------------|------|--------------|
| Whisper | `whisper` | Local | `model` (select: tiny/base/small/medium) |
| Deepgram | `deepgram` | Cloud | `api_key` (password, secret) |
