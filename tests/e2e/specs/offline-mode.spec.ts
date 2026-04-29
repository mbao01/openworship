import { test as base, expect, type Page } from "@playwright/test";
import { stubTauriWithSttStatus, stubTauriIdentity } from "../fixtures";

const test = base.extend<{ operatorPage: Page }>({
  operatorPage: async ({ page }, use) => {
    // Default: use the normal identity stub (stt_status = "stopped")
    await stubTauriIdentity(page);
    await page.goto("/");
    await page.waitForSelector('[data-qa="operator-root"], [data-qa="onboarding-root"]', {
      timeout: 15_000,
    });
    await use(page);
  },
});

test.describe("Offline Mode Indicator", () => {
  test("fallback badge is hidden when STT status is stopped", async ({
    operatorPage: page,
  }) => {
    // Default mock returns "stopped" — badge should not appear
    const badge = page.locator('[data-qa="stt-fallback-badge"]');
    await expect(badge).not.toBeVisible();
  });

  test("fallback badge renders when STT is in fallback mode", async ({ page }) => {
    // Override get_stt_status to return a fallback object
    await stubTauriWithSttStatus(page, { fallback: "network unreachable" });
    await page.goto("/");
    await page.waitForSelector('[data-qa="operator-root"]', { timeout: 15_000 });

    const badge = page.locator('[data-qa="stt-fallback-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("Local STT");
  });

  test("fallback badge is hidden when STT status is running normally", async ({ page }) => {
    await stubTauriWithSttStatus(page, "running");
    await page.goto("/");
    await page.waitForSelector('[data-qa="operator-root"]', { timeout: 15_000 });

    const badge = page.locator('[data-qa="stt-fallback-badge"]');
    await expect(badge).not.toBeVisible();
  });
});
