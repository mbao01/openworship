/**
 * @module commands/songs
 *
 * Tauri command wrappers for the song / lyrics library.
 * Songs are stored in a local SQLite database with FTS5 full-text search.
 */

import { z } from "zod";
import { invoke } from "../tauri";
import { invokeValidated } from "../validated-invoke";
import { SongSchema, SongSemanticStatusSchema } from "../schemas";
import type { Song, SongSemanticStatus } from "../types";

// ─── Listing & Search ─────────────────────────────────────────────────────────

/**
 * Returns all songs in the library, ordered by title.
 */
export async function listSongs(): Promise<Song[]> {
  return invokeValidated("list_songs", z.array(SongSchema));
}

/**
 * Full-text searches the song library by title, artist, or lyrics content.
 */
export async function searchSongs(query: string): Promise<Song[]> {
  return invokeValidated("search_songs", z.array(SongSchema), { query });
}

/**
 * Fetches a single song by its database ID.
 * Returns null if the song does not exist.
 */
export async function getSong(id: number): Promise<Song | null> {
  return invokeValidated("get_song", SongSchema.nullable(), { id });
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Creates a new song in the library.
 */
export async function addSong(
  title: string,
  artist: string | null,
  lyrics: string,
): Promise<Song> {
  return invokeValidated("add_song", SongSchema, { title, artist, lyrics });
}

/**
 * Updates an existing song's title, artist, or lyrics.
 */
export async function updateSong(
  id: number,
  title: string,
  artist: string | null,
  lyrics: string,
): Promise<void> {
  return invoke("update_song", { id, title, artist, lyrics });
}

/**
 * Permanently deletes a song from the library.
 */
export async function deleteSong(id: number): Promise<void> {
  return invoke("delete_song", { id });
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Imports songs from CCLI SongSelect export text.
 * Returns the list of newly created song records.
 */
export async function importSongsCcli(text: string): Promise<Song[]> {
  return invokeValidated("import_songs_ccli", z.array(SongSchema), { text });
}

/**
 * Imports songs from an OpenLP XML export.
 * Returns the list of newly created song records.
 */
export async function importSongsOpenlp(xml: string): Promise<Song[]> {
  return invokeValidated("import_songs_openlp", z.array(SongSchema), { xml });
}

// ─── Display Push ─────────────────────────────────────────────────────────────

/**
 * Pushes a song from the library directly to the live display.
 */
export async function pushSongToDisplay(id: number): Promise<void> {
  return invoke("push_song_to_display", { id });
}

// ─── Semantic Index ───────────────────────────────────────────────────────────

/**
 * Returns the status of the song semantic similarity index.
 */
export async function getSongSemanticStatus(): Promise<SongSemanticStatus> {
  return invokeValidated("get_song_semantic_status", SongSemanticStatusSchema);
}
