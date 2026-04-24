/**
 * @module lib/schemas
 *
 * Zod schemas for all Tauri command response types.
 * These mirror the TypeScript interfaces in `lib/types.ts` and the Rust structs
 * they serialise from. Validation is applied at the IPC boundary in
 * `invokeValidated` to surface backend drift early with meaningful errors.
 */

import { z } from "zod";

// ─── Enum / Union schemas ─────────────────────────────────────────────────────

export const TaskStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "done",
  "cancelled",
]);

export const DetectionModeSchema = z.enum([
  "auto",
  "copilot",
  "airplane",
  "offline",
]);

export const SttBackendSchema = z.enum(["whisper", "deepgram", "off"]);

export const ThemeModeSchema = z.enum(["light", "dark", "system"]);

export const WhisperModelSchema = z.enum(["tiny", "base", "small", "medium"]);

export const BranchRoleSchema = z.enum(["hq", "member"]);

export const QueueStatusSchema = z.enum(["pending", "live", "dismissed"]);

export const SyncStatusSchema = z.enum([
  "local_only",
  "queued",
  "syncing",
  "downloading",
  "synced",
  "conflict",
  "error",
]);

export const AccessLevelSchema = z.enum([
  "restricted",
  "branch_only",
  "all_branches",
]);

export const BranchPermissionSchema = z.enum(["view", "comment", "edit"]);

export const TutorialStateSchema = z.enum([
  "not_started",
  "in_progress_step_1",
  "in_progress_step_2",
  "in_progress_step_3",
  "in_progress_step_4",
  "in_progress_step_5",
  "completed",
  "dismissed",
]);

// ─── STT Status (discriminated union matching Rust serialisation) ─────────────

export const SttStatusSchema = z.union([
  z.literal("running"),
  z.literal("stopped"),
  z.object({ fallback: z.string() }),
  z.object({ error: z.string() }),
]);

// ─── Service project types ────────────────────────────────────────────────────

export const ProjectItemSchema = z.object({
  id: z.string(),
  reference: z.string(),
  text: z.string(),
  translation: z.string(),
  position: z.number(),
  added_at_ms: z.number(),
  item_type: z.string(),
  duration_secs: z.number().nullable(),
  notes: z.string().nullable(),
  asset_ids: z.array(z.string()),
});

export const ServiceTaskSchema = z.object({
  id: z.string(),
  service_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatusSchema,
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});

export const ServiceProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at_ms: z.number(),
  closed_at_ms: z.number().nullable(),
  scheduled_at_ms: z.number().nullable(),
  description: z.string().nullable(),
  items: z.array(ProjectItemSchema),
  tasks: z.array(ServiceTaskSchema),
});

// ─── Content ──────────────────────────────────────────────────────────────────

export const ContentBankEntrySchema = z.object({
  id: z.string(),
  reference: z.string(),
  text: z.string(),
  translation: z.string(),
  last_used_ms: z.number(),
  use_count: z.number(),
});

export const VerseResultSchema = z.object({
  translation: z.string(),
  book: z.string(),
  chapter: z.number(),
  verse: z.number(),
  text: z.string(),
  reference: z.string(),
  score: z.number(),
});

export const TranslationInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  abbreviation: z.string(),
});

// ─── Audio / STT ──────────────────────────────────────────────────────────────

export const AudioInputDeviceSchema = z.object({
  name: z.string(),
  is_default: z.boolean(),
});

export const ConfigOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string(),
});

export const ConfigFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  field_type: z.string(),
  options: z.array(ConfigOptionSchema),
  default: z.unknown(),
  description: z.string(),
  is_secret: z.boolean(),
});

export const ProviderInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  is_local: z.boolean(),
  config_fields: z.array(ConfigFieldSchema),
});

export const ModelInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  size_bytes: z.number(),
  download_url: z.string(),
  filename: z.string(),
  is_recommended: z.boolean(),
});

export const ProviderStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready") }),
  z.object({ status: z.literal("needs_model"), models: z.array(ModelInfoSchema) }),
  z.object({
    status: z.literal("needs_config"),
    missing_fields: z.array(z.string()),
  }),
  z.object({ status: z.literal("unavailable"), reason: z.string() }),
]);

export const AudioSettingsSchema = z.object({
  backend: SttBackendSchema,
  semantic_enabled: z.boolean(),
  semantic_threshold_auto: z.number(),
  semantic_threshold_copilot: z.number(),
  lyrics_threshold_auto: z.number(),
  lyrics_threshold_copilot: z.number(),
  audio_input_device: z.string().nullable(),
  theme: ThemeModeSchema,
  whisper_model: WhisperModelSchema,
  provider_config: z.record(z.string(), z.record(z.string(), z.unknown())),
  send_crash_reports: z.boolean(),
});

// ─── Identity & Sync ──────────────────────────────────────────────────────────

export const ChurchIdentitySchema = z.object({
  church_id: z.string(),
  church_name: z.string(),
  branch_id: z.string(),
  branch_name: z.string(),
  role: BranchRoleSchema,
  invite_code: z.string().nullable(),
});

