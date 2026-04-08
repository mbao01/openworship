/** Matches the Rust `TranscriptEvent` struct emitted via `stt://transcript`. */
export interface TranscriptEvent {
  text: string;
  offset_ms: number;
  duration_ms: number;
  mic_active: boolean;
}

export interface ContentItem {
  id: string;
  kind: "scripture" | "lyrics" | "announcement";
  body: string;
}

export interface ServiceProject {
  id: string;
  title: string;
  items: ContentItem[];
}

export interface VerseResult {
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  reference: string;
}

export interface TranslationInfo {
  id: string;
  name: string;
  abbreviation: string;
}

/** Matches Rust `OperatingMode` enum. */
export type OperatingMode = "auto" | "copilot" | "airplane" | "offline";

/** Matches Rust `VerseStatus` enum. */
export type VerseStatus = "pending" | "approved" | "dismissed";

/** Matches Rust `ScriptureRef`. */
export interface ScriptureRef {
  book: string;
  chapter: number;
  verse: number | null;
}

/** Matches Rust `QueuedVerse`. */
export interface QueuedVerse {
  id: number;
  reference: ScriptureRef;
  text: string;
  translation: string;
  status: VerseStatus;
}
