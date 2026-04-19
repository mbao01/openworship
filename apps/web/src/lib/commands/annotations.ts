/**
 * @module commands/annotations
 *
 * Tauri command wrappers for non-scripture display content:
 * announcements, custom slides, sermon notes, and countdowns.
 */

import { invoke } from "../tauri";
import type { AnnouncementItem, SermonNote } from "../types";

// ─── Announcements & Custom Slides ────────────────────────────────────────────

/**
 * Returns all stored announcements and custom slides.
 */
export async function listAnnouncements(): Promise<AnnouncementItem[]> {
  return invoke<AnnouncementItem[]>("list_announcements");
}

/**
 * Creates a new announcement or custom slide.
 *
 * @param title      Display title
 * @param body       Body text (for announcements)
 * @param imageUrl   Optional background image URL
 * @param keywordCue Optional keyword that auto-triggers display detection
 */
export async function createAnnouncement(
  title: string,
  body: string,
  imageUrl?: string | null,
  keywordCue?: string | null,
): Promise<AnnouncementItem> {
  return invoke<AnnouncementItem>("create_announcement", {
    title,
    body,
    imageUrl,
    keywordCue,
  });
}

/**
 * Updates an existing announcement's content.
 */
export async function updateAnnouncement(
  id: string,
  title: string,
  body: string,
  imageUrl?: string | null,
): Promise<void> {
  return invoke("update_announcement", { id, title, body, imageUrl });
}

/**
 * Permanently deletes an announcement.
 */
export async function deleteAnnouncement(id: string): Promise<void> {
  return invoke("delete_announcement", { id });
}

/**
 * Pushes an announcement to the live display immediately.
 */
export async function pushAnnouncementToDisplay(id: string): Promise<void> {
  return invoke("push_announcement_to_display", { id });
}

/**
 * Pushes an ad-hoc custom slide (title + body + optional image) to the display.
 */
export async function pushCustomSlide(title: string, body?: string, imageUrl?: string): Promise<void> {
  return invoke("push_custom_slide", { title, body: body ?? "", imageUrl });
}

/**
 * Starts a fullscreen countdown timer on the display.
 * @param durationSecs Duration in seconds.
 */
export async function startCountdown(durationSecs: number): Promise<void> {
  return invoke("start_countdown", { durationSecs });
}

// ─── Sermon Notes ─────────────────────────────────────────────────────────────

/**
 * Returns all stored sermon note decks.
 */
export async function listSermonNotes(): Promise<SermonNote[]> {
  return invoke<SermonNote[]>("list_sermon_notes");
}

/**
 * Creates a new sermon note deck with the given title and ordered slides.
 */
export async function createSermonNote(
  title: string,
  slides: string[],
): Promise<SermonNote> {
  return invoke<SermonNote>("create_sermon_note", { title, slides });
}

/**
 * Updates an existing sermon note's title and slide content.
 */
export async function updateSermonNote(
  id: string,
  title: string,
  slides: string[],
): Promise<void> {
  return invoke("update_sermon_note", { id, title, slides });
}

/**
 * Permanently deletes a sermon note deck.
 */
export async function deleteSermonNote(id: string): Promise<void> {
  return invoke("delete_sermon_note", { id });
}

/**
 * Pushes a sermon note deck to the display, starting from the first slide.
 */
export async function pushSermonNote(id: string): Promise<void> {
  return invoke("push_sermon_note", { id });
}

/**
 * Advances to the next slide in the currently displayed sermon note.
 */
export async function advanceSermonNote(): Promise<void> {
  return invoke("advance_sermon_note");
}

/**
 * Returns to the previous slide in the currently displayed sermon note.
 */
export async function rewindSermonNote(): Promise<void> {
  return invoke("rewind_sermon_note");
}

/**
 * Returns the currently active sermon note, or null if none is displayed.
 */
export async function getActiveSermonNote(): Promise<SermonNote | null> {
  return invoke<SermonNote | null>("get_active_sermon_note");
}
