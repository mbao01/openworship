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
 */
export async function checkWhisperModel(model?: string): Promise<boolean> {
  return invoke<boolean>("check_whisper_model", { model: model ?? null });
}

/**
 * Initiates a background download of a Whisper model.
 * @param model - Model filename (e.g. "ggml-small.en.bin"). Defaults to base.en.
 * Emits `stt://model-download-progress` events during download and
 * `stt://model-download-complete` on completion.
 */
export async function downloadWhisperModel(model?: string): Promise<void> {
  return invoke("download_whisper_model", { model: model ?? null });
}
