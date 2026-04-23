import { test as base, expect } from "@playwright/test";
import { stubTauriOnboarding } from "../fixtures";

const test = base;

test.describe("Create Church → Operator", () => {
  test("completing create flow reaches operator page", async ({ page }) => {
    await stubTauriOnboarding(page);
    await page.goto("/");
    await page.getByText("Create a new church").click();
    await page.getByPlaceholder("Grace Community Church").fill("Test");
    await page.getByPlaceholder("Main Campus").fill("Main");
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page.locator("[data-qa='operator-root']")).toBeVisible({ timeout: 10_000 });
  });

  test("operator page has full rail navigation after create", async ({ page }) => {
    await stubTauriOnboarding(page);
    await page.goto("/");
    await page.getByText("Create a new church").click();
    await page.getByPlaceholder("Grace Community Church").fill("Test");
    await page.getByPlaceholder("Main Campus").fill("Main");
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page.locator("[data-qa='operator-root']")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Plan", { exact: true })).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
  });
});

test.describe("Join Church → Operator", () => {
  test("completing join flow reaches operator page", async ({ page }) => {
    await stubTauriOnboarding(page);
    await page.goto("/");
    await page.getByText("Join an existing church").click();
    await page.getByPlaceholder("ABCDEF1234567890").fill("E2E0TEST1234ABCD");
    await page.getByPlaceholder("North Campus").fill("Westside Campus");
    await page.getByRole("button", { name: /join church/i }).click();
    await expect(page.locator("[data-qa='operator-root']")).toBeVisible({ timeout: 10_000 });
  });

  test("can switch screens after joining", async ({ page }) => {
    await stubTauriOnboarding(page);
    await page.goto("/");
    await page.getByText("Join an existing church").click();
    await page.getByPlaceholder("ABCDEF1234567890").fill("E2E0TEST1234ABCD");
    await page.getByPlaceholder("North Campus").fill("Westside Campus");
    await page.getByRole("button", { name: /join church/i }).click();
    await expect(page.locator("[data-qa='operator-root']")).toBeVisible({ timeout: 10_000 });
    await page.getByText("Live", { exact: true }).click();
    await expect(page.getByText("Scripture")).toBeVisible();
    await expect(page.getByText("Queue")).toBeVisible();
  });

  test("join form validates 16-char code", async ({ page }) => {
    await stubTauriOnboarding(page);
    await page.goto("/");
    await page.getByText("Join an existing church").click();
    await page.getByPlaceholder("ABCDEF1234567890").fill("SHORT123");
    await page.getByPlaceholder("North Campus").fill("Test");
    await expect(page.getByRole("button", { name: /join church/i })).toBeDisabled();
    await page.getByPlaceholder("ABCDEF1234567890").fill("ABCDEF1234567890");
    await expect(page.getByRole("button", { name: /join church/i })).toBeEnabled();
  });
});
