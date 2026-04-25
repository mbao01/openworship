/**
 * @module commands/display-window
 *
 * Tauri command wrappers for the secondary display (projection) window.
 * The display window is a separate Tauri window that renders the audience-
 * facing output. It can be targeted to a specific monitor.
 */

import { z } from "zod";
import { invoke } from "../tauri";
import { invokeValidated } from "../validated-invoke";
import { MonitorInfoSchema } from "../schemas";
import type { MonitorInfo } from "../types";

/**
 * Returns all monitors currently detected by the OS.
 * Used to populate the monitor picker in Display settings.
 */
export async function listMonitors(): Promise<MonitorInfo[]> {
  return invokeValidated("list_monitors", z.array(MonitorInfoSchema));
}

/**
 * Opens the display output window on the specified monitor.
 * Pass null to use the saved monitor preference.
 */
export async function openDisplayWindow(
  monitorIndex: number | null,
): Promise<void> {
  return invoke("open_display_window", { monitor_index: monitorIndex });
}

/**
 * Closes the display output window.
 */
export async function closeDisplayWindow(): Promise<void> {
  return invoke("close_display_window");
}

/**
 * Returns true if the display output window is currently open.
 */
export async function getDisplayWindowOpen(): Promise<boolean> {
  return invokeValidated("get_display_window_open", z.boolean());
}

/**
 * Returns the local HTTP URL for the OBS virtual display feed.
 * Used when capturing OpenWorship output into OBS as a browser source.
 */
export async function getObsDisplayUrl(): Promise<string> {
  return invokeValidated("get_obs_display_url", z.string());
}
