import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export interface DownloadProgress {
  downloaded: number; // bytes received (usize on Rust side)
  total?: number;     // total bytes if Content-Length was sent
}

/** Check for an available update. Returns `null` when the app is up to date. */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  return invoke<UpdateInfo | null>("check_for_updates");
}

/** Download and install the available update. Emits progress events while running. */
export async function installUpdate(): Promise<void> {
  return invoke<void>("install_update");
}

/** Restart the app to apply the installed update. */
export function restartApp(): void {
  invoke("restart_app").catch(console.error);
}

/** Subscribe to the silent background update check result emitted on startup. */
export function onUpdateAvailable(
  cb: (info: UpdateInfo) => void
): Promise<() => void> {
  return listen<UpdateInfo>("updater://update-available", (e) => cb(e.payload));
}

/** Subscribe to download progress events during `installUpdate`. */
export function onDownloadProgress(
  cb: (progress: DownloadProgress) => void
): Promise<() => void> {
  return listen<DownloadProgress>("updater://download-progress", (e) =>
    cb(e.payload)
  );
}

/** Subscribe to the event emitted once the update has been fully installed. */
export function onInstallComplete(cb: () => void): Promise<() => void> {
  return listen("updater://install-complete", () => cb());
}
