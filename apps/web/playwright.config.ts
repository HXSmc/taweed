import { defineConfig, devices } from "@playwright/test";

// EXECUTE A1 — E2E + visual-regression + a11y at the design-brief breakpoints
// (320/768/1024/1440 x light/dark x EN/AR). The webServer builds + starts the app
// against a seeded local Postgres; CI (.github/workflows/ci.yml e2e job) provides
// the Postgres service + seed. Dev auth is enabled for the run so the money arc
// (login -> analytics -> scrubber -> appeal -> recovery) is drivable.

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Deterministic waits only — no arbitrary timeouts (web/testing.md).
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Design-brief breakpoints x browsers. Visual specs assert at each width; the
  // money-arc spec runs on desktop chromium to keep the suite fast.
  projects: [
    { name: "chromium-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "chromium-1024", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "mobile-320", use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 640 } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    // Assumes `pnpm build` already ran; `pnpm start` serves the production build.
    command: "pnpm start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      TAWEED_ENABLE_DEV_AUTH: "1",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgres://taweed:taweed@localhost:5432/taweed",
    },
  },
});
