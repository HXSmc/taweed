import { test, expect } from "@playwright/test";

// AI-4 review-queue surface (plan 04 §9). No unit/component test harness exists
// in apps/web (no vitest/RTL — see web/testing.md's Playwright-first priority
// order, and the rest of this app's "approval UI" precedent, e.g. rule-authoring,
// is likewise only exercised by e2e, not a component test); this mirrors the
// existing smoke.spec.ts / money-arc.spec.ts pattern (deterministic waits, real
// seeded login, no arbitrary timeouts).
//
// The seed script (scripts/seed.ts) does not seed any eob_extractions rows, so
// this only asserts the surface itself: an rcm user (full ingest capability, and
// one of the two review-action roles) reaches the Review queue tab and sees the
// graceful EMPTY-QUEUE state — never a crash, never a broken image placeholder.
// A later pass that seeds a pending_review row can extend this to the
// correct-and-approve flow itself.
const RCM_EMAIL = process.env.E2E_RCM_EMAIL ?? "rcm@al-salama-dental-gro.dev";

test.describe("EOB review queue (seeded DB)", () => {
  test("rcm user reaches the review queue tab and sees the empty-queue state", async ({
    page,
  }) => {
    await page.goto("/en/login");
    // Dev sign-in is a demo-account PICKER (app/[locale]/(auth)/login/page.tsx):
    // each seeded account is a submit button that mints its own session.
    await page.getByRole("button", { name: RCM_EMAIL }).click();
    await page.waitForURL(/\/en\/(overview|analytics)/);

    await page.goto("/en/ingest");
    await expect(page.getByRole("tab", { name: /review queue/i })).toBeVisible();
    await page.getByRole("tab", { name: /review queue/i }).click();

    // Empty queue: the graceful empty state renders, never a crash and never a
    // broken <img> standing in for a page preview.
    await expect(page.getByText(/queue is clear/i)).toBeVisible();
  });
});
