import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  isAiEnabled,
  isFeatureEnabled,
  featureEnvVar,
  missingProviderConfig,
} from "../src/config.js";

// `server-only` is aliased to a no-op stub for the vitest/Node runtime (see
// vitest.workspace.ts), so a runtime import can never observe whether the
// guard is present here — the real client-bundle failure only happens under
// `next build`. Assert on the source text instead, matching every other
// secret-adjacent file in this package (run.ts, anthropic-1p.ts, audit.ts).
describe("server-only guard (defense in depth)", () => {
  it("imports 'server-only' — this module reads ANTHROPIC_API_KEY and drives the AI kill switches", () => {
    const configSource = readFileSync(
      fileURLToPath(new URL("../src/config.ts", import.meta.url)),
      "utf8",
    );
    expect(configSource).toMatch(/^import\s+["']server-only["'];\s*$/m);
  });
});

describe("isAiEnabled (fails closed)", () => {
  it("is false when the switch is unset", () => {
    expect(isAiEnabled({})).toBe(false);
  });

  it("is true only for the exact string 'true'", () => {
    expect(isAiEnabled({ TAWEED_AI_ENABLED: "true" })).toBe(true);
  });

  it.each(["false", "1", "TRUE", "", "yes"])(
    "is false for the truthy-looking value %j",
    (value) => {
      expect(isAiEnabled({ TAWEED_AI_ENABLED: value })).toBe(false);
    },
  );
});

describe("isFeatureEnabled (defense in depth)", () => {
  it("is false when the global switch is off, even if the feature flag is on", () => {
    expect(
      isFeatureEnabled("explain", { TAWEED_AI_EXPLAIN_ENABLED: "true" }),
    ).toBe(false);
  });

  it("is false when global is on but the feature flag is unset", () => {
    expect(isFeatureEnabled("explain", { TAWEED_AI_ENABLED: "true" })).toBe(
      false,
    );
  });

  it("is true only when both global and feature flags are 'true'", () => {
    expect(
      isFeatureEnabled("explain", {
        TAWEED_AI_ENABLED: "true",
        TAWEED_AI_EXPLAIN_ENABLED: "true",
      }),
    ).toBe(true);
  });

  it("exposes the backing env var name", () => {
    expect(featureEnvVar("explain")).toBe("TAWEED_AI_EXPLAIN_ENABLED");
  });
});

describe("missingProviderConfig (enabled-but-unconfigured fails loud)", () => {
  it("reports a reason when ANTHROPIC_API_KEY is absent", () => {
    expect(missingProviderConfig({})).not.toBeNull();
  });

  it("reports a reason for a blank/whitespace-only key", () => {
    expect(missingProviderConfig({ ANTHROPIC_API_KEY: "   " })).not.toBeNull();
  });

  it("returns null when a non-empty key is present", () => {
    expect(
      missingProviderConfig({ ANTHROPIC_API_KEY: "sk-ant-xxx" }),
    ).toBeNull();
  });
});
