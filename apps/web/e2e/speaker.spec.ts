import { test, expect } from "@playwright/test";

test.describe("Speaker Page", () => {
  test("renders the speaker route with waiting state", async ({ page }) => {
    await page.goto("/speaker");
    await expect(page.getByText("SPEAKER NOTES")).toBeVisible();
    await expect(page.getByText("Waiting for sermon notes")).toBeVisible();
  });
});
