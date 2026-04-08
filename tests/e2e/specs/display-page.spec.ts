import { test, expect } from "@playwright/test";

test.describe("Display Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/display");
  });

  test("shows idle state when no content is pushed", async ({ page }) => {
    // When no WebSocket content is available, display root should render
    await expect(page.locator(".display-root")).toBeVisible();
    // Idle div exists in the DOM (may be visually hidden via CSS)
    await expect(page.locator(".display-idle")).toBeAttached();
  });

  test("shows watermark", async ({ page }) => {
    const watermark = page.locator(".display-watermark");
    await expect(watermark).toBeVisible();
    await expect(watermark).toHaveText("openworship");
  });

  test("no content block visible in idle state", async ({ page }) => {
    // display-content should not be present until a WebSocket message arrives
    await expect(page.locator(".display-content")).not.toBeVisible();
  });
});
