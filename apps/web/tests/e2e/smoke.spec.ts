import { test, expect } from "@playwright/test";

// EXECUTE A1 — smoke: the app boots and locale routing mirrors EN/AR. Runs without
// a session (login is the unauthenticated entry). Deterministic waits only.

test("unauthenticated root redirects into the localized login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(ar|en)\/login/);
  await expect(page.locator("h1, h2").first()).toBeVisible();
});

test("Arabic surface renders RTL", async ({ page }) => {
  await page.goto("/ar/login");
  const dir = await page.locator("html").getAttribute("dir");
  expect(dir).toBe("rtl");
});

test("English surface renders LTR", async ({ page }) => {
  await page.goto("/en/login");
  const dir = await page.locator("html").getAttribute("dir");
  expect(dir).toBe("ltr");
});
