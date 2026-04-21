//! Provider registry — holds all compiled-in STT providers.

use crate::provider::SttProvider;
use std::collections::HashMap;

/// Central registry of available STT providers.
///
/// Initialized at app startup with all feature-gated providers.
/// Stored in `AppState` and queried by Tauri commands.
pub struct ProviderRegistry {
    providers: HashMap<String, Box<dyn SttProvider>>,
}

impl ProviderRegistry {
    /// Create a new registry pre-populated with all compiled-in providers.
    pub fn new() -> Self {
        let mut reg = Self {
            providers: HashMap::new(),
        };

        #[cfg(feature = "whisper")]
        reg.register(Box::new(crate::whisper_provider::WhisperProvider));

        #[cfg(feature = "deepgram")]
        reg.register(Box::new(crate::deepgram_provider::DeepgramProvider));

        reg
    }

    /// Register a provider. If a provider with the same ID already exists,
    /// it is replaced.
    pub fn register(&mut self, provider: Box<dyn SttProvider>) {
        let id = provider.info().id.clone();
        self.providers.insert(id, provider);
    }

    /// Look up a provider by ID.
    pub fn get(&self, id: &str) -> Option<&dyn SttProvider> {
        self.providers.get(id).map(|p| p.as_ref())
    }

    /// List all registered providers.
    pub fn list(&self) -> Vec<&dyn SttProvider> {
        self.providers.values().map(|p| p.as_ref()).collect()
    }

    /// List all registered provider IDs.
    pub fn ids(&self) -> Vec<String> {
        self.providers.keys().cloned().collect()
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// SAFETY: All providers are `Send + Sync + 'static` per the trait bound.
unsafe impl Send for ProviderRegistry {}
unsafe impl Sync for ProviderRegistry {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_new_does_not_panic() {
        let reg = ProviderRegistry::new();
        // Should have at least the compiled-in providers
        let ids = reg.ids();
        // In test builds, whisper and deepgram features may or may not be enabled
        assert!(ids.len() <= 2);
    }

    #[test]
    fn registry_get_unknown_returns_none() {
        let reg = ProviderRegistry::new();
        assert!(reg.get("nonexistent").is_none());
    }
}
