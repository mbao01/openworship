import { test, expect, stubTauriIdentity } from "../fixtures";

test.describe("App Navigation", () => {
  test("operator page loads at root route", async ({ page }) => {
    await stubTauriIdentity(page);
    await page.goto("/");
    await page.waitForSelector(".operator-root, .onboarding-root", {
      timeout: 15_000,
    });
    await expect(page.locator(".operator-root")).toBeVisible();
    await expect(page.locator(".operator-appname")).toHaveText("openworship");
  });

  test("display page loads at /display route", async ({ page }) => {
    await page.goto("/display");
    await expect(page.locator(".display-root")).toBeVisible();
    await expect(page.locator(".display-watermark")).toHaveText("openworship");
  });

  test("operator page shows three-column layout", async ({ page }) => {
    await stubTauriIdentity(page);
    await page.goto("/");
    await page.waitForSelector(".operator-root, .onboarding-root", {
      timeout: 15_000,
    });
    await expect(page.locator(".operator-col--left")).toBeVisible();
    await expect(page.locator(".operator-col--center")).toBeVisible();
    await expect(page.locator(".operator-col--right")).toBeVisible();
  });

  test("operator page shows content bank heading", async ({ page }) => {
    await stubTauriIdentity(page);
    await page.goto("/");
    await page.waitForSelector(".operator-root, .onboarding-root", {
      timeout: 15_000,
    });
    await expect(page.locator(".operator-col__heading")).toContainText(
      "CONTENT BANK"
    );
  });

  test("onboarding page loads at root route when no identity", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector(".operator-root, .onboarding-root", {
      timeout: 15_000,
    });
    await expect(page.locator(".onboarding-root")).toBeVisible();
  });
});
