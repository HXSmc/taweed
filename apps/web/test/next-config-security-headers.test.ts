import { describe, it, expect, afterEach, vi } from "vitest";

// next.config.mjs's `headers()` wires the app's production security
// response headers (CSP, HSTS, frame/MIME/referrer/permissions hardening —
// see .claude/rules/ecc/web/security.md). Regression coverage for: a future
// edit accidentally dropping a header, weakening the CSP beyond what the app
// actually needs (inline theme-init script + Next's own inline
// hydration/RSC scripts require 'unsafe-inline' on script-src; see the
// comment above `cspHeader` in next.config.mjs for why), or reintroducing
// 'unsafe-eval' in production.
//
// next.config.mjs is wrapped by `withNextIntl(nextConfig)`, but the plugin
// only augments webpack/env config — it passes `headers` and the named
// `securityHeaders` export through untouched, so importing the file directly
// (as plain ESM, no Next runtime needed) is sufficient here.

describe("next.config.mjs — security response headers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("exports the full expected header set via the named securityHeaders export", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", "production");

    // Act
    const { securityHeaders } = await import("../next.config.mjs");
    const byKey = Object.fromEntries(securityHeaders.map((h) => [h.key, h.value]));

    // Assert — every header the task requires is present with the exact
    // required value (except CSP, asserted separately below since it's a
    // composed multi-directive string).
    expect(byKey["Strict-Transport-Security"]).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(byKey["Content-Security-Policy"]).toBeDefined();
  });

  it("builds a CSP that locks down default-src/object-src/frame-ancestors and allows only what the app needs", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", "production");

    // Act
    const { securityHeaders } = await import("../next.config.mjs");
    const csp = securityHeaders.find((h) => h.key === "Content-Security-Policy")?.value ?? "";

    // Assert
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' blob: data:");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    // CSP is collapsed to a single-line header value (no raw newlines).
    expect(csp).not.toMatch(/\n/);
  });

  it("never allows 'unsafe-eval' in a production CSP", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", "production");

    // Act
    const { securityHeaders } = await import("../next.config.mjs");
    const csp = securityHeaders.find((h) => h.key === "Content-Security-Policy")?.value ?? "";

    // Assert — 'unsafe-eval' is a dev-only concession for React's error
    // stack reconstruction; it must never leak into a production response.
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows 'unsafe-eval' only in development, for React's eval-based dev error stacks", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", "development");

    // Act
    const { securityHeaders } = await import("../next.config.mjs");
    const csp = securityHeaders.find((h) => h.key === "Content-Security-Policy")?.value ?? "";

    // Assert
    expect(csp).toContain("'unsafe-eval'");
  });

  it("drops upgrade-insecure-requests only for the plain-HTTP Playwright E2E server", async () => {
    // Arrange — playwright.config.ts sets this for its webServer only; a real
    // deployment never sets it, so upgrade-insecure-requests stays on by
    // default (asserted in the test above).
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TAWEED_HTTP_ONLY_E2E", "1");

    // Act
    const { securityHeaders } = await import("../next.config.mjs");
    const csp = securityHeaders.find((h) => h.key === "Content-Security-Policy")?.value ?? "";

    // Assert
    expect(csp).not.toContain("upgrade-insecure-requests");
    // Everything else in the CSP stays intact — only this one directive drops.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("applies the header set to every route via the default-exported headers() function", async () => {
    // Arrange
    vi.stubEnv("NODE_ENV", "production");

    // Act
    const mod = await import("../next.config.mjs");
    const nextConfig = mod.default;
    if (!nextConfig.headers) throw new Error("next.config.mjs must export a headers() function");
    const rules = await nextConfig.headers();

    // Assert
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/(.*)");
    expect(rules[0].headers).toEqual(mod.securityHeaders);
  });
});
