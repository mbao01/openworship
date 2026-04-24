import { test, expect } from "../fixtures";

test.describe("Scripture Search", () => {
  test("scripture tab shows select mode (Book combobox) by default", async ({
    operatorPage: page,
  }) => {
    await expect(page.getByText("Book", { exact: true })).toBeVisible();
  });

  test("can toggle to text mode and shows search input", async ({
    operatorPage: page,
  }) => {
    const textBtn = page.locator('button[title="Free-text search"]');
    await textBtn.click();

    await expect(
      page.locator('input[placeholder="Romans 8:38 ..."]'),
    ).toBeVisible();
  });

  test("can switch back to select mode from text mode", async ({ operatorPage: page }) => {
    // Switch to text mode first
    const textBtn = page.locator('button[title="Free-text search"]');
    await textBtn.click();
    await expect(
      page.locator('input[placeholder="Romans 8:38 ..."]'),
    ).toBeVisible();

    // Switch back to select mode
    const selectBtn = page.locator(
      'button[title="Browse by book/chapter/verse"]',
    );
    await selectBtn.click();

    await expect(page.getByText("Book", { exact: true })).toBeVisible();
  });
});
