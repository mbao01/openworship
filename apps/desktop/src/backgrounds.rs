//! Preset and custom display backgrounds.
//!
//! Presets are defined as static metadata; actual images are generated
//! programmatically as CSS gradients (no bundled files needed).
//! Custom backgrounds are stored as artifacts in `_backgrounds/`.

use serde::{Deserialize, Serialize};

/// A background option available to the operator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundInfo {
    /// Unique ID: "preset:dark_gradient", "artifact:abc123", etc.
    pub id: String,
    /// Display name.
    pub name: String,
    /// "preset" or "uploaded"
    pub source: String,
    /// CSS gradient or artifact reference for preview rendering.
    /// For presets: a CSS gradient string.
    /// For uploads: "artifact:{id}" reference.
    pub value: String,
    /// "gradient", "image", "video"
    pub bg_type: String,
}

/// Built-in preset backgrounds (CSS gradients — no bundled files needed).
pub fn list_presets() -> Vec<BackgroundInfo> {
    vec![
        BackgroundInfo {
            id: "preset:solid_black".into(),
            name: "Solid Black".into(),
            source: "preset".into(),
            value: "#000000".into(),
            bg_type: "gradient".into(),
        },
        BackgroundInfo {
            id: "preset:dark_gradient".into(),
            name: "Dark Gradient".into(),
            source: "preset".into(),
            value: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)".into(),
            bg_type: "gradient".into(),
        },
        BackgroundInfo {
            id: "preset:warm_glow".into(),
            name: "Warm Glow".into(),
            source: "preset".into(),
            value: "linear-gradient(135deg, #1a0d00 0%, #2d1810 40%, #3a1c0f 100%)".into(),
            bg_type: "gradient".into(),
        },
        BackgroundInfo {
            id: "preset:midnight_blue".into(),
            name: "Midnight Blue".into(),
            source: "preset".into(),
            value: "linear-gradient(180deg, #020024 0%, #090979 35%, #00d4ff 100%)".into(),
            bg_type: "gradient".into(),
        },
        BackgroundInfo {
            id: "preset:royal_purple".into(),
            name: "Royal Purple".into(),
            source: "preset".into(),
            value: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)".into(),
            bg_type: "gradient".into(),
        },
        BackgroundInfo {
            id: "preset:forest_green".into(),
            name: "Forest Green".into(),
            source: "preset".into(),
            value: "linear-gradient(135deg, #0a1a0a 0%, #1a3a1a 50%, #0d2b0d 100%)".into(),
            bg_type: "gradient".into(),
        },
        BackgroundInfo {
            id: "preset:sunrise".into(),
            name: "Sunrise".into(),
            source: "preset".into(),
            value: "linear-gradient(180deg, #1a0a2e 0%, #4a1942 30%, #c94b4b 70%, #f09819 100%)".into(),
            bg_type: "gradient".into(),
        },
        BackgroundInfo {
            id: "preset:starry_night".into(),
            name: "Starry Night".into(),
            source: "preset".into(),
            value: "radial-gradient(ellipse at 20% 50%, #1b2735 0%, #090a0f 100%)".into(),
            bg_type: "gradient".into(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_have_unique_ids() {
        let presets = list_presets();
        let ids: Vec<&str> = presets.iter().map(|p| p.id.as_str()).collect();
        let unique: std::collections::HashSet<&str> = ids.iter().copied().collect();
        assert_eq!(ids.len(), unique.len(), "Preset IDs must be unique");
    }

    #[test]
    fn presets_are_not_empty() {
        assert!(!list_presets().is_empty());
    }

    #[test]
    fn all_presets_have_gradient_type() {
        for p in list_presets() {
            assert_eq!(p.bg_type, "gradient");
            assert_eq!(p.source, "preset");
            assert!(p.id.starts_with("preset:"));
        }
    }
}
