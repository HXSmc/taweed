import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DEV_INSECURE_AUTH_SECRET } from "../lib/dev-auth-secret";

// Regression coverage for the audit finding: playwright.config.ts's webServer
// AUTH_SECRET fallback must be sourced from the single shared constant
// (lib/dev-auth-secret.ts) also used by lib/auth.ts, not a second hardcoded
// copy of the literal string. A duplicated literal raises the odds that a
// future copy-paste carries the known-insecure value into a real environment
// config.

describe("playwright.config webServer AUTH_SECRET fallback", () => {
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    // The config module reads process.env.AUTH_SECRET at import time, so each
    // test needs a fresh module instance to observe a different env value.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalAuthSecret;
    }
  });

  it("falls back to the shared DEV_INSECURE_AUTH_SECRET constant when unset", async () => {
    // Arrange
    delete process.env.AUTH_SECRET;

    // Act
    const { default: config } = await import("../playwright.config");
    const webServer = config.webServer as { env?: Record<string, string> };

    // Assert — same constant as lib/auth.ts, not an independently duplicated string.
    expect(webServer.env?.AUTH_SECRET).toBe(DEV_INSECURE_AUTH_SECRET);
  });

  it("prefers a real AUTH_SECRET from the environment when one is set", async () => {
    // Arrange
    process.env.AUTH_SECRET = "test-provided-secret";

    // Act
    const { default: config } = await import("../playwright.config");
    const webServer = config.webServer as { env?: Record<string, string> };

    // Assert
    expect(webServer.env?.AUTH_SECRET).toBe("test-provided-secret");
  });
});
