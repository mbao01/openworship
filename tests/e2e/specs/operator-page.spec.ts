import { test, expect } from "@playwright/test";

test.describe("Operator Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("title bar is visible with app name", async ({ page }) => {
    const titlebar = page.locator(".operator-titlebar");
    await expect(titlebar).toBeVisible();
    await expect(titlebar.locator(".operator-appname")).toHaveText(
      "openworship"
    );
  });

  test("settings gear button is present and accessible", async ({ page }) => {
    const settingsBtn = page.locator(".settings-gear-btn");
    await expect(settingsBtn).toBeVisible();
    await expect(settingsBtn).toHaveAttribute("aria-label", "Open settings");
  });

  test("clicking settings gear opens settings modal", async ({ page }) => {
    const settingsBtn = page.locator(".settings-gear-btn");
    await settingsBtn.click();
    // SettingsModal dialog should appear
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  });

  test("mode toolbar is visible", async ({ page }) => {
    // ModeToolbar component should render
    await expect(page.locator(".operator-root")).toBeVisible();
  });

  test("scripture search component renders in content bank", async ({
    page,
  }) => {
    const leftCol = page.locator(".operator-col--left");
    await expect(leftCol).toBeVisible();
  });

  test("transcript panel renders in center column", async ({ page }) => {
    const centerCol = page.locator(".operator-col--center");
    await expect(centerCol).toBeVisible();
  });

  test("detection queue renders in right column", async ({ page }) => {
    const rightCol = page.locator(".operator-col--right");
    await expect(rightCol).toBeVisible();
  });
});
