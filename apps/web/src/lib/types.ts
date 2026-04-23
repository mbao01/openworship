/** Matches the Rust `TranscriptEvent` struct emitted via `stt://transcript`. */
export interface TranscriptEvent {
  text: string;
  offset_ms: number;
  duration_ms: number;
  mic_active: boolean;
}

/** A single content/event item within a service project. */
export interface ProjectItem {
  id: string;
  reference: string;
  text: string;
  translation: string;
  position: number;
  added_at_ms: number;
  /** Event type: "scripture", "song", "prayer", "sermon", "announcement", "other" */
  item_type: string;
  /** Planned duration in seconds. */
  duration_secs: number | null;
  /** Operator notes for this event. */
  notes: string | null;
  /** Linked artifact IDs (assets attached to this event). */
  asset_ids: string[];
}

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "done"
  | "cancelled";

/** A task within a service project. */
export interface ServiceTask {
  id: string;
  service_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at_ms: number;
  updated_at_ms: number;
}

/** A named container for the ordered content of a single worship service. */
export interface ServiceProject {
  id: string;
  name: string;
  created_at_ms: number;
  /** null while the service is active; set when the operator ends the service. */
  closed_at_ms: number | null;
  /** Scheduled date/time for the service (operator-editable). */
  scheduled_at_ms: number | null;
  /** Service description / notes. */
  description: string | null;
  items: ProjectItem[];
  tasks: ServiceTask[];
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
export type SttBackend = "whisper" | "deepgram" | "off";

/** Matches Rust `ThemeMode` enum. */
export type ThemeMode = "light" | "dark" | "system";

/** Matches Rust `WhisperModel` enum. */
export type WhisperModel = "tiny" | "base" | "small" | "medium";

/** Matches Rust `AudioInputDevice` struct from `capture.rs`. */
export interface AudioInputDevice {
  name: string;
  is_default: boolean;
}

// ─── STT Provider types ──────────────────────────────────────────────────────

/** Option for a "select" config field. */
export interface ConfigOption {
  value: string;
  label: string;
  description: string;
}

/** Describes a configuration field a provider needs from the user. */
export interface ConfigField {
  key: string;
  label: string;
  /** "text" | "password" | "select" | "toggle" */
  field_type: string;
  options: ConfigOption[];
  default: unknown;
  description: string;
  /** Whether this field is a secret stored in the OS keychain. */
  is_secret: boolean;
}

/** Static metadata about an STT provider. */
export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  is_local: boolean;
  config_fields: ConfigField[];
}

/** A downloadable model for a provider. */
export interface ModelInfo {
  id: string;
  label: string;
  size_bytes: number;
  download_url: string;
  filename: string;
  is_recommended: boolean;
}

/** Readiness status of a provider. */
export type ProviderStatus =
  | { status: "ready" }
  | { status: "needs_model"; models: ModelInfo[] }
  | { status: "needs_config"; missing_fields: string[] }
  | { status: "unavailable"; reason: string };

