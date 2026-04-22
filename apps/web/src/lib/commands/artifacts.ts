/**
 * @module commands/artifacts
 *
 * Tauri command wrappers for the artifacts (file management) system.
 * Artifacts are files (images, videos, documents, etc.) organized into
 * service-scoped directories within the configured base path.
 */

import { invoke } from "../tauri";
import type { ArtifactEntry, StorageUsage } from "../types";

// ─── Listing ──────────────────────────────────────────────────────────────────

/**
 * Returns all artifacts, optionally filtered by service ID and/or parent path.
 */
export async function listArtifacts(
  serviceId?: string,
  parentPath?: string,
): Promise<ArtifactEntry[]> {
  return invoke<ArtifactEntry[]>("list_artifacts", { serviceId, parentPath });
}

/**
 * Returns the most recently accessed artifacts across all services.
 * @param limit Max results (default 20).
 */
export async function listRecentArtifacts(
  limit?: number,
): Promise<ArtifactEntry[]> {
  return invoke<ArtifactEntry[]>("list_recent_artifacts", { limit });
}

/**
 * Returns all starred (bookmarked) artifacts.
 */
export async function listStarredArtifacts(): Promise<ArtifactEntry[]> {
  return invoke<ArtifactEntry[]>("list_starred_artifacts");
}

/**
 * Full-text searches artifacts by name or metadata.
 */
export async function searchArtifacts(
  query: string,
  serviceId?: string,
  category?: string,
): Promise<ArtifactEntry[]> {
  return invoke<ArtifactEntry[]>("search_artifacts", {
    query,
    serviceId,
    category,
  });
}

// ─── Creation & Import ────────────────────────────────────────────────────────

/**
 * Creates a new directory within the artifacts hierarchy.
 */
export async function createArtifactDir(
  serviceId: string,
  parentPath: string,
  name: string,
): Promise<ArtifactEntry> {
  return invoke<ArtifactEntry>("create_artifact_dir", {
    serviceId,
    parentPath,
    name,
  });
}

/**
 * Imports an existing file from the filesystem into the artifacts store.
 */
export async function importArtifactFile(
  sourcePath: string,
  serviceId?: string | null,
  parentPath?: string | null,
): Promise<ArtifactEntry> {
  return invoke<ArtifactEntry>("import_artifact_file", {
    serviceId,
    parentPath,
    sourcePath,
  });
}

/**
 * Writes raw bytes to an artifact, creating or overwriting the file.
 * Used for drag-and-drop uploads.
 */
export async function writeArtifactBytes(
  id: string,
  bytes: number[],
): Promise<void> {
  return invoke("write_artifact_bytes", { id, bytes });
}

/**
 * Reads the text content of a file from the local filesystem.
 * Used for text-file preview and editing.
 */
export async function readTextFile(filePath: string): Promise<string> {
  return invoke<string>("read_text_file", { filePath });
}

// ─── Modification ─────────────────────────────────────────────────────────────

/**
 * Renames an artifact file or directory.
 */
export async function renameArtifact(
  id: string,
  newName: string,
): Promise<void> {
  return invoke("rename_artifact", { id, newName });
}

/**
 * Permanently deletes an artifact or directory (recursive for directories).
 */
export async function deleteArtifact(id: string): Promise<void> {
  return invoke("delete_artifact", { id });
}

/**
 * Moves an artifact to a new parent directory path.
 */
export async function moveArtifact(
  id: string,
  newParentPath: string,
): Promise<void> {
  return invoke("move_artifact", { id, newParentPath });
}

/**
 * Toggles the starred (bookmarked) state of an artifact.
 */
export async function starArtifact(
  id: string,
  starred: boolean,
): Promise<void> {
  return invoke("star_artifact", { id, starred });
}

/**
 * Opens an artifact with the OS default application for its MIME type.
 */
export async function openArtifact(id: string): Promise<void> {
  return invoke("open_artifact", { id });
}

// ─── Thumbnails ──────────────────────────────────────────────────────────────

/**
 * Reads thumbnail bytes for an artifact by ID.
 */
export async function readThumbnail(id: string): Promise<number[]> {
  return invoke<number[]>("read_thumbnail", { id });
}

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Returns aggregate storage usage across local and cloud artifacts.
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  return invoke<StorageUsage>("get_storage_usage");
}
