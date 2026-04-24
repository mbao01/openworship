import AxeBuilder from "@axe-core/playwright";
import { test, expect, stubTauriIdentity } from "../fixtures";

test.describe("Accessibility — WCAG 2.x AA", () => {
  test("operator page has no critical a11y violations", async ({ page }) => {
    await stubTauriIdentity(page);
    await page.goto("/");
    await page.waitForSelector('[data-qa="operator-root"]', {
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(
      results.violations,
      `Axe found ${results.violations.length} violation(s):\n` +
        results.violations
          .map(
            (v) =>
              `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`,
          )
          .join("\n"),
    ).toEqual([]);
  });

  test("display page has no critical a11y violations", async ({ page }) => {
    await page.goto("/display");
    await page.waitForSelector('[data-qa="display-root"]', {
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(
      results.violations,
      `Axe found ${results.violations.length} violation(s):\n` +
        results.violations
          .map(
            (v) =>
              `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`,
          )
          .join("\n"),
    ).toEqual([]);
  });
});
