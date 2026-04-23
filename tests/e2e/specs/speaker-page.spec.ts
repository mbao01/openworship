import { test, expect } from "@playwright/test";

test.describe("Speaker Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/speaker");
  });

  test("renders the speaker route with heading", async ({ page }) => {
    await expect(page.getByText("SPEAKER NOTES")).toBeVisible();
  });

  test("shows waiting state when no content", async ({ page }) => {
    await expect(page.getByText("Waiting for sermon notes")).toBeVisible();
  });

  test("shows informational guidance text", async ({ page }) => {
    await expect(
      page.getByText("The operator will push notes when the message begins"),
    ).toBeVisible();
  });
});
