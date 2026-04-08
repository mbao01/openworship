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
      invoke: (cmd) => {
        if (cmd === "get_identity") return Promise.resolve(identity);
        // Commands that return arrays — must not return null or components crash
        if (cmd === "list_translations") return Promise.resolve([]);
        if (cmd === "get_queue") return Promise.resolve([]);
        if (cmd === "list_service_projects") return Promise.resolve([]);
        if (cmd === "search_content_bank") return Promise.resolve([]);
        if (cmd === "search_scriptures") return Promise.resolve([]);
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
    await page.waitForSelector(".operator-root, .onboarding-root", {
      timeout: 15_000,
    });
    await use(page);
  },
});

export { expect } from "@playwright/test";
