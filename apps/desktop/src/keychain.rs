//! OS-native keychain helpers for storing secrets outside of config files.
//!
//! Uses the [`keyring`] crate which maps to:
//! * macOS — Keychain
//! * Windows — Credential Manager
//! * Linux — libsecret / KWallet (falls back to an in-memory placeholder when
//!   neither is available, e.g. headless CI)

use keyring::Entry;

const SERVICE: &str = "openworship";
const DEEPGRAM_ACCOUNT: &str = "deepgram_api_key";

/// Retrieve the Deepgram API key from the OS keychain.
///
/// Returns `None` if the key has never been stored, or on any keychain error
/// (the caller treats missing as "not configured").
pub fn get_deepgram_api_key() -> Option<String> {
    let entry = Entry::new(SERVICE, DEEPGRAM_ACCOUNT)
        .map_err(|e| eprintln!("[keychain] entry creation failed: {e}"))
        .ok()?;
    match entry.get_password() {
        Ok(key) if !key.is_empty() => Some(key),
        Ok(_) => None,
        Err(keyring::Error::NoEntry) => None,
        Err(e) => {
            eprintln!("[keychain] get_deepgram_api_key failed: {e}");
            None
        }
    }
}

/// Store the Deepgram API key in the OS keychain.
///
/// Passing an empty string deletes any existing entry.
pub fn set_deepgram_api_key(key: &str) -> Result<(), keyring::Error> {
    let entry = Entry::new(SERVICE, DEEPGRAM_ACCOUNT)?;
    if key.is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e),
        }
    } else {
        entry.set_password(key)
    }
}

/// Delete the Deepgram API key from the OS keychain (idempotent).
#[allow(dead_code)]
pub fn delete_deepgram_api_key() -> Result<(), keyring::Error> {
    set_deepgram_api_key("")
}
