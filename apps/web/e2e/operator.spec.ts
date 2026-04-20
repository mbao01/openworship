/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Page } from "@playwright/test";

// Go through onboarding to reach the operator page.
// The stubbed Tauri invoke (from test-setup or browser env) returns
// undefined for create_church, but the React state update in
// OnboardingPage.onComplete() sets identity, triggering OperatorPage render.
//
// NOTE: In the browser without Tauri, invoke() either:
//   - Throws (no __TAURI_INTERNALS__) → identity stays undefined → onboarding shown
//   - Returns undefined (stubbed) → onComplete(undefined) → identity set to undefined
//
// Either way, we can't reach the operator page without a real Tauri backend
// OR a mock that returns valid identity data.
//
// We inject a minimal stub via addInitScript that makes create_church
// return a valid identity object.

async function injectStubs(page: Page) {
  await page.addInitScript(() => {
    const mockId = {
      church_id: "c1", church_name: "Test", branch_id: "b1",
      branch_name: "Main", role: "hq", invite_code: "ABCDEF1234567890",
    };
    let id: typeof mockId | null = null;

    // Minimal stub — only what's needed for navigation
    (window as any).__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: (cmd: string) => {
        if (cmd === "create_church" || cmd === "join_church") {
          id = mockId;
          return Promise.resolve(mockId);
        }
        if (cmd === "get_identity") return Promise.resolve(id);
        // Everything else returns empty/default
        if (cmd === "get_queue") return Promise.resolve([]);
        if (cmd === "get_detection_mode") return Promise.resolve("copilot");
        if (cmd === "list_translations") return Promise.resolve([]);
        if (cmd === "get_active_translation") return Promise.resolve("KJV");
        if (cmd === "get_audio_settings") return Promise.resolve({
          backend: "off", semantic_enabled: false, semantic_threshold_auto: 0.75,
          semantic_threshold_copilot: 0.82, lyrics_threshold_auto: 0.7,
          lyrics_threshold_copilot: 0.78, audio_input_device: null,
          theme: "system", detection_mode: "copilot",
        });
        if (cmd === "get_audio_level") return Promise.resolve(0);
        if (cmd === "get_stt_status") return Promise.resolve("stopped");
        if (cmd === "list_service_projects") return Promise.resolve([]);
        if (cmd === "get_active_project") return Promise.resolve(null);
        if (cmd === "list_artifacts") return Promise.resolve([]);
        if (cmd === "list_recent_artifacts") return Promise.resolve([]);
        if (cmd === "list_announcements") return Promise.resolve([]);
        if (cmd === "get_display_settings") return Promise.resolve({});
        if (cmd === "get_obs_display_url") return Promise.resolve("http://localhost:7411/display");
        if (cmd === "get_display_window_open") return Promise.resolve(false);
        if (cmd === "list_monitors") return Promise.resolve([]);
        if (cmd === "get_artifacts_settings") return Promise.resolve({ base_path: "/tmp" });
        if (cmd === "get_email_settings") return Promise.resolve({ auto_send: false });
        if (cmd === "get_storage_usage") return Promise.resolve({});
        if (cmd === "list_audio_input_devices") return Promise.resolve([]);
        if (cmd === "search_scriptures") return Promise.resolve([]);
        if (cmd === "search_songs") return Promise.resolve([]);
        if (cmd === "list_service_summaries") return Promise.resolve([]);
        return Promise.resolve(undefined);
      },
      convertFileSrc: () => "",
    };
    (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: () => {},
      listeners: {},
    };
  });
}

async function goToOperator(page: Page) {
  await injectStubs(page);
  await page.goto("/");
  // Go through onboarding via create flow
  await page.getByText("Create a new church").click();
  await page.getByPlaceholder("Grace Community Church").fill("Test");
  await page.getByPlaceholder("Main Campus").fill("Main");
  await page.getByRole("button", { name: /get started/i }).click();
  // Wait for operator
  await expect(page.locator("[data-qa='operator-root']")).toBeVisible({ timeout: 10000 });
}

