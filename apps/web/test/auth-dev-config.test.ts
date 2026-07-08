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
  beforeEach(() => {
    // auth.ts reads these env vars at module-import time, so each test needs a
    // fresh module instance to observe a different combination.
    vi.resetModules();
  });

  afterEach(() => {
    // vi.stubEnv is the type-safe way to mutate process.env in a test — plain
    // `process.env.NODE_ENV = ...` / `delete process.env.NODE_ENV` don't
    // typecheck under modern @types/node, which marks NODE_ENV readonly.
    vi.unstubAllEnvs();
  });

  it("stays disabled when NODE_ENV is unset (e.g. a custom server that never sets it)", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", undefined);
    vi.stubEnv("TAWEED_ENABLE_DEV_AUTH", undefined);

    // Act
    const { DEV_AUTH_ENABLED } = await import("../lib/auth");

    // Assert — the old `!IS_PROD` deny-list would have flipped this true.
    expect(DEV_AUTH_ENABLED).toBe(false);
  });

  it("stays disabled for a misconfigured non-'production' NODE_ENV like 'staging'", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("TAWEED_ENABLE_DEV_AUTH", undefined);

    // Act
    const { DEV_AUTH_ENABLED } = await import("../lib/auth");

    // Assert
    expect(DEV_AUTH_ENABLED).toBe(false);
  });

  it("enables dev auth for genuine local development (NODE_ENV=development)", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TAWEED_ENABLE_DEV_AUTH", undefined);

    // Act
    const { DEV_AUTH_ENABLED } = await import("../lib/auth");

    // Assert
    expect(DEV_AUTH_ENABLED).toBe(true);
  });

  it("enables dev auth under an explicit TAWEED_ENABLE_DEV_AUTH=1 opt-in even when NODE_ENV=production (matches the e2e webServer)", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TAWEED_ENABLE_DEV_AUTH", "1");

    // Act
    const { DEV_AUTH_ENABLED } = await import("../lib/auth");

    // Assert
    expect(DEV_AUTH_ENABLED).toBe(true);
  });

  it("stays disabled in production without the explicit opt-in", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TAWEED_ENABLE_DEV_AUTH", undefined);

    // Act
    const { DEV_AUTH_ENABLED } = await import("../lib/auth");

    // Assert
    expect(DEV_AUTH_ENABLED).toBe(false);
  });

  it("falls back to the public dev secret only when DEV_AUTH_ENABLED is true, never merely because NODE_ENV isn't 'production'", async () => {
    // Arrange — the exact misconfiguration from the audit: no AUTH_SECRET, and
    // an NODE_ENV that is neither "production" nor "development".
    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("TAWEED_ENABLE_DEV_AUTH", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);

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
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TAWEED_ENABLE_DEV_AUTH", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);

    // Act
    const { RESOLVED_AUTH_SECRET } = await import("../lib/auth");
    const { DEV_INSECURE_AUTH_SECRET } = await import("../lib/dev-auth-secret");

    // Assert
    expect(RESOLVED_AUTH_SECRET).toBe(DEV_INSECURE_AUTH_SECRET);
  });

  it("prefers a real AUTH_SECRET from the environment even when dev auth is enabled", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", "a-real-production-secret");

    // Act
    const { RESOLVED_AUTH_SECRET } = await import("../lib/auth");

    // Assert
    expect(RESOLVED_AUTH_SECRET).toBe("a-real-production-secret");
  });
});
