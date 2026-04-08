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
  /** Normalized relevance score [0–1]. 1.0 for exact lookups; BM25-scaled for keyword search. */
  score: number;
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
  semantic_enabled: boolean;
  semantic_threshold_auto: number;
  semantic_threshold_copilot: number;
  lyrics_threshold_auto: number;
  lyrics_threshold_copilot: number;
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
  /** True when this item was matched via semantic similarity (Phase 9). */
  is_semantic?: boolean;
  /** Cosine similarity score [0–1] for semantic matches. */
  confidence?: number;
  /** Content kind: "scripture" (default) or "song" (Phase 10). */
  kind?: string;
  /** Song library ID — only set when kind === "song". */
  song_id?: number | null;
}

/** Status of the semantic scripture index (Phase 9). */
export interface SemanticStatus {
  ready: boolean;
  verse_count: number;
  enabled: boolean;
}

// ─── Phase 10: Song library ────────────────────────────────────────────────────

/** A song in the lyrics library. Matches Rust `Song` struct. */
export interface Song {
  id: number;
  title: string;
  artist: string | null;
  /** Import source: "ccli", "openlp", or "manual". */
  source: string | null;
  ccli_number: string | null;
  lyrics: string;
  created_at_ms: number;
}

/** Status of the song semantic index. */
export interface SongSemanticStatus {
  ready: boolean;
  song_count: number;
}

// ─── Phase 15: Artifacts ───────────────────────────────────────────────────────

/** Broad MIME category used for filter pills. */
export type ArtifactCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "slide"
  | "archive"
  | "other";

/** Matches Rust `ArtifactEntry` struct. */
export interface ArtifactEntry {
  id: string;
  service_id: string | null;
  path: string;
  name: string;
  is_dir: boolean;
  parent_path: string;
  size_bytes: number;
  mime_type: string | null;
  starred: boolean;
  created_at_ms: number;
  modified_at_ms: number;
}

/** Matches Rust `ArtifactsSettings` struct. */
export interface ArtifactsSettings {
  base_path: string;
}
