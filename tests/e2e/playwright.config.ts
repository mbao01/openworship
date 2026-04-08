import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests for the OpenWorship web frontend.
 *
 * Launches the Vite dev server and runs tests against it.
 * The Tauri IPC layer is stubbed in the web app's test-setup,
 * so these tests validate the pure web UI layer.
 */
export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report" }]]
    : "html",
  timeout: 30_000,

  expect: {
    timeout: 15_000,
  },

  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm --filter @openworship/web dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    cwd: "../..",
    timeout: 60_000,
  },
});
