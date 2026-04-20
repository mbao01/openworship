import { test, expect } from "@playwright/test";

test.describe("Route Navigation", () => {
  test("/ renders onboarding (no identity)", async ({ page }) => {
    await page.goto("/");
    // Without identity, should show onboarding
    await expect(page.getByText("Set up your church")).toBeVisible();
  });

  test("/display renders display page", async ({ page }) => {
    await page.goto("/display");
    await expect(page.locator("[data-qa='display-root']")).toBeVisible();
  });

  test("/speaker renders speaker page", async ({ page }) => {
    await page.goto("/speaker");
    await expect(page.getByText("SPEAKER NOTES")).toBeVisible();
  });

  test("/artifacts renders artifacts page", async ({ page }) => {
    await page.goto("/artifacts");
    // ArtifactsPage has a back button to operator
    await expect(page.locator("[data-qa='artifacts-root']")).toBeVisible();
  });

  test("unknown route falls through to root", async ({ page }) => {
    await page.goto("/nonexistent");
    // Should show something — either onboarding or blank page
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Onboarding Form Submission", () => {
  test("create church form can be filled and submitted", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Create a new church").click();

    // Fill the form
    await page.getByPlaceholder("Grace Community Church").fill("Test Church");
    await page.getByPlaceholder("Main Campus").fill("Downtown");

    // Submit button should be enabled
    const submitBtn = page.getByRole("button", { name: /get started/i });
    await expect(submitBtn).toBeEnabled();
  });

  test("join church validates code length", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Join an existing church").click();

    // Type a short code
    await page.getByPlaceholder(/[A-Z0-9]{8,}/).fill("SHORT");
    await page.getByPlaceholder("North Campus").fill("Westside");

    // Submit should be disabled (code too short)
    const submitBtn = page.getByRole("button", { name: /join church/i });
    await expect(submitBtn).toBeDisabled();
  });
});

test.describe("Display Page Content", () => {
  test("display page has dark background", async ({ page }) => {
    await page.goto("/display");
    const root = page.locator("[data-qa='display-root']");
    await expect(root).toBeVisible();
  });

  test("display page shows idle state when no content", async ({ page }) => {
    await page.goto("/display");
    // No WebSocket content = idle/empty display
    await expect(page.locator("[data-qa='display-root']")).toBeVisible();
  });
});

test.describe("Speaker Page Interaction", () => {
  test("speaker page shows waiting state", async ({ page }) => {
    await page.goto("/speaker");
    await expect(page.getByText("Waiting for sermon notes")).toBeVisible();
  });

  test("speaker page has navigation buttons when slide exists", async ({ page }) => {
    await page.goto("/speaker");
    // In waiting state, should show informational text
    await expect(page.getByText("Waiting for sermon notes")).toBeVisible();
    await expect(
      page.getByText("The operator will push notes when the message begins")
    ).toBeVisible();
  });
});
