/**
 * @module commands/backup
 *
 * Tauri command wrappers for local backup and restore.
 * The backup archive (.openworship-backup) is a gzip-compressed tar that
 * contains all church data: JSON settings files, SQLite databases, and the
 * artifacts directory.  Sensitive keychain entries are NOT included.
 */

import { invoke } from "../tauri";

export interface BackupInfo {
  /** Absolute path where the backup file was written. */
  path: string;
  /** Archive size in bytes. */
  size_bytes: number;
  /** Unix timestamp (ms) when the backup was created. */
  created_at_ms: number;
}

/**
 * Create a backup archive and write it to `destPath`.
 */
export async function createBackup(destPath: string): Promise<BackupInfo> {
  return invoke<BackupInfo>("create_backup", { destPath });
}

/**
 * Restore data from a backup archive at `srcPath`.
 * The app should be restarted after a successful restore.
 */
export async function restoreBackup(srcPath: string): Promise<void> {
  return invoke("restore_backup", { srcPath });
}
