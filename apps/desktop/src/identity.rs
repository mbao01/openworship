//! Church + branch identity, persisted to `~/.openworship/identity.json`.
//!
//! Loaded at startup. If the file is missing the app shows the onboarding flow.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Role of this branch within its church.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BranchRole {
    /// Headquarters — owns the invite code.
    Hq,
    /// Member branch — joined via invite code.
    Member,
}

/// Local church + branch identity, stored in `~/.openworship/identity.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChurchIdentity {
    /// UUIDv4 identifier for the church (shared by all branches).
    pub church_id: String,
    pub church_name: String,
    /// UUIDv4 identifier for this specific branch.
    pub branch_id: String,
    pub branch_name: String,
    pub role: BranchRole,
    /// 16-char alphanumeric invite code, present only for HQ branches.
    pub invite_code: Option<String>,
}

impl ChurchIdentity {
    /// Load from `~/.openworship/identity.json`. Returns `None` if the file is
    /// absent (first-launch → onboarding) or `Err` on I/O / parse errors.
    pub fn load() -> Result<Option<Self>> {
        let path = identity_path()?;
        if !path.exists() {
            return Ok(None);
        }
        let bytes = std::fs::read(&path)?;
        Ok(Some(serde_json::from_slice(&bytes)?))
    }

    /// Persist to `~/.openworship/identity.json`.
    pub fn save(&self) -> Result<()> {
        let path = identity_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_vec_pretty(self)?;
        std::fs::write(&path, json)?;
        Ok(())
    }
}

/// Generate a 16-char uppercase alphanumeric invite code from a church UUID.
///
/// Takes the first 16 hex chars of the UUID (stripping hyphens) and uppercases
/// them. Deterministic: same church_id always produces the same code.
/// 16 hex chars = 64 bits of entropy (vs. 32 bits with the old 8-char code).
pub fn derive_invite_code(church_id: &str) -> String {
    church_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(16)
        .collect::<String>()
        .to_uppercase()
}

fn identity_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Ok(PathBuf::from(home)
        .join(".openworship")
        .join("identity.json"))
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

