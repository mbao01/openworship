import { test as base, type Page } from "@playwright/test";

const MOCK_IDENTITY = {
  church_id: "e2e-church-id",
  church_name: "E2E Test Church",
  branch_id: "e2e-branch-id",
  branch_name: "Main",
  role: "hq",
  invite_code: "E2ETEST1",
};

/**
 * Shared command → response map used by both identity and onboarding stubs.
 * Keeps mock surface in one place so new commands only need adding once.
 */
const BASE_MOCK_COMMANDS: Record<string, unknown> = {
  "plugin:event|unlisten": null,
  "plugin:app|version": "0.0.1",
  list_translations: [],
  get_queue: [],
  list_service_projects: [],
  search_content_bank: [],
  search_scriptures: [],
  search_semantic: [],
  search_songs: [],
  list_announcements: [],
  list_sermon_notes: [],
  list_service_summaries: [],
  import_songs_ccli: [],
  import_songs_openlp: [],
  import_pptx_slides: [],
  import_pdf_slides: [],
  list_preset_backgrounds: [],
  list_uploaded_backgrounds: [],
  list_stt_providers: [],
  list_audio_input_devices: [],
  list_recent_artifacts: [],
  get_detection_mode: "copilot",
  get_blackout: false,
  get_book_chapters: [1, 2, 3],
  get_chapter_verses: [1, 2, 3, 4, 5],
  get_semantic_status: { ready: false, verse_count: 0, enabled: false },
  get_audio_settings: { engine: "whisper", model: "base.en", deepgram_enabled: false },
  get_stt_status: "stopped",
  get_tutorial_state: "dismissed",
};

export async function stubTauriIdentity(page: Page): Promise<void> {
  await page.addInitScript((ctx) => {
    /* eslint-disable */
    var commands = ctx.commands;
    var identity = ctx.identity;
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: (cmd, args) => {
        if (cmd === "get_identity") return Promise.resolve(identity);
        if (cmd === "plugin:event|listen") return Promise.resolve(args?.handler ?? 0);
        if (cmd in commands) return Promise.resolve(commands[cmd]);
        return Promise.resolve(null);
      },
      listen: () => Promise.resolve(() => {}),
      unregisterListener: () => {},
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: () => {},
      listeners: {},
    };
    /* eslint-enable */
  }, { identity: MOCK_IDENTITY, commands: BASE_MOCK_COMMANDS });
}

export async function stubTauriOnboarding(page: Page): Promise<void> {
  const onboardingCommands = {
    ...BASE_MOCK_COMMANDS,
    get_active_translation: "KJV",
    get_display_settings: { selected_monitor_index: null, multi_output: false },
    get_obs_display_url: "http://localhost:7411/display",
    get_display_window_open: false,
    list_monitors: [],
    get_artifacts_settings: { base_path: "/tmp" },
    get_email_settings: { smtp_host: "", smtp_port: 587, smtp_username: "", smtp_password: "", from_name: "", send_delay_hours: 0, auto_send: false },
    get_storage_usage: { used_bytes: 0, quota_bytes: null, synced_count: 0, last_updated_ms: 0 },
  };

  await page.addInitScript((ctx) => {
    /* eslint-disable */
    var commands = ctx.commands;
    var identity = ctx.identity;
    var currentId = null;
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: (cmd, args) => {
        if (cmd === "create_church" || cmd === "join_church") {
          currentId = identity;
          return Promise.resolve(identity);
        }
        if (cmd === "get_identity") return Promise.resolve(currentId);
        if (cmd === "plugin:event|listen") return Promise.resolve(args?.handler ?? 0);
        if (cmd in commands) return Promise.resolve(commands[cmd]);
        return Promise.resolve(null);
      },
      listen: () => Promise.resolve(() => {}),
      unregisterListener: () => {},
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: () => {},
      listeners: {},
    };
    /* eslint-enable */
  }, { identity: MOCK_IDENTITY, commands: onboardingCommands });
}

/**
 * Stub with a custom `get_stt_status` response to test offline/fallback UI.
 * Accepts any valid SttStatus value: "running", "stopped", { fallback: string }, { error: string }.
 */
export async function stubTauriWithSttStatus(
  page: Page,
  sttStatus: unknown,
): Promise<void> {
  const commands = { ...BASE_MOCK_COMMANDS, get_stt_status: sttStatus };
  await page.addInitScript((ctx) => {
    /* eslint-disable */
    var commands = ctx.commands;
    var identity = ctx.identity;
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: (cmd, args) => {
        if (cmd === "get_identity") return Promise.resolve(identity);
        if (cmd === "plugin:event|listen") return Promise.resolve(args?.handler ?? 0);
        if (cmd in commands) return Promise.resolve(commands[cmd]);
        return Promise.resolve(null);
      },
      listen: () => Promise.resolve(() => {}),
      unregisterListener: () => {},
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: () => {},
      listeners: {},
    };
    /* eslint-enable */
  }, { identity: MOCK_IDENTITY, commands });
}

export const test = base.extend<{ operatorPage: Page }>({
  operatorPage: async ({ page }, use) => {
    await stubTauriIdentity(page);
    await page.goto("/");
    await page.waitForSelector('[data-qa="operator-root"], [data-qa="onboarding-root"]', {
      timeout: 15_000,
    });
    await use(page);
  },
});

export { expect } from "@playwright/test";
