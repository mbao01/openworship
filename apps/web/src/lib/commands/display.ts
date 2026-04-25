/**
 * @module commands/display
 *
 * Tauri command wrappers for display background management.
 */

import { z } from "zod";
import { invoke } from "../tauri";
import { invokeValidated } from "../validated-invoke";
import { BackgroundInfoSchema } from "../schemas";

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
  return invokeValidated("get_display_background", z.string().nullable());
}

/** List preset backgrounds (CSS gradients). */
export async function listPresetBackgrounds(): Promise<BackgroundInfo[]> {
  return invokeValidated(
    "list_preset_backgrounds",
    z.array(BackgroundInfoSchema),
  );
}

/** List uploaded custom backgrounds. */
export async function listUploadedBackgrounds(): Promise<BackgroundInfo[]> {
  return invokeValidated(
    "list_uploaded_backgrounds",
    z.array(BackgroundInfoSchema),
  );
}

/** Upload a background image/video. */
export async function uploadBackground(
  name: string,
  bytes: number[],
): Promise<BackgroundInfo> {
  return invokeValidated("upload_background", BackgroundInfoSchema, {
    name,
    bytes,
  });
}
