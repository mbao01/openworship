import { test, expect } from "@playwright/test";

test.describe("Display Page", () => {
  test("renders the display route", async ({ page }) => {
    await page.goto("/display");
    // Display page should render (even without WebSocket, it shows idle state)
    await expect(page.locator("[data-qa='display-root']")).toBeVisible();
  });

  test("shows watermark", async ({ page }) => {
    await page.goto("/display");
    await expect(page.locator("[data-qa='display-watermark']")).toBeVisible();
    await expect(page.locator("[data-qa='display-watermark']")).toContainText("openworship");
  });
});
