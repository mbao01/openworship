/**
 * @module commands/share
 *
 * Tauri command wrappers for multi-branch church sync and sharing.
 * Branch sync keeps member branches up-to-date with HQ content changes.
 */

import { invoke } from "../tauri";
import type { BranchSyncStatus } from "../types";

/**
 * Returns the sync status between this branch and its HQ.
 * Includes timestamps of last push/pull and any current errors.
 */
export async function getBranchSyncStatus(): Promise<BranchSyncStatus> {
  return invoke<BranchSyncStatus>("get_branch_sync_status");
}
