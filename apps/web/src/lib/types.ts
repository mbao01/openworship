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

/** Matches Rust `DetectionMode` enum. */
export type DetectionMode = "auto" | "copilot" | "airplane" | "offline";

/** Matches Rust `QueueStatus` enum. */
export type QueueStatus = "pending" | "live" | "dismissed";

/** Matches Rust `QueueItem` struct. */
export interface QueueItem {
  id: string;
  reference: string;
  text: string;
  translation: string;
  status: QueueStatus;
  detected_at_ms: number;
}
