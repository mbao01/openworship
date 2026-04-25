import { test as base, type Page } from "@playwright/test";

const MOCK_IDENTITY = {
  church_id: "e2e-church-id",
  church_name: "E2E Test Church",
  branch_id: "e2e-branch-id",
  branch_name: "Main",
  role: "hq",
  invite_code: "E2ETEST1",
};

export async function stubTauriIdentity(page: Page): Promise<void> {
  await page.addInitScript((identity) => {
    /* eslint-disable */
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: (cmd, args) => {
        if (cmd === "plugin:event|listen") return Promise.resolve(args?.handler ?? 0);
        if (cmd === "plugin:event|unlisten") return Promise.resolve();
        if (cmd === "plugin:app|version") return Promise.resolve("0.0.1");
        if (cmd === "get_identity") return Promise.resolve(identity);
        if (cmd === "list_translations") return Promise.resolve([]);
        if (cmd === "get_queue") return Promise.resolve([]);
        if (cmd === "list_service_projects") return Promise.resolve([]);
        if (cmd === "search_content_bank") return Promise.resolve([]);
        if (cmd === "search_scriptures") return Promise.resolve([]);
        if (cmd === "search_semantic") return Promise.resolve([]);
        if (cmd === "search_songs") return Promise.resolve([]);
        if (cmd === "list_announcements") return Promise.resolve([]);
        if (cmd === "list_sermon_notes") return Promise.resolve([]);
        if (cmd === "list_service_summaries") return Promise.resolve([]);
        if (cmd === "import_songs_ccli") return Promise.resolve([]);
        if (cmd === "import_songs_openlp") return Promise.resolve([]);
        if (cmd === "list_preset_backgrounds") return Promise.resolve([]);
        if (cmd === "list_uploaded_backgrounds") return Promise.resolve([]);
        if (cmd === "list_stt_providers") return Promise.resolve([]);
        if (cmd === "list_audio_input_devices") return Promise.resolve([]);
        if (cmd === "list_recent_artifacts") return Promise.resolve([]);
        if (cmd === "get_detection_mode") return Promise.resolve("copilot");
        if (cmd === "get_blackout") return Promise.resolve(false);
        if (cmd === "get_book_chapters") return Promise.resolve([1, 2, 3]);
        if (cmd === "get_chapter_verses") return Promise.resolve([1, 2, 3, 4, 5]);
        if (cmd === "get_semantic_status")
          return Promise.resolve({ ready: false, verse_count: 0, enabled: false });
        if (cmd === "get_audio_settings")
          return Promise.resolve({ engine: "whisper", model: "base.en", deepgram_enabled: false });
        if (cmd === "get_stt_status")
          return Promise.resolve({ engine: "whisper", running: false, model_downloaded: false });
        if (cmd === "get_tutorial_state") return Promise.resolve("dismissed");
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
  }, MOCK_IDENTITY);
}

export async function stubTauriOnboarding(page: Page): Promise<void> {
  await page.addInitScript((identity) => {
    /* eslint-disable */
    let currentId = null;
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: (cmd, args) => {
        if (cmd === "plugin:event|listen") return Promise.resolve(args?.handler ?? 0);
        if (cmd === "plugin:event|unlisten") return Promise.resolve();
        if (cmd === "plugin:app|version") return Promise.resolve("0.0.1");
        if (cmd === "create_church" || cmd === "join_church") {
          currentId = identity;
          return Promise.resolve(identity);
        }
        if (cmd === "get_identity") return Promise.resolve(currentId);
        if (cmd === "list_translations") return Promise.resolve([]);
        if (cmd === "get_queue") return Promise.resolve([]);
        if (cmd === "list_service_projects") return Promise.resolve([]);
        if (cmd === "search_content_bank") return Promise.resolve([]);
        if (cmd === "search_scriptures") return Promise.resolve([]);
        if (cmd === "search_semantic") return Promise.resolve([]);
        if (cmd === "search_songs") return Promise.resolve([]);
        if (cmd === "list_announcements") return Promise.resolve([]);
        if (cmd === "list_sermon_notes") return Promise.resolve([]);
        if (cmd === "list_service_summaries") return Promise.resolve([]);
        if (cmd === "import_songs_ccli") return Promise.resolve([]);
        if (cmd === "import_songs_openlp") return Promise.resolve([]);
        if (cmd === "list_preset_backgrounds") return Promise.resolve([]);
        if (cmd === "list_uploaded_backgrounds") return Promise.resolve([]);
        if (cmd === "list_stt_providers") return Promise.resolve([]);
        if (cmd === "list_audio_input_devices") return Promise.resolve([]);
        if (cmd === "list_recent_artifacts") return Promise.resolve([]);
        if (cmd === "get_detection_mode") return Promise.resolve("copilot");
        if (cmd === "get_blackout") return Promise.resolve(false);
        if (cmd === "get_book_chapters") return Promise.resolve([1, 2, 3]);
        if (cmd === "get_chapter_verses") return Promise.resolve([1, 2, 3, 4, 5]);
        if (cmd === "get_semantic_status")
          return Promise.resolve({ ready: false, verse_count: 0, enabled: false });
        if (cmd === "get_audio_settings")
          return Promise.resolve({ engine: "whisper", model: "base.en", deepgram_enabled: false });
        if (cmd === "get_stt_status")
          return Promise.resolve({ engine: "whisper", running: false, model_downloaded: false });
        if (cmd === "get_active_translation") return Promise.resolve("KJV");
        if (cmd === "get_display_settings") return Promise.resolve({ selected_monitor_index: null, multi_output: false });
        if (cmd === "get_obs_display_url") return Promise.resolve("http://localhost:7411/display");
        if (cmd === "get_display_window_open") return Promise.resolve(false);
        if (cmd === "list_monitors") return Promise.resolve([]);
        if (cmd === "get_artifacts_settings") return Promise.resolve({ base_path: "/tmp" });
        if (cmd === "get_email_settings") return Promise.resolve({ smtp_host: "", smtp_port: 587, smtp_username: "", smtp_password: "", from_name: "", send_delay_hours: 0, auto_send: false });
        if (cmd === "get_storage_usage") return Promise.resolve({ used_bytes: 0, quota_bytes: null, synced_count: 0, last_updated_ms: 0 });
        if (cmd === "get_tutorial_state") return Promise.resolve("dismissed");
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
  }, MOCK_IDENTITY);
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
