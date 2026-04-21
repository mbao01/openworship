/**
 * @module commands/detection
 *
 * Tauri command wrappers for the detection engine and live content queue.
 *
 * Detection modes:
 *   - "auto"      — engine approves and pushes high-confidence matches automatically
 *   - "copilot"   — engine queues candidates; operator manually approves
 *   - "airplane"  — detection disabled; operator pushes content manually
 *   - "offline"   — full offline mode; no STT or semantic matching
 */

import { invoke } from "../tauri";
import type { DetectionMode, QueueItem, SemanticStatus } from "../types";

// ─── Detection Mode ───────────────────────────────────────────────────────────

/**
 * Returns the current detection mode.
 */
export async function getDetectionMode(): Promise<DetectionMode> {
  return invoke<DetectionMode>("get_detection_mode");
}

/**
 * Sets the detection mode and persists it for the next session.
 */
export async function setDetectionMode(mode: DetectionMode): Promise<void> {
  return invoke("set_detection_mode", { mode });
}

// ─── Queue Management ─────────────────────────────────────────────────────────

/**
 * Returns the current state of the detection queue.
 * Listen to the `detection://queue-updated` event for real-time updates.
 */
export async function getQueue(): Promise<QueueItem[]> {
  return invoke<QueueItem[]>("get_queue");
}

/**
 * Approves a queued item, pushing it to the live display.
 */
export async function approveItem(itemId: string): Promise<void> {
  return invoke("approve_item", { id: itemId });
}

/**
 * Dismisses a queued item without displaying it.
 */
export async function dismissItem(id: string): Promise<void> {
  return invoke("dismiss_item", { id });
}

/**
 * Skips a queued item (marks as dismissed from the operator view).
 */
export async function skipItem(itemId: string): Promise<void> {
  return invoke("skip_item", { itemId });
}

/**
 * Removes the currently live item from the display without replacing it.
 */
export async function rejectLiveItem(): Promise<void> {
  return invoke("reject_live_item");
}

/**
 * Advances to the next item in the queue (if one exists).
 */
export async function nextItem(): Promise<void> {
  return invoke("next_item");
}

/**
 * Returns to the previous item in the display history.
 */
export async function prevItem(): Promise<void> {
  return invoke("prev_item");
}

/**
 * Clears the live display, leaving nothing shown on screen.
 */
export async function clearLive(): Promise<void> {
  return invoke("clear_live");
}

/**
 * Clears all pending items from the detection queue.
 */
export async function clearQueue(): Promise<void> {
  return invoke("clear_queue");
}

/**
 * Runs the detection pipeline on an arbitrary transcript snippet.
 * Useful for manual testing or clipboard-paste detection.
 */
export async function detectInTranscript(text: string): Promise<QueueItem[]> {
  return invoke<QueueItem[]>("detect_in_transcript", { text });
}

// ─── Semantic Index ───────────────────────────────────────────────────────────

/**
 * Returns the current status of the semantic scripture similarity index.
 * `ready` indicates the index is built and available for matching.
 */
export async function getSemanticStatus(): Promise<SemanticStatus> {
  return invoke<SemanticStatus>("get_semantic_status");
}
