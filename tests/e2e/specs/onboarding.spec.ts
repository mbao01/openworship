import { test, expect } from "@playwright/test";

test.describe("Onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Set up your church")).toBeVisible();
  });

  test("shows onboarding page on first visit", async ({ page }) => {
    await expect(page.getByText("openworship")).toBeVisible();
    await expect(page.getByText("Set up your church")).toBeVisible();
  });

  test("shows create and join options", async ({ page }) => {
    await expect(page.getByText("Create a new church")).toBeVisible();
    await expect(page.getByText("Join an existing church")).toBeVisible();
  });

  test("create flow shows form fields and back button", async ({ page }) => {
    await page.getByText("Create a new church").click();
    await expect(page.getByPlaceholder("Grace Community Church")).toBeVisible();
    await expect(page.getByPlaceholder("Main Campus")).toBeVisible();
    await expect(page.getByRole("button", { name: /get started/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /back/i })).toBeVisible();
  });

  test("join flow shows form fields", async ({ page }) => {
    await page.getByText("Join an existing church").click();
    await expect(page.getByPlaceholder(/[A-Z0-9]{8,}/)).toBeVisible();
    await expect(page.getByPlaceholder("North Campus")).toBeVisible();
    await expect(page.getByRole("button", { name: /join church/i })).toBeVisible();
  });

  test("back button returns to pick flow", async ({ page }) => {
    await page.getByText("Create a new church").click();
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByText("Set up your church")).toBeVisible();
  });

  test("create church form can be filled", async ({ page }) => {
    await page.getByText("Create a new church").click();
    await page.getByPlaceholder("Grace Community Church").fill("Test Church");
    await page.getByPlaceholder("Main Campus").fill("Downtown");
    await expect(page.getByRole("button", { name: /get started/i })).toBeEnabled();
  });

  test("join church validates code length", async ({ page }) => {
    await page.getByText("Join an existing church").click();
    await page.getByPlaceholder(/[A-Z0-9]{8,}/).fill("SHORT");
    await page.getByPlaceholder("North Campus").fill("Westside");
    await expect(page.getByRole("button", { name: /join church/i })).toBeDisabled();
  });
});
