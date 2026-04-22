import { test, expect, stubTauriIdentity } from "../fixtures";

test.describe("App Navigation", () => {
  test("operator page loads at root route", async ({ page }) => {
    await stubTauriIdentity(page);
    await page.goto("/");
    await page.waitForSelector('[data-qa="operator-root"], [data-qa="onboarding-root"]', {
      timeout: 15_000,
    });
    await expect(page.locator('[data-qa="operator-root"]')).toBeVisible();
    await expect(page.locator('[data-qa="operator-appname"]')).toHaveText("openworship");
  });

  test("display page loads at /display route", async ({ page }) => {
    await page.goto("/display");
    await expect(page.locator('[data-qa="display-root"]')).toBeVisible();
    await expect(page.locator('[data-qa="display-watermark"]')).toHaveText("openworship");
  });

  test("operator page shows three-column layout", async ({ page }) => {
    await stubTauriIdentity(page);
    await page.goto("/");
    await page.waitForSelector('[data-qa="operator-root"], [data-qa="onboarding-root"]', {
      timeout: 15_000,
    });
    await expect(page.locator('[data-qa="operator-col-left"]')).toBeVisible();
    await expect(page.locator('[data-qa="operator-col-center"]')).toBeVisible();
    await expect(page.locator('[data-qa="operator-col-right"]')).toBeVisible();
  });

  test("operator page shows content bank heading", async ({ page }) => {
    await stubTauriIdentity(page);
    await page.goto("/");
    await page.waitForSelector('[data-qa="operator-root"], [data-qa="onboarding-root"]', {
      timeout: 15_000,
    });
    await expect(page.locator('[data-qa="content-bank-toggle-label"]')).toContainText(
      "Library"
    );
  });

  test("onboarding page loads at root route when no identity", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector('[data-qa="operator-root"], [data-qa="onboarding-root"]', {
      timeout: 15_000,
    });
    await expect(page.locator('[data-qa="onboarding-root"]')).toBeVisible();
  });
});
