import { test, expect } from "../fixtures";

test.describe("Screen Switching", () => {
  test("Plan screen shows Services heading", async ({ operatorPage: page }) => {
    await page.getByText("Plan", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
  });

  test("Live screen shows Scripture and Queue", async ({ operatorPage: page }) => {
    await page.getByText("Live", { exact: true }).click();
    await expect(page.getByText("Scripture")).toBeVisible();
    await expect(page.getByText("Queue")).toBeVisible();
  });

  test("Live screen shows stage toolbar with Push next", async ({ operatorPage: page }) => {
    await page.getByText("Live", { exact: true }).click();
    await expect(page.getByText("Push next")).toBeVisible();
  });

  test("Prep screen renders", async ({ operatorPage: page }) => {
    await page.getByText("Prep", { exact: true }).click();
    await expect(page.getByText(/checklist/i)).toBeVisible();
  });

  test("Assets screen shows All Assets button", async ({ operatorPage: page }) => {
    await page.locator("nav").getByText("Assets").click();
    await expect(page.getByRole("button", { name: "All Assets" })).toBeVisible();
  });
});

test.describe("Command Palette", () => {
  test("Cmd+K opens and Escape closes", async ({ operatorPage: page }) => {
    await page.keyboard.press("Meta+k");
    await expect(page.getByPlaceholder(/search scripture/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder(/search scripture/i)).not.toBeVisible();
  });
});
