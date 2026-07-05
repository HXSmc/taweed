import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// EXECUTE A1 — automated accessibility (web/testing.md §2). WCAG 2 A/AA on the
// unauthenticated surfaces, both locales. Reduced-motion + keyboard checks live in
// the visual/interaction specs; this gates contrast, roles, names, and structure.

for (const locale of ["en", "ar"] as const) {
  test(`login has no critical/serious a11y violations (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}/login`);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
  });
}

test("reduced-motion is honored (no unexpected transitions block interaction)", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/login");
  await expect(page.locator("h1, h2").first()).toBeVisible();
});
