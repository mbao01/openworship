//! Tutorial (guided-tour) state persisted to `~/.openworship/tutorial.json`.
//!
//! The frontend drives the tour flow; this module only stores and retrieves
//! the current step so it survives app restarts.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;

/// Mirrors the TypeScript `TutorialState` union type (snake_case strings).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum TutorialState {
    #[default]
    #[serde(rename = "not_started")]
    NotStarted,
    #[serde(rename = "in_progress_step_1")]
    InProgressStep1,
    #[serde(rename = "in_progress_step_2")]
    InProgressStep2,
    #[serde(rename = "in_progress_step_3")]
    InProgressStep3,
    #[serde(rename = "in_progress_step_4")]
    InProgressStep4,
    #[serde(rename = "in_progress_step_5")]
    InProgressStep5,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "dismissed")]
    Dismissed,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct TutorialFile {
    state: TutorialState,
}

fn tutorial_path() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(PathBuf::from(home).join(".openworship").join("tutorial.json"))
}

/// Load the persisted tutorial state.
/// Returns `"not_started"` on any error (missing file, parse failure, etc.).
#[command]
pub fn get_tutorial_state() -> TutorialState {
    let path = match tutorial_path() {
        Some(p) => p,
        None => return TutorialState::default(),
    };
    if !path.exists() {
        return TutorialState::default();
    }
    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(_) => return TutorialState::default(),
    };
    match serde_json::from_slice::<TutorialFile>(&bytes) {
        Ok(f) => f.state,
        Err(_) => TutorialState::default(),
    }
}

/// Persist a new tutorial state.  Errors are silently swallowed — the
/// frontend falls back to the last known in-memory value.
#[command]
pub fn set_tutorial_state(state: TutorialState) {
    let path = match tutorial_path() {
        Some(p) => p,
        None => return,
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let file = TutorialFile { state };
    if let Ok(json) = serde_json::to_vec_pretty(&file) {
        let _ = std::fs::write(&path, json);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_state_is_not_started() {
        assert_eq!(TutorialState::default(), TutorialState::NotStarted);
    }

    #[test]
    fn state_round_trips_through_json() {
        for state in [
            TutorialState::NotStarted,
            TutorialState::InProgressStep1,
            TutorialState::InProgressStep3,
            TutorialState::Completed,
            TutorialState::Dismissed,
        ] {
            let json = serde_json::to_string(&state).unwrap();
            let parsed: TutorialState = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, state);
        }
    }

    #[test]
    fn state_serialises_to_snake_case_strings() {
        assert_eq!(
            serde_json::to_string(&TutorialState::NotStarted).unwrap(),
            "\"not_started\""
        );
        assert_eq!(
            serde_json::to_string(&TutorialState::InProgressStep1).unwrap(),
            "\"in_progress_step_1\""
        );
        assert_eq!(
            serde_json::to_string(&TutorialState::InProgressStep5).unwrap(),
            "\"in_progress_step_5\""
        );
        assert_eq!(
            serde_json::to_string(&TutorialState::Completed).unwrap(),
            "\"completed\""
        );
        assert_eq!(
            serde_json::to_string(&TutorialState::Dismissed).unwrap(),
            "\"dismissed\""
        );
    }

    #[test]
    fn file_struct_round_trips() {
        let original = TutorialFile {
            state: TutorialState::InProgressStep2,
        };
        let json = serde_json::to_string(&original).unwrap();
        let parsed: TutorialFile = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.state, TutorialState::InProgressStep2);
    }
}
