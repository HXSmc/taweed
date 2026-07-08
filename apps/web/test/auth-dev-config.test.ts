import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// lib/auth.ts's own env-var-driven fail-closed logic (DEV_AUTH_ENABLED /
// RESOLVED_AUTH_SECRET) has no dependency on next-auth or the db layer at
// all — but importing the module still evaluates `import NextAuth from
// "next-auth"` and `./db` at the top. Stub both so this test exercises only
// the logic under test, not next-auth's own module resolution (which, in
// this pnpm workspace's current dependency layout, cannot even be loaded
// outside a real Next.js build) or a real Postgres connection.
vi.mock("next-auth", () => ({
  default: (config: unknown) => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    __config: config,
  }),
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: (config: unknown) => config,
}));
vi.mock("../lib/db", () => ({
  findUserByEmail: vi.fn(),
}));

// Regression coverage for the audit finding: DEV_AUTH_ENABLED (and the
// AUTH_SECRET dev fallback, which reuses the same boolean) must be an
// ALLOW-list ("is NODE_ENV explicitly 'development'?"), not a DENY-list
// ("is NODE_ENV anything other than exactly 'production'?"). A deny-list
// fails OPEN — exposing the passwordless Credentials('dev') provider and the
// public DEV_INSECURE_AUTH_SECRET fallback — whenever NODE_ENV is unset,
// misspelled, or set to something like "staging" by a non-`next start` host
// (custom Docker/PM2/systemd start script, some PaaS defaults). The only
// affirmative way to enable dev auth outside real local development is the
// explicit TAWEED_ENABLE_DEV_AUTH=1 opt-in (used by the e2e webServer, which
// runs a real `next start` production build — see playwright.config.ts).

describe("lib/auth — DEV_AUTH_ENABLED fail-closed gating", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevFlag = process.env.TAWEED_ENABLE_DEV_AUTH;
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    // auth.ts reads these env vars at module-import time, so each test needs a
    // fresh module instance to observe a different combination.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalDevFlag === undefined) {
      delete process.env.TAWEED_ENABLE_DEV_AUTH;
    } else {
      process.env.TAWEED_ENABLE_DEV_AUTH = originalDevFlag;
    }
    if (originalAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalAuthSecret;
    }
  });

  it("stays disabled when NODE_ENV is unset (e.g. a custom server that never sets it)", async () => {
    // Arrange
    delete process.env.NODE_ENV;
    delete process.env.TAWEED_ENABLE_DEV_AUTH;

    // Act
    const { DEV_AUTH_ENABLED } = await import("../lib/auth");

    // Assert — the old `!IS_PROD` deny-list would have flipped this true.
    expect(DEV_AUTH_ENABLED).toBe(false);
  });

  it("stays disabled for a misconfigured non-'production' NODE_ENV like 'staging'", async () => {
    // Arrange
    process.env.NODE_ENV = "staging";
    delete process.env.TAWEED_ENABLE_DEV_AUTH;

    // Act
    const { DEV_AUTH_ENABLED } = await import("../lib/auth");

    // Assert
    expect(DEV_AUTH_ENABLED).toBe(false);
  });

  it("enables dev auth for genuine local development (NODE_ENV=development)", async () => {
    // Arrange
    process.env.NODE_ENV = "development";
    delete process.env.TAWEED_ENABLE_DEV_AUTH;

    // Act
    const { DEV_AUTH_ENABLED } = await import("../lib/auth");

    // Assert
    expect(DEV_AUTH_ENABLED).toBe(true);
  });

  it("enables dev auth under an explicit TAWEED_ENABLE_DEV_AUTH=1 opt-in even when NODE_ENV=production (matches the e2e webServer)", async () => {
    // Arrange
    process.env.NODE_ENV = "production";
    process.env.TAWEED_ENABLE_DEV_AUTH = "1";

    // Act
    const { DEV_AUTH_ENABLED } = await import("../lib/auth");

    // Assert
    expect(DEV_AUTH_ENABLED).toBe(true);
  });

  it("stays disabled in production without the explicit opt-in", async () => {
    // Arrange
    process.env.NODE_ENV = "production";
    delete process.env.TAWEED_ENABLE_DEV_AUTH;

    // Act
    const { DEV_AUTH_ENABLED } = await import("../lib/auth");

    // Assert
    expect(DEV_AUTH_ENABLED).toBe(false);
  });

  it("falls back to the public dev secret only when DEV_AUTH_ENABLED is true, never merely because NODE_ENV isn't 'production'", async () => {
    // Arrange — the exact misconfiguration from the audit: no AUTH_SECRET, and
    // an NODE_ENV that is neither "production" nor "development".
    process.env.NODE_ENV = "staging";
    delete process.env.TAWEED_ENABLE_DEV_AUTH;
    delete process.env.AUTH_SECRET;

    // Act
    const { DEV_AUTH_ENABLED, RESOLVED_AUTH_SECRET } = await import("../lib/auth");

    // Assert — DEV_AUTH_ENABLED false means the module must NOT wire up the
    // public dev secret; NextAuth is left to fail closed (MissingSecret)
    // rather than sign/verify JWTs with a string published in this repo.
    expect(DEV_AUTH_ENABLED).toBe(false);
    expect(RESOLVED_AUTH_SECRET).toBeUndefined();
  });

  it("uses the public dev secret when DEV_AUTH_ENABLED is legitimately true and no real AUTH_SECRET is set", async () => {
    // Arrange
    process.env.NODE_ENV = "development";
    delete process.env.TAWEED_ENABLE_DEV_AUTH;
    delete process.env.AUTH_SECRET;

    // Act
    const { RESOLVED_AUTH_SECRET } = await import("../lib/auth");
    const { DEV_INSECURE_AUTH_SECRET } = await import("../lib/dev-auth-secret");

    // Assert
    expect(RESOLVED_AUTH_SECRET).toBe(DEV_INSECURE_AUTH_SECRET);
  });

  it("prefers a real AUTH_SECRET from the environment even when dev auth is enabled", async () => {
    // Arrange
    process.env.NODE_ENV = "development";
    process.env.AUTH_SECRET = "a-real-production-secret";

    // Act
    const { RESOLVED_AUTH_SECRET } = await import("../lib/auth");

    // Assert
    expect(RESOLVED_AUTH_SECRET).toBe("a-real-production-secret");
  });
});
