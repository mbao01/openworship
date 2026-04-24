/**
 * @module commands/settings
 *
 * Tauri command wrappers for application settings persistence.
 * All settings are stored in the Rust backend (~/.openworship/) with
 * secure keychain storage for sensitive credentials.
 */

import { invoke } from "../tauri";
import { invokeValidated } from "../validated-invoke";
import {
  AudioSettingsSchema,
  ArtifactsSettingsSchema,
  DisplaySettingsSchema,
  EmailSettingsSchema,
  S3ConfigSchema,
} from "../schemas";
import type {
  AudioSettings,
  ArtifactsSettings,
  DisplaySettings,
  EmailSettings,
  S3Config,
} from "../types";

// ─── Audio / STT Settings ─────────────────────────────────────────────────────

/**
 * Loads persisted audio and STT settings from the Rust backend.
 * Called on app init and whenever the settings panel is opened.
 */
export async function getAudioSettings(): Promise<AudioSettings> {
  return invokeValidated("get_audio_settings", AudioSettingsSchema);
}

/**
 * Persists the full audio settings struct to disk.
 * Sensitive fields (e.g. Deepgram API key) are stored in the OS keychain via setProviderSecret.
 */
export async function setAudioSettings(settings: AudioSettings): Promise<void> {
  return invoke("set_audio_settings", { settings });
}

// ─── Display Settings ─────────────────────────────────────────────────────────

/**
 * Loads the display output settings (monitor selection, multi-output flag).
 */
export async function getDisplaySettings(): Promise<DisplaySettings> {
  return invokeValidated("get_display_settings", DisplaySettingsSchema);
}

/**
 * Persists display settings to disk.
 */
export async function setDisplaySettings(
  settings: DisplaySettings,
): Promise<void> {
  return invoke("set_display_settings", { settings });
}

// ─── Email / SMTP Settings ────────────────────────────────────────────────────

/**
 * Loads SMTP configuration. The smtp_password field is write-only;
 * it is never returned from the backend (always empty string).
 */
export async function getEmailSettings(): Promise<EmailSettings> {
  return invokeValidated("get_email_settings", EmailSettingsSchema);
}

/**
 * Persists SMTP settings. Pass a non-empty smtp_password to update
 * the keychain entry; pass an empty string to leave it unchanged.
 */
export async function setEmailSettings(settings: EmailSettings): Promise<void> {
  return invoke("set_email_settings", { settings });
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

/**
 * Stores the Anthropic API key in the OS keychain.
 * Used to enable AI-generated service summaries.
 */
export async function setAnthropicApiKey(key: string): Promise<void> {
  return invoke("set_anthropic_api_key", { key });
}

/**
 * Returns true if an Anthropic API key is present in the keychain.
 * Does NOT return the key value — check status only.
 */
export async function getAnthropicApiKeyStatus(): Promise<boolean> {
  return invoke<boolean>("get_anthropic_api_key_status");
}

// ─── Cloud / S3 Config ────────────────────────────────────────────────────────

/**
 * Loads the S3-compatible cloud sync configuration.
 * secret_access_key is write-only; always returned as empty string.
 */
export async function getCloudConfig(): Promise<S3Config> {
  return invokeValidated("get_cloud_config", S3ConfigSchema);
}

/**
 * Persists S3 cloud sync configuration. Pass a non-empty secret_access_key
 * to update the keychain entry; empty string means "no change".
 */
export async function setCloudConfig(config: S3Config): Promise<void> {
  return invoke("set_cloud_config", { config });
}

// ─── Artifacts / File Storage ─────────────────────────────────────────────────

/**
 * Loads the artifacts storage configuration (base path).
 */
export async function getArtifactsSettings(): Promise<ArtifactsSettings> {
  return invokeValidated("get_artifacts_settings", ArtifactsSettingsSchema);
}

/**
 * Sets the base directory path where artifacts (files) are stored locally.
 */
export async function setArtifactsBasePath(path: string): Promise<void> {
  return invoke("set_artifacts_base_path", { path });
}
