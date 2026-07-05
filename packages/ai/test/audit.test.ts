import { describe, it, expect } from "vitest";
import { sanitizeLlmCallRow } from "../src/audit.js";

const base = {
  actorId: "user-1",
  purpose: "explain",
  model: "claude-haiku-4-5",
  provider: "fixture",
  promptSha256: "a".repeat(64),
  outputSha256: "b".repeat(64),
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
};

describe("sanitizeLlmCallRow (PHI/raw-text leak guard)", () => {
  it("accepts a well-formed hashes-only row", () => {
    const safe = sanitizeLlmCallRow({ ...base });
    expect(safe.actorId).toBe("user-1");
    expect(safe.promptSha256).toBe("a".repeat(64));
  });

  it("rejects any key outside the allowlist (e.g. a raw prompt)", () => {
    expect(() =>
      sanitizeLlmCallRow({ ...base, prompt: "the patient is John Doe" }),
    ).toThrow(/unexpected key "prompt"/);
  });

  it("rejects raw text routed into a *_sha256 column", () => {
    expect(() =>
      sanitizeLlmCallRow({ ...base, promptSha256: "the patient is John Doe" }),
    ).toThrow(/64-char sha256/);
  });

  it("rejects a negative token count", () => {
    expect(() => sanitizeLlmCallRow({ ...base, inputTokens: -1 })).toThrow(
      /non-negative integer/,
    );
  });

  it("keeps optional fields optional", () => {
    const safe = sanitizeLlmCallRow({ ...base });
    expect(safe.requestId).toBeUndefined();
    expect(safe.latencyMs).toBeUndefined();
  });
});
