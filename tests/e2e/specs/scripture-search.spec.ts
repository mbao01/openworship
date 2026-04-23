import { test, expect } from "../fixtures";

test.describe("Scripture Search", () => {
  test("scripture tab shows text search input by default", async ({
    operatorPage: page,
  }) => {
    await expect(
      page.locator('input[placeholder="Romans 8:38 ..."]'),
    ).toBeVisible();
  });

  test("can toggle to select mode and shows Book combobox", async ({
    operatorPage: page,
  }) => {
    const selectBtn = page.locator(
      'button[title="Browse by book/chapter/verse"]',
    );
    await selectBtn.click();

    // Book combobox trigger should appear with "Book" placeholder
    await expect(page.getByText("Book", { exact: true })).toBeVisible();
  });

  test("can switch back to text mode", async ({ operatorPage: page }) => {
    // Switch to select mode
    const selectBtn = page.locator(
      'button[title="Browse by book/chapter/verse"]',
    );
    await selectBtn.click();
    await expect(page.getByText("Book", { exact: true })).toBeVisible();

    // Switch back to text mode
    const searchBtn = page.locator('button[title="Free-text search"]');
    await searchBtn.click();

    await expect(
      page.locator('input[placeholder="Romans 8:38 ..."]'),
    ).toBeVisible();
  });
});
