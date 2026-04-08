/** Matches the Rust `TranscriptEvent` struct emitted via `stt://transcript`. */
export interface TranscriptEvent {
  text: string;
  offset_ms: number;
  duration_ms: number;
  mic_active: boolean;
}

/** A single scripture item within a service project. */
export interface ProjectItem {
  id: string;
  reference: string;
  text: string;
  translation: string;
  position: number;
  added_at_ms: number;
}

/** A named container for the ordered content of a single worship service. */
export interface ServiceProject {
  id: string;
  name: string;
  created_at_ms: number;
  /** null while the service is active; set when the operator ends the service. */
  closed_at_ms: number | null;
  items: ProjectItem[];
}

/** An entry in the global content bank (auto-populated on push_to_display). */
export interface ContentBankEntry {
  id: string;
  reference: string;
  text: string;
  translation: string;
  last_used_ms: number;
  use_count: number;
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
