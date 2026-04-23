/**
 * @module commands/audio
 *
 * Tauri command wrappers for the audio capture and speech-to-text (STT) pipeline.
 * Supports Whisper.cpp (local) and Deepgram (cloud) backends.
 */

import { invoke } from "../tauri";
import type { AudioInputDevice } from "../types";

/** Current STT pipeline state. */
export type SttStatus = "running" | "stopped" | "error";

/**
 * Starts the STT capture pipeline using the currently configured backend.
 * Emits `stt://transcript` events as speech is recognized.
 */
export async function startStt(): Promise<void> {
  return invoke("start_stt");
}

/**
 * Stops the active STT capture pipeline.
 */
export async function stopStt(): Promise<void> {
  return invoke("stop_stt");
}

/**
 * Returns the current STT pipeline status (running, stopped, error).
 */
export async function getSttStatus(): Promise<SttStatus> {
  return invoke<SttStatus>("get_stt_status");
}

/**
 * Reads the current microphone audio level as a normalized RMS value [0–1].
 * Poll this at ~30fps to drive the VU meter visualization.
 */
export async function getAudioLevel(): Promise<number> {
  return invoke<number>("get_audio_level");
}

/**
 * Lists all audio input devices available on the system.
 * Used to populate the microphone selector in Audio settings.
 */
export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  return invoke<AudioInputDevice[]>("list_audio_input_devices");
}

/**
 * Starts a lightweight audio capture purely for VU meter / mic check.
 * Does NOT start transcription — just opens the mic and reads levels.
 */
export async function startAudioMonitor(): Promise<void> {
  return invoke("start_audio_monitor");
}

/**
 * Stops the audio monitor.
 */
export async function stopAudioMonitor(): Promise<void> {
  return invoke("stop_audio_monitor");
}

/**
 * Checks whether a Whisper model is downloaded and available.
 * @param model - Model filename (e.g. "ggml-small.en.bin"). If omitted, checks any usable model.
 * @deprecated Use checkProviderModel() instead.
 */
export async function checkWhisperModel(model?: string): Promise<boolean> {
  return invoke<boolean>("check_whisper_model", { model: model ?? null });
}

/**
 * Initiates a background download of a Whisper model.
 * @param model - Model filename (e.g. "ggml-small.en.bin"). Defaults to base.en.
 * @deprecated Use downloadProviderModel() instead.
 */
export async function downloadWhisperModel(model?: string): Promise<void> {
  return invoke("download_whisper_model", { model: model ?? null });
}

// ─── Generic STT Provider commands ──────────────────────────────────────────

import type { ProviderInfo, ProviderStatus, ModelInfo } from "../types";

/**
 * List all available STT providers with their metadata and config fields.
 */
export async function listSttProviders(): Promise<ProviderInfo[]> {
  return invoke<ProviderInfo[]>("list_stt_providers");
}

/**
 * Get the readiness status of a specific STT provider.
 */
export async function getProviderStatus(
  providerId: string,
): Promise<ProviderStatus> {
  return invoke<ProviderStatus>("get_provider_status", {
    providerId,
  });
}

/**
 * Check if a specific model is installed for a provider.
 */
export async function checkProviderModel(
  providerId: string,
  modelId: string,
): Promise<boolean> {
  return invoke<boolean>("check_provider_model", {
    providerId,
    modelId,
  });
}

/**
 * Get available models for a provider.
 */
export async function getProviderModels(
  providerId: string,
): Promise<ModelInfo[]> {
  return invoke<ModelInfo[]>("get_provider_models", {
    providerId,
  });
}

/**
 * Download a model for a provider. Emits `stt://model-download-progress` events.
 */
export async function downloadProviderModel(
  providerId: string,
  modelId: string,
): Promise<void> {
  return invoke("download_provider_model", {
    providerId,
    modelId,
  });
}

/**
 * Save a secret field for a provider to the OS keychain.
 */
export async function setProviderSecret(
  providerId: string,
  key: string,
  value: string,
): Promise<void> {
  return invoke("set_provider_secret", {
    providerId,
    key,
    value,
  });
}