/** Matches Rust `AudioSettings` struct. */
export interface AudioSettings {
  backend: SttBackend;
  // deepgram_api_key is intentionally absent: the Rust field uses
  // #[serde(skip_serializing)] so it is never returned over IPC.
  // Manage Deepgram credentials via setProviderSecret("deepgram", "api_key", …).
  semantic_enabled: boolean;
  semantic_threshold_auto: number;
  semantic_threshold_copilot: number;
  lyrics_threshold_auto: number;
  lyrics_threshold_copilot: number;
  /** Preferred audio input device name; null means system default. */
  audio_input_device: string | null;
  /** UI colour scheme preference. */
  theme: ThemeMode;
  /** Which Whisper model to use for local STT. */
  whisper_model: WhisperModel;
  /** Per-provider configuration blobs. */
  provider_config: Record<string, Record<string, unknown>>;
  /** Whether the operator has opted in to Sentry crash reporting. */
  send_crash_reports: boolean;
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

/** Matches Rust `BranchSyncStatus` struct. */
export interface BranchSyncStatus {
  last_pushed_ms: number | null;
  last_pulled_ms: number | null;
  hq_branch_name: string | null;
  error: string | null;
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
  /** Content kind: "scripture" | "song" | "announcement" | "custom_slide" | "sermon_note" | "countdown". */
  kind?: string;
  /** Song library ID — only set when kind === "song". */
  song_id?: number | null;
  /** Countdown duration in seconds — only set when kind === "countdown". */
  duration_secs?: number | null;
  /** Image URL — only set for announcement or custom_slide. */
  image_url?: string | null;
  /** Sermon note deck ID — only set when kind === "sermon_note". */
  note_id?: string | null;
}

// ─── Phase 12: Announcements, custom slides, sermon notes, countdowns ──────────

/** A stored announcement (persists across services). Matches Rust `AnnouncementItem`. */
export interface AnnouncementItem {
  id: string;
  /** "announcement" or "custom_slide" */
  kind: string;
  title: string;
  body: string;
  image_url?: string | null;
  keyword_cue?: string | null;
  created_at_ms: number;
}

/** A sermon note deck. Matches Rust `SermonNote`. */
export interface SermonNote {
  id: string;
  title: string;
  /** Ordered text slides. */
  slides: string[];
  created_at_ms: number;
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
  thumbnail_path: string | null;
  created_at_ms: number;
  modified_at_ms: number;
}

/** Matches Rust `ArtifactsSettings` struct. */
export interface ArtifactsSettings {
  base_path: string;
}

// ─── Phase 16: Cloud Sync, Multi-Branch & Sharing ─────────────────────────────

/** Matches Rust `SyncStatus` enum. */
export type SyncStatus =
  | "local_only"
  | "queued"
  | "syncing"
  | "downloading"
  | "synced"
  | "conflict"
  | "error";

/** Matches Rust `AccessLevel` enum. */
export type AccessLevel = "restricted" | "branch_only" | "all_branches";

/** Matches Rust `BranchPermission` enum. */
export type BranchPermission = "view" | "comment" | "edit";

/** Matches Rust `AclEntry` struct. */
export interface AclEntry {
  branch_id: string;
  branch_name: string;
  permission: BranchPermission;
}

/** Matches Rust `CloudSyncInfo` struct. */
export interface CloudSyncInfo {
  artifact_id: string;
  sync_enabled: boolean;
  status: SyncStatus;
  cloud_key: string | null;
  last_etag: string | null;
  last_synced_ms: number | null;
  sync_error: string | null;
  /** Upload progress [0–1]; null when not actively syncing. */
  progress: number | null;
}

/** S3-compatible cloud configuration. Secret is never returned from backend. */
export interface S3Config {
  endpoint_url: string;
  bucket: string;
  region: string;
  access_key_id: string;
  /** Write-only: send non-empty to update keychain; empty means "no change". */
  secret_access_key: string;
}

/** Cloud storage usage summary. */
export interface StorageUsage {
  used_bytes: number;
  quota_bytes: number | null;
  synced_count: number;
  last_updated_ms: number;
}

// ─── Phase 14: Service summaries + email subscriptions ────────────────────────

/** Matches Rust `ServiceSummary` struct. */
export interface ServiceSummary {
  id: string;
  project_id: string;
  service_name: string;
  church_id: string;
  /** Markdown-formatted AI-generated summary text. */
  summary_text: string;
  generated_at_ms: number;
  email_sent: boolean;
  email_sent_at_ms: number | null;
}

/** Matches Rust `EmailSubscriber` struct. */
export interface EmailSubscriber {
  id: string;
  church_id: string;
  email: string;
  name: string | null;
  subscribed_at_ms: number;
}

// ─── OPE-63: Display device selection ─────────────────────────────────────────

/** Matches Rust `MonitorInfo` struct from `display_window.rs`. */
export interface MonitorInfo {
  name: string;
  width: number;
  height: number;
  position_x: number;
  position_y: number;
  scale_factor: number;
  is_primary: boolean;
}

/** Matches Rust `DisplaySettings` struct from `settings.rs`. */
export interface DisplaySettings {
  selected_monitor_index: number | null;
  multi_output: boolean;
}

/** Matches Rust `EmailSettings` struct. */
export interface EmailSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  /** Password stored in the OS keychain; not serialized by the backend. Empty string means "no change". */
  smtp_password: string;
  from_name: string;
  /** Hours to wait after service end before sending. 0 = immediate. */
  send_delay_hours: number;
  auto_send: boolean;
}

// ── Tutorial state ─────────────────────────────────────────────────────────────

/** Tour onboarding state persisted to ~/.openworship/tutorial.json. */
export type TutorialState =
  | "not_started"
  | "in_progress_step_1"
  | "in_progress_step_2"
  | "in_progress_step_3"
  | "in_progress_step_4"
  | "in_progress_step_5"
  | "completed"
  | "dismissed";
