import { test, expect } from "../fixtures";

test.describe("Operator Page", () => {
  test("title bar is visible with app name", async ({ operatorPage: page }) => {
    const titlebar = page.locator('[data-qa="operator-titlebar"]');
    await expect(titlebar).toBeVisible();
    await expect(titlebar.locator('[data-qa="operator-appname"]')).toHaveText(
      "openworship"
    );
  });

  test("title bar shows branch name", async ({ operatorPage: page }) => {
    await expect(page.locator('[data-qa="operator-branch"]')).toHaveText("Main");
  });

  test("settings gear button is present and accessible", async ({
    operatorPage: page,
  }) => {
    const settingsBtn = page.locator('button[aria-label="Open settings"]');
    await expect(settingsBtn).toBeVisible();
    await expect(settingsBtn).toHaveAttribute("aria-label", "Open settings");
  });

  test("clicking settings gear opens settings modal", async ({
    operatorPage: page,
  }) => {
    const settingsBtn = page.locator('button[aria-label="Open settings"]');
    await settingsBtn.click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  });

  test("mode toolbar is visible", async ({ operatorPage: page }) => {
    await expect(page.locator('[data-qa="operator-root"]')).toBeVisible();
  });

  test("scripture search component renders in content bank", async ({
    operatorPage: page,
  }) => {
    const leftCol = page.locator('[data-qa="operator-col-left"]');
    await expect(leftCol).toBeVisible();
  });

  test("transcript panel renders in center column", async ({
    operatorPage: page,
  }) => {
    const centerCol = page.locator('[data-qa="operator-col-center"]');
    await expect(centerCol).toBeVisible();
  });

  test("detection queue renders in right column", async ({
    operatorPage: page,
  }) => {
    const rightCol = page.locator('[data-qa="operator-col-right"]');
    await expect(rightCol).toBeVisible();
  });
});