export const BranchSyncStatusSchema = z.object({
  last_pushed_ms: z.number().nullable(),
  last_pulled_ms: z.number().nullable(),
  hq_branch_name: z.string().nullable(),
  error: z.string().nullable(),
});

// ─── Detection queue ──────────────────────────────────────────────────────────

export const QueueItemSchema = z.object({
  id: z.string(),
  reference: z.string(),
  text: z.string(),
  translation: z.string(),
  status: QueueStatusSchema,
  detected_at_ms: z.number(),
  is_semantic: z.boolean().optional(),
  confidence: z.number().optional(),
  kind: z.string().optional(),
  song_id: z.number().nullable().optional(),
  duration_secs: z.number().nullable().optional(),
  image_url: z.string().nullable().optional(),
  note_id: z.string().nullable().optional(),
});

export const SemanticStatusSchema = z.object({
  ready: z.boolean(),
  verse_count: z.number(),
  enabled: z.boolean(),
});

// ─── Announcements & Sermon Notes ─────────────────────────────────────────────

export const AnnouncementItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  image_url: z.string().nullable().optional(),
  keyword_cue: z.string().nullable().optional(),
  created_at_ms: z.number(),
});

export const SermonNoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  slides: z.array(z.string()),
  created_at_ms: z.number(),
});

// ─── Songs ────────────────────────────────────────────────────────────────────

export const SongSchema = z.object({
  id: z.number(),
  title: z.string(),
  artist: z.string().nullable(),
  source: z.string().nullable(),
  ccli_number: z.string().nullable(),
  lyrics: z.string(),
  created_at_ms: z.number(),
});

export const SongSemanticStatusSchema = z.object({
  ready: z.boolean(),
  song_count: z.number(),
});

// ─── Artifacts ────────────────────────────────────────────────────────────────

export const ArtifactEntrySchema = z.object({
  id: z.string(),
  service_id: z.string().nullable(),
  path: z.string(),
  name: z.string(),
  is_dir: z.boolean(),
  parent_path: z.string(),
  size_bytes: z.number(),
  mime_type: z.string().nullable(),
  starred: z.boolean(),
  thumbnail_path: z.string().nullable(),
  created_at_ms: z.number(),
  modified_at_ms: z.number(),
});

export const ArtifactsSettingsSchema = z.object({
  base_path: z.string(),
});

export const StorageUsageSchema = z.object({
  used_bytes: z.number(),
  quota_bytes: z.number().nullable(),
  synced_count: z.number(),
  last_updated_ms: z.number(),
});

// ─── Cloud & Sharing ──────────────────────────────────────────────────────────

export const AclEntrySchema = z.object({
  branch_id: z.string(),
  branch_name: z.string(),
  permission: BranchPermissionSchema,
});

export const CloudSyncInfoSchema = z.object({
  artifact_id: z.string(),
  sync_enabled: z.boolean(),
  status: SyncStatusSchema,
  cloud_key: z.string().nullable(),
  last_etag: z.string().nullable(),
  last_synced_ms: z.number().nullable(),
  sync_error: z.string().nullable(),
  progress: z.number().nullable(),
});

export const S3ConfigSchema = z.object({
  endpoint_url: z.string(),
  bucket: z.string(),
  region: z.string(),
  access_key_id: z.string(),
  secret_access_key: z.string(),
});

// ─── Settings ─────────────────────────────────────────────────────────────────

export const DisplaySettingsSchema = z.object({
  selected_monitor_index: z.number().nullable(),
  multi_output: z.boolean(),
});

export const EmailSettingsSchema = z.object({
  smtp_host: z.string(),
  smtp_port: z.number(),
  smtp_username: z.string(),
  smtp_password: z.string(),
  from_name: z.string(),
  send_delay_hours: z.number(),
  auto_send: z.boolean(),
});

// ─── Summaries & Email ────────────────────────────────────────────────────────

export const ServiceSummarySchema = z.object({
  id: z.string(),
  project_id: z.string(),
  service_name: z.string(),
  church_id: z.string(),
  summary_text: z.string(),
  generated_at_ms: z.number(),
  email_sent: z.boolean(),
  email_sent_at_ms: z.number().nullable(),
});

export const EmailSubscriberSchema = z.object({
  id: z.string(),
  church_id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  subscribed_at_ms: z.number(),
});

// ─── Display window ───────────────────────────────────────────────────────────

export const MonitorInfoSchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
  position_x: z.number(),
  position_y: z.number(),
  scale_factor: z.number(),
  is_primary: z.boolean(),
});

// ─── Display backgrounds (local type from display.ts) ────────────────────────

export const BackgroundInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  value: z.string(),
  bg_type: z.string(),
});

// ─── Backup (local type from backup.ts) ──────────────────────────────────────

export const BackupInfoSchema = z.object({
  path: z.string(),
  size_bytes: z.number(),
  created_at_ms: z.number(),
});

// ─── Updater (local types from updater.ts) ────────────────────────────────────

export const UpdateInfoSchema = z.object({
  version: z.string(),
  date: z.string().optional(),
  body: z.string().optional(),
});

// ─── Tutorial (local type from tutorial.ts) ───────────────────────────────────

export const SeedResultSchema = z.object({
  songs_seeded: z.number(),
  project_seeded: z.boolean(),
});