test.describe("Operator Page", () => {
  test("loads after onboarding", async ({ page }) => {
    await goToOperator(page);
    await expect(page.locator("[data-qa='operator-root']")).toBeVisible();
  });

  test("shows Rail navigation", async ({ page }) => {
    await goToOperator(page);
    await expect(page.getByText("Plan", { exact: true })).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
    await expect(page.getByText("Prep", { exact: true })).toBeVisible();
  });

  test("shows TopBar with mode buttons", async ({ page }) => {
    await goToOperator(page);
    await expect(page.getByText("Copilot", { exact: true })).toBeVisible();
    await expect(page.getByText("Auto", { exact: true })).toBeVisible();
  });
});

test.describe("Screen Switching", () => {
  test("Plan screen", async ({ page }) => {
    await goToOperator(page);
    await page.getByText("Plan", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
  });

  test("Live screen", async ({ page }) => {
    await goToOperator(page);
    await page.getByText("Live", { exact: true }).click();
    await expect(page.getByText("Scripture")).toBeVisible();
  });

  test("Prep screen", async ({ page }) => {
    await goToOperator(page);
    await page.getByText("Prep", { exact: true }).click();
    await expect(page.getByText(/checklist/i)).toBeVisible();
  });

  test("Assets screen", async ({ page }) => {
    await goToOperator(page);
    await page.locator("nav").getByText("Assets").click();
    // AssetsNav shows "All Assets" button
    await expect(page.getByRole("button", { name: "All Assets" })).toBeVisible();
  });
});

test.describe("Command Palette", () => {
  test("Cmd+K opens and Escape closes", async ({ page }) => {
    await goToOperator(page);
    await page.keyboard.press("Meta+k");
    await expect(page.getByPlaceholder(/search scripture/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder(/search scripture/i)).not.toBeVisible();
  });
});

test.describe("Live Screen Details", () => {
  test("shows queue and transcript", async ({ page }) => {
    await goToOperator(page);
    await page.getByText("Live", { exact: true }).click();
    await expect(page.getByText("Queue")).toBeVisible();
    await expect(page.getByText("Transcript")).toBeVisible();
  });

  test("shows stage toolbar", async ({ page }) => {
    await goToOperator(page);
    await page.getByText("Live", { exact: true }).click();
    await expect(page.getByText("Push next")).toBeVisible();
    await expect(page.getByText("Black")).toBeVisible();
  });
});

test.describe("Settings", () => {
  test("opens modal", async ({ page }) => {
    await goToOperator(page);
    await page.getByText("Set", { exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

// ─── Join Flow ────────────────────────────────────────────────────────────────

async function goToOperatorViaJoin(page: Page) {
  await injectStubs(page);
  await page.goto("/");
  // Choose "Join an existing church"
  await page.getByText("Join an existing church").click();
  // Fill invite code (16 chars)
  await page.getByPlaceholder("ABCDEF1234567890").fill("E2E0TEST1234ABCD");
  // Fill branch name
  await page.getByPlaceholder("North Campus").fill("Westside Campus");
  // Submit
  await page.getByRole("button", { name: /join church/i }).click();
  // Wait for operator page
  await expect(page.locator("[data-qa='operator-root']")).toBeVisible({ timeout: 10000 });
}

test.describe("Join Church Flow", () => {
  test("join flow leads to operator page", async ({ page }) => {
    await goToOperatorViaJoin(page);
    await expect(page.locator("[data-qa='operator-root']")).toBeVisible();
  });

  test("operator page works after joining", async ({ page }) => {
    await goToOperatorViaJoin(page);
    // Should have full Rail navigation
    await expect(page.getByText("Plan", { exact: true })).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
  });

  test("can switch screens after joining", async ({ page }) => {
    await goToOperatorViaJoin(page);
    await page.getByText("Live", { exact: true }).click();
    await expect(page.getByText("Scripture")).toBeVisible();
    await expect(page.getByText("Queue")).toBeVisible();
  });

  test("join form validates 16-char code", async ({ page }) => {
    await injectStubs(page);
    await page.goto("/");
    await page.getByText("Join an existing church").click();
    // Type only 8 chars — too short
    await page.getByPlaceholder("ABCDEF1234567890").fill("SHORT123");
    await page.getByPlaceholder("North Campus").fill("Test");
    // Submit should be disabled
    await expect(page.getByRole("button", { name: /join church/i })).toBeDisabled();
    // Type full 16 chars
    await page.getByPlaceholder("ABCDEF1234567890").fill("ABCDEF1234567890");
    // Now submit should be enabled
    await expect(page.getByRole("button", { name: /join church/i })).toBeEnabled();
  });
});
