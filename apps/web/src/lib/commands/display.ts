/**
 * @module commands/display
 *
 * Tauri command wrappers for display background management.
 */

import { invoke } from "../tauri";

export interface BackgroundInfo {
  id: string;
  name: string;
  /** "preset" | "uploaded" */
  source: string;
  /** CSS gradient string or "artifact:{id}" reference */
  value: string;
  /** "gradient" | "image" | "video" */
  bg_type: string;
}

/** Set the display background. Pass null to clear. */
export async function setDisplayBackground(
  backgroundId: string | null,
): Promise<void> {
  return invoke("set_display_background", {
    backgroundId: backgroundId ?? null,
  });
}

/** Get the current display background ID. */
export async function getDisplayBackground(): Promise<string | null> {
  return invoke<string | null>("get_display_background");
}

/** List preset backgrounds (CSS gradients). */
export async function listPresetBackgrounds(): Promise<BackgroundInfo[]> {
  return invoke<BackgroundInfo[]>("list_preset_backgrounds");
}

/** List uploaded custom backgrounds. */
export async function listUploadedBackgrounds(): Promise<BackgroundInfo[]> {
  return invoke<BackgroundInfo[]>("list_uploaded_backgrounds");
}

/** Upload a background image/video. */
export async function uploadBackground(
  name: string,
  bytes: number[],
): Promise<BackgroundInfo> {
  return invoke<BackgroundInfo>("upload_background", { name, bytes });
}