/// Return the current church identity, or `null` if none is stored.
#[tauri::command]
pub fn get_identity(
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<Option<ChurchIdentity>, String> {
    state
        .identity
        .read()
        .map(|id| id.clone())
        .map_err(|e| e.to_string())
}

/// Create a new church with this device as the HQ branch.
#[tauri::command]
pub fn create_church(
    church_name: String,
    branch_name: String,
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<ChurchIdentity, String> {
    let church_id = uuid_v4();
    let branch_id = uuid_v4();
    let invite_code = derive_invite_code(&church_id);

    let identity = ChurchIdentity {
        church_id,
        church_name,
        branch_id,
        branch_name,
        role: BranchRole::Hq,
        invite_code: Some(invite_code),
    };

    identity.save().map_err(|e| e.to_string())?;

    let mut id = state.identity.write().map_err(|e| e.to_string())?;
    *id = Some(identity.clone());
    Ok(identity)
}

/// Join an existing church using an invite code, creating a member branch.
#[tauri::command]
pub fn join_church(
    invite_code: String,
    branch_name: String,
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<ChurchIdentity, String> {
    let code = invite_code.trim().to_uppercase();
    // Validate code format: 16 alphanumeric characters
    if code.len() != 16 || !code.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("Invalid invite code format".into());
    }

    // Derive the church_id from the invite code: the code IS the first 8 chars
    // of the church UUID (without hyphens, uppercase). We store it lowercase
    // as a stable key.
    let church_id = code.to_lowercase();
    let branch_id = uuid_v4();

    let identity = ChurchIdentity {
        church_id,
        church_name: String::new(), // will be populated when synced; fine for MVP
        branch_id,
        branch_name,
        role: BranchRole::Member,
        invite_code: None,
    };

    identity.save().map_err(|e| e.to_string())?;

    let mut id = state.identity.write().map_err(|e| e.to_string())?;
    *id = Some(identity.clone());
    Ok(identity)
}

/// Regenerate the invite code for an HQ branch (same church_id, same code in
/// this deterministic scheme — exposed here for future extensibility).
#[tauri::command]
pub fn generate_invite_code(
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<String, String> {
    let id = state.identity.read().map_err(|e| e.to_string())?;
    match id.as_ref() {
        Some(identity) if identity.role == BranchRole::Hq => {
            Ok(derive_invite_code(&identity.church_id))
        }
        Some(_) => Err("Only HQ branches can generate invite codes.".into()),
        None => Err("No church identity configured.".into()),
    }
}

// ─── UUID helper ─────────────────────────────────────────────────────────────

/// Generate a UUIDv4 using the OS random source.
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    // Simple UUID v4 without external deps: mix timestamp nanos + process id
    // into 128 bits of pseudo-random data following the RFC 4122 layout.
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    let pid = std::process::id();

    // Pull 16 bytes from /dev/urandom (available on macOS/Linux).
    let mut bytes = [0u8; 16];
    if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
        use std::io::Read;
        let _ = f.read_exact(&mut bytes);
    } else {
        // Fallback: xor in timestamp / pid bytes deterministically.
        let t_bytes = t.to_le_bytes();
        let p_bytes = pid.to_le_bytes();
        for (i, b) in bytes.iter_mut().enumerate() {
            *b = t_bytes[i % 4] ^ p_bytes[i % 4] ^ (i as u8).wrapping_mul(37);
        }
    }

    // Set version (4) and variant bits per RFC 4122.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        bytes[6], bytes[7],
        bytes[8], bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15],
    )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invite_code_is_16_chars_uppercase() {
        let church_id = "3f8a1b2c-dead-beef-cafe-123456789abc";
        let code = derive_invite_code(church_id);
        assert_eq!(code.len(), 16);
        assert!(code.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()));
    }

    #[test]
    fn invite_code_is_deterministic() {
        let church_id = "3f8a1b2c-dead-beef-cafe-123456789abc";
        assert_eq!(derive_invite_code(church_id), derive_invite_code(church_id));
    }

    #[test]
    fn uuid_v4_format() {
        let id = uuid_v4();
        let parts: Vec<&str> = id.split('-').collect();
        assert_eq!(parts.len(), 5);
        assert_eq!(parts[0].len(), 8);
        assert_eq!(parts[1].len(), 4);
        assert_eq!(parts[2].len(), 4);
        assert_eq!(parts[3].len(), 4);
        assert_eq!(parts[4].len(), 12);
        // version nibble = 4
        assert!(parts[2].starts_with('4'));
    }

    #[test]
    fn church_identity_round_trips_json() {
        let id = ChurchIdentity {
            church_id: "abc12345-0000-4000-8000-000000000001".into(),
            church_name: "Grace Church".into(),
            branch_id: "abc12345-0000-4000-8000-000000000002".into(),
            branch_name: "Main Campus".into(),
            role: BranchRole::Hq,
            invite_code: Some("ABC1234500004000".into()),
        };
        let json = serde_json::to_string(&id).unwrap();
        let back: ChurchIdentity = serde_json::from_str(&json).unwrap();
        assert_eq!(back.church_name, "Grace Church");
        assert_eq!(back.role, BranchRole::Hq);
        assert_eq!(back.invite_code, Some("ABC1234500004000".into()));
    }

    #[test]
    fn invite_code_is_16_char_alphanumeric() {
        let code = derive_invite_code("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        assert_eq!(code.len(), 16);
        assert!(
            code.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()),
            "code should be uppercase alphanumeric, got: {code}"
        );
    }

    #[test]
    fn invite_code_deterministic_same_input_same_output() {
        let church_id = "aaaabbbb-cccc-dddd-eeee-ffffffffffff";
        let code1 = derive_invite_code(church_id);
        let code2 = derive_invite_code(church_id);
        let code3 = derive_invite_code(church_id);
        assert_eq!(code1, code2);
        assert_eq!(code2, code3);
    }

    #[test]
    fn different_church_ids_produce_different_codes() {
        let code_a = derive_invite_code("11111111-2222-3333-4444-555555555555");
        let code_b = derive_invite_code("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        assert_ne!(code_a, code_b);
    }

    #[test]
    fn uuid_v4_produces_valid_format() {
        let id = uuid_v4();
        // UUID format: 8-4-4-4-12
        assert_eq!(id.len(), 36);
        let parts: Vec<&str> = id.split('-').collect();
        assert_eq!(parts.len(), 5);
        assert_eq!(parts[0].len(), 8);
        assert_eq!(parts[1].len(), 4);
        assert_eq!(parts[2].len(), 4);
        assert_eq!(parts[3].len(), 4);
        assert_eq!(parts[4].len(), 12);
        // All chars are hex digits or hyphens
        assert!(id.chars().all(|c| c.is_ascii_hexdigit() || c == '-'));
        // Version nibble = 4
        assert!(parts[2].starts_with('4'));
        // Variant bits: first char of parts[3] must be 8, 9, a, or b
        let variant_char = parts[3].chars().next().unwrap();
        assert!(
            "89ab".contains(variant_char),
            "variant nibble should be 8/9/a/b, got: {variant_char}"
        );
    }

    #[test]
    fn uuid_v4_generates_unique_ids() {
        let a = uuid_v4();
        let b = uuid_v4();
        assert_ne!(a, b);
    }
}
