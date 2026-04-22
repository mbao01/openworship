/**
 * @module commands/content
 *
 * Tauri command wrappers for scripture search, Bible translations,
 * and the reusable content bank.
 */

import { invoke } from "../tauri";
import type { ContentBankEntry, TranslationInfo, VerseResult } from "../types";

// ─── Scripture Search ─────────────────────────────────────────────────────────

/**
 * Searches scriptures by reference (e.g. "John 3:16") or keywords.
 * Results are ranked by relevance using BM25 + optional semantic scoring.
 *
 * @param query      Free-text query or scripture reference
 * @param translation Optional translation ID to restrict results (e.g. "KJV")
 */
export async function searchScriptures(
  query: string,
  translation?: string,
): Promise<VerseResult[]> {
  return invoke<VerseResult[]>("search_scriptures", { query, translation });
}

// ─── Scripture Metadata ──────────────────────────────────────────────────────

/**
 * Returns the distinct chapter numbers for a Bible book.
 */
export async function getBookChapters(book: string): Promise<number[]> {
  return invoke<number[]>("get_book_chapters", { book });
}

/**
 * Returns the distinct verse numbers for a Bible book and chapter.
 */
export async function getChapterVerses(
  book: string,
  chapter: number,
): Promise<number[]> {
  return invoke<number[]>("get_chapter_verses", { book, chapter });
}

// ─── Translations ─────────────────────────────────────────────────────────────

/**
 * Lists all installed Bible translations available on this device.
 */
export async function listTranslations(): Promise<TranslationInfo[]> {
  return invoke<TranslationInfo[]>("list_translations");
}

/**
 * Returns the currently active translation ID (e.g. "KJV").
 */
export async function getActiveTranslation(): Promise<string> {
  return invoke<string>("get_active_translation");
}

/**
 * Switches the active translation for the live display.
 * Takes effect immediately on the display window.
 */
export async function switchLiveTranslation(
  translation: string,
): Promise<void> {
  return invoke("switch_live_translation", { translation });
}

// ─── Display Push ─────────────────────────────────────────────────────────────

/**
 * Pushes a specific verse or content entry directly to the live display.
 * Also adds the item to the content bank for future recall.
 */
export async function pushToDisplay(
  reference: string,
  text: string,
  translation: string,
): Promise<void> {
  return invoke("push_to_display", { reference, text, translation });
}

// ─── Content Bank ─────────────────────────────────────────────────────────────

/**
 * Searches the content bank (recently used / curated scripture entries).
 * Returns entries ordered by recency and use count.
 */
export async function searchContentBank(
  query: string,
): Promise<ContentBankEntry[]> {
  return invoke<ContentBankEntry[]>("search_content_bank", { query });
}
