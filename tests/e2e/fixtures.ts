import { test as base, type Page } from "@playwright/test";

/** A mock ChurchIdentity used in E2E tests to bypass the onboarding gate. */
const MOCK_IDENTITY = {
  church_id: "e2e-church-id",
  church_name: "E2E Test Church",
  branch_id: "e2e-branch-id",
  branch_name: "Main",
  role: "hq",
  invite_code: "E2ETEST1",
};

/**
 * Inject a Tauri IPC stub into the page before navigation.
 *
 * - `get_identity` resolves with the mock identity so `App.tsx` renders
 *   `OperatorPage` instead of `OnboardingPage`.
 * - All other commands resolve to `null`.
 */
export async function stubTauriIdentity(page: Page): Promise<void> {
  await page.addInitScript((identity) => {
    /* eslint-disable */
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: (cmd, args) => {
        // Tauri v2 plugin commands
        if (cmd === "plugin:event|listen") return Promise.resolve(args?.handler ?? 0);
        if (cmd === "plugin:event|unlisten") return Promise.resolve();
        if (cmd === "plugin:app|version") return Promise.resolve("0.0.1");
        if (cmd === "get_identity") return Promise.resolve(identity);
        // Commands that return arrays — must resolve to [] not null or components crash
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
        if (cmd === "get_semantic_status")
          return Promise.resolve({ ready: false, verse_count: 0, enabled: false });
        if (cmd === "get_audio_settings")
          return Promise.resolve({ engine: "whisper", model: "base.en", deepgram_enabled: false });
        if (cmd === "get_stt_status")
          return Promise.resolve({ engine: "whisper", running: false, model_downloaded: false });
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

/** Extended test fixture: `operatorPage` navigates to `/` with identity pre-stubbed. */
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
