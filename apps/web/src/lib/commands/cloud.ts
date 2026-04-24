/**
 * @module commands/cloud
 *
 * Tauri command wrappers for cloud sync (S3-compatible) and
 * multi-branch artifact sharing via ACL.
 */

import { z } from "zod";
import { invoke } from "../tauri";
import { invokeValidated } from "../validated-invoke";
import {
  AclEntrySchema,
  ArtifactEntrySchema,
  CloudSyncInfoSchema,
} from "../schemas";
import type { AclEntry, ArtifactEntry, CloudSyncInfo } from "../types";

// ─── Sync State ───────────────────────────────────────────────────────────────

/**
 * Returns the cloud sync metadata for a specific artifact.
 * Includes sync status, last sync time, and any sync errors.
 */
export async function getCloudSyncInfo(
  artifactId: string,
): Promise<CloudSyncInfo | null> {
  return invokeValidated(
    "get_cloud_sync_info",
    CloudSyncInfoSchema.nullable(),
    { artifactId },
  );
}

/**
 * Enables or disables cloud sync for an artifact.
 */
export async function toggleArtifactCloudSync(
  artifactId: string,
  enabled: boolean,
): Promise<void> {
  return invoke("toggle_artifact_cloud_sync", { artifactId, enabled });
}

/**
 * Triggers an immediate sync for a single artifact.
 * Runs asynchronously; listen for sync status events.
 */
export async function syncArtifactNow(artifactId: string): Promise<void> {
  return invoke("sync_artifact_now", { artifactId });
}

/**
 * Downloads an artifact from cloud storage to the local filesystem.
 * Returns the updated sync info on success.
 */
export async function downloadArtifactFromCloud(
  artifactId: string,
): Promise<CloudSyncInfo> {
  return invokeValidated("download_artifact_from_cloud", CloudSyncInfoSchema, {
    artifactId,
  });
}

/**
 * Triggers a sync pass for all cloud-enabled artifacts.
 * Runs asynchronously; listen for sync status events.
 */
export async function syncAllArtifacts(): Promise<void> {
  return invoke("sync_all_artifacts");
}

// ─── Cloud Listing ────────────────────────────────────────────────────────────

/**
 * Lists artifacts that exist in the cloud (S3 bucket).
 * May include items not yet downloaded locally.
 */
export async function listCloudArtifacts(): Promise<ArtifactEntry[]> {
  return invokeValidated(
    "list_cloud_artifacts",
    z.array(ArtifactEntrySchema),
  );
}

// ─── Access Control ───────────────────────────────────────────────────────────

/**
 * Returns the ACL (per-branch permission list) for an artifact.
 */
export async function getArtifactAcl(artifactId: string): Promise<AclEntry[]> {
  return invokeValidated("get_artifact_acl", z.array(AclEntrySchema), {
    artifactId,
  });
}

/**
 * Sets the branch-level permissions for an artifact.
 *
 * @param artifactId  Target artifact
 * @param acl         Per-branch permission entries
 * @param accessLevel Top-level access policy: "restricted" | "branch_only" | "all_branches"
 */
export async function setArtifactAcl(
  artifactId: string,
  acl: AclEntry[],
  accessLevel: string,
): Promise<void> {
  return invoke("set_artifact_acl", { artifactId, acl, accessLevel });
}

/**
 * Copies a shareable link for an artifact to the clipboard.
 * Returns the generated link URL.
 */
export async function copyArtifactLink(artifactId: string): Promise<string> {
  return invoke<string>("copy_artifact_link", { artifactId });
}
