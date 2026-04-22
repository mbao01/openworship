/**
 * Global upload store — tracks in-progress file uploads.
 *
 * Module-level state that survives React component unmount/remount,
 * so navigating away and back still shows pending uploads.
 */

import { useSyncExternalStore } from "react";
import type { ArtifactEntry } from "@/lib/types";

export interface UploadEntry {
  /** Temporary ID (prefixed with "uploading-") */
  id: string;
  /** Original filename */
  name: string;
  /** Local blob URL for instant preview */
  previewUrl: string;
  /** File size in bytes */
  size: number;
  /** Upload status */
  status: "uploading" | "done" | "error";
  /** Error message if status is "error" */
  error?: string;
  /** The real ArtifactEntry once upload completes */
  realEntry?: ArtifactEntry;
  /** Target service ID (for folder placement) */
  serviceId?: string | null;
  /** Target parent path */
  parentPath?: string | null;
}

// ── Module-level state ──────────────────────────────────────────────────────

const uploads = new Map<string, UploadEntry>();
const listeners = new Set<() => void>();
let snapshot: UploadEntry[] = [];

function notify() {
  snapshot = Array.from(uploads.values());
  for (const listener of listeners) listener();
}

// ── Public API ──────────────────────────────────────────────────────────────

export function addUpload(entry: UploadEntry): void {
  uploads.set(entry.id, entry);
  notify();
}

export function updateUpload(
  id: string,
  patch: Partial<UploadEntry>,
): void {
  const existing = uploads.get(id);
  if (existing) {
    uploads.set(id, { ...existing, ...patch });
    notify();
  }
}

export function removeUpload(id: string): void {
  const entry = uploads.get(id);
  if (entry?.previewUrl) {
    URL.revokeObjectURL(entry.previewUrl);
  }
  uploads.delete(id);
  notify();
}

/** Remove all completed uploads (status "done") */
export function clearCompleted(): void {
  for (const [id, entry] of uploads) {
    if (entry.status === "done") {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      uploads.delete(id);
    }
  }
  notify();
}

export function getUploads(): UploadEntry[] {
  return snapshot;
}

/** React hook that subscribes to upload store changes. */
export function useUploads(): UploadEntry[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
  );
}
