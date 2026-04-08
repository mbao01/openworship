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

/** Matches Rust `SttBackend` enum. */
export type SttBackend = "offline" | "online";

/** Matches Rust `AudioSettings` struct. */
export interface AudioSettings {
  backend: SttBackend;
  deepgram_api_key: string;
}

/** Matches Rust `BranchRole` enum. */
export type BranchRole = "hq" | "member";

/** Matches Rust `ChurchIdentity` struct. */
export interface ChurchIdentity {
  church_id: string;
  church_name: string;
  branch_id: string;
  branch_name: string;
  role: BranchRole;
  invite_code: string | null;
}


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
