import { test, expect } from "../fixtures";

test.describe("Slide Import", () => {
  test("slides tab is visible in the library panel", async ({ operatorPage: page }) => {
    const slidesTab = page.getByRole("button", { name: "Slides" });
    await expect(slidesTab).toBeVisible();
  });

  test("clicking slides tab shows empty state with import button", async ({
    operatorPage: page,
  }) => {
    const slidesTab = page.getByRole("button", { name: "Slides" });
    await slidesTab.click();

    // Empty state should show the "Import PPTX or PDF" button
    const importBtn = page.getByRole("button", { name: /Import PPTX or PDF/i });
    await expect(importBtn).toBeVisible();
  });

  test("slides tab header shows import button when active", async ({
    operatorPage: page,
  }) => {
    const slidesTab = page.getByRole("button", { name: "Slides" });
    await slidesTab.click();

    // The header import button (with title attribute) should be visible
    const headerImportBtn = page.locator('button[title="Import slides from PPTX or PDF"]');
    await expect(headerImportBtn).toBeVisible();
  });

  test("import button is not visible when on scripture tab", async ({
    operatorPage: page,
  }) => {
    // Scripture is the default tab — import button should not be in the header
    const headerImportBtn = page.locator('button[title="Import slides from PPTX or PDF"]');
    await expect(headerImportBtn).not.toBeVisible();
  });
});
