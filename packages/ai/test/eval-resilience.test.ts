import { describe, it, expect } from "vitest";
import {
  classifyEvalError,
  computeLatencyStats,
  buildRunMeta,
  runEvalLoop,
  BALANCE_EXHAUSTED_RE,
  RATE_LIMIT_RE,
} from "../evals/resilience.js";

// Real error message strings verified live via web search 2026-07-24 (not
// invented) — see resilience.ts's doc comment for sources. The check-order
// case (GLM balance-exhaustion is itself HTTP 429) is the load-bearing
// regression to guard: if BALANCE_EXHAUSTED_RE ever stops matching before
// RATE_LIMIT_RE in the classifier, every GLM balance-exhausted run would be
// silently misfiled as "wait and retry" instead of "recharge and rerun".
describe("classifyEvalError", () => {
  it("classifies Anthropic's real low-credit message as balance", () => {
    expect(
      classifyEvalError(
        "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
      ),
    ).toBe("balance");
  });

  it("classifies GLM's real balance-exhausted message (itself HTTP 429) as balance, not rate-limit", () => {
    const msg =
      "429 Insufficient balance or no resource package. Please recharge. (code 1113)";
    // Structural guard: this message DOES also match the generic rate-limit
    // pattern (it contains "429") — the classifier must prefer "balance".
    expect(RATE_LIMIT_RE.test(msg)).toBe(true);
    expect(BALANCE_EXHAUSTED_RE.test(msg)).toBe(true);
    expect(classifyEvalError(msg)).toBe("balance");
  });

  it("classifies OpenAI-style insufficient_quota as balance", () => {
    expect(
      classifyEvalError("You exceeded your current quota, insufficient_quota"),
    ).toBe("balance");
  });

  it("classifies a genuine rate limit (no balance wording) as rate-limit", () => {
    expect(
      classifyEvalError("429 RESOURCE_EXHAUSTED: rate limit exceeded, retry later"),
    ).toBe("rate-limit");
  });

  it("classifies a schema-validation failure as schema-invalid", () => {
    expect(
      classifyEvalError("Error: AI response failed schema validation for EobExtraction"),
    ).toBe("schema-invalid");
  });

  it("classifies a timeout as transient", () => {
    expect(classifyEvalError("Error: Request timed out.")).toBe("transient");
  });

  it("classifies an unrelated error as real-bug (fails loud, not swallowed)", () => {
    expect(classifyEvalError("TypeError: cannot read properties of undefined")).toBe(
      "real-bug",
    );
  });
});

describe("computeLatencyStats", () => {
  it("returns zeroed stats for an empty array (no division by zero)", () => {
    expect(computeLatencyStats([])).toEqual({
      minMs: 0,
      maxMs: 0,
      avgMs: 0,
      totalMs: 0,
      sampleCount: 0,
    });
  });

  it("computes min/max/avg/total correctly", () => {
    expect(computeLatencyStats([10, 20, 30])).toEqual({
      minMs: 10,
      maxMs: 30,
      avgMs: 20,
      totalMs: 60,
      sampleCount: 3,
    });
  });
});

describe("buildRunMeta", () => {
  it("marks a balance-exhausted stop as excluded with a recharge reason", () => {
    const meta = buildRunMeta({
      provider: "glm-1p",
      model: "glm-5.2",
      fullCorpusSize: 12,
      scoredCount: 4,
      skippedDocIds: [],
      stopReason: "balance-exhausted",
      latencies: [100, 200],
    });
    expect(meta.excluded).toBe(true);
    expect(meta.excludedReason).toMatch(/recharge/i);
  });

  it("does NOT mark a completed run as excluded", () => {
    const meta = buildRunMeta({
      provider: "anthropic-1p",
      model: "claude-sonnet",
      fullCorpusSize: 12,
      scoredCount: 12,
      skippedDocIds: [],
      stopReason: "completed",
      latencies: [100, 200],
    });
    expect(meta.excluded).toBe(false);
    expect(meta.excludedReason).toBeUndefined();
  });

  it("does NOT mark a rate-limit stop as excluded (partial data is still real)", () => {
    const meta = buildRunMeta({
      provider: "gemini-1p",
      model: "gemini-3.1-pro-preview",
      fullCorpusSize: 12,
      scoredCount: 7,
      skippedDocIds: [],
      stopReason: "rate-limit",
      latencies: [100],
    });
    expect(meta.excluded).toBe(false);
  });
});

// The shared eval loop is the single place balance/rate-limit/transient/
// schema-invalid/real-bug handling lives for every (feature, provider) eval
// file — these are the load-bearing regression tests for that contract.
// `call` and `score` are separate params (see resilience.ts's doc comment on
// why) — most tests below use an identity `score` since they're only
// exercising the call/classification behavior.
const identity = <T>(r: T) => r;

describe("runEvalLoop", () => {
  it("processes every item and reports completed when nothing fails", async () => {
    const result = await runEvalLoop(
      [1, 2, 3],
      (n) => `item-${n}`,
      async (n) => n * 2,
      identity,
      () => -1,
      "[test]",
    );
    expect(result.checks).toEqual([2, 4, 6]);
    expect(result.stopReason).toBe("completed");
    expect(result.skipped).toEqual([]);
    expect(result.latencies).toHaveLength(3);
  });

  it("only times the call step, not the score step (fair cross-feature latency)", async () => {
    const result = await runEvalLoop(
      [1],
      (n) => `item-${n}`,
      async (n) => n,
      async (n) => {
        // Simulate authorRule-shaped scoring: real async local work that has
        // nothing to do with provider speed. If this leaked into the timed
        // span, latencies[0] would be >=50ms; it must not.
        await new Promise((resolve) => setTimeout(resolve, 50));
        return n * 100;
      },
      () => -1,
      "[test]",
    );
    expect(result.checks).toEqual([100]);
    expect(result.latencies[0]).toBeLessThan(50);
  });

  it("scores a schema-invalid item as a miss via onSchemaInvalid and keeps going", async () => {
    const result = await runEvalLoop(
      [1, 2, 3],
      (n) => `item-${n}`,
      async (n) => {
        if (n === 2) throw new Error("AI response failed schema validation for X");
        return n;
      },
      identity,
      () => -1,
      "[test]",
    );
    expect(result.checks).toEqual([1, -1, 3]);
    expect(result.stopReason).toBe("completed");
  });

  it("stops immediately on balance-exhausted, excluding remaining items", async () => {
    const result = await runEvalLoop(
      [1, 2, 3],
      (n) => `item-${n}`,
      async (n) => {
        if (n === 2) throw new Error("Insufficient balance or no resource package.");
        return n;
      },
      identity,
      () => -1,
      "[test]",
    );
    expect(result.checks).toEqual([1]);
    expect(result.stopReason).toBe("balance-exhausted");
  });

  it("stops early on rate-limit, keeping whatever already scored", async () => {
    const result = await runEvalLoop(
      [1, 2, 3],
      (n) => `item-${n}`,
      async (n) => {
        if (n === 2) throw new Error("429 RESOURCE_EXHAUSTED");
        return n;
      },
      identity,
      () => -1,
      "[test]",
    );
    expect(result.checks).toEqual([1]);
    expect(result.stopReason).toBe("rate-limit");
  });

  it("skips a transient error and keeps going", async () => {
    const result = await runEvalLoop(
      [1, 2, 3],
      (n) => `item-${n}`,
      async (n) => {
        if (n === 2) throw new Error("Request timed out.");
        return n;
      },
      identity,
      () => -1,
      "[test]",
    );
    expect(result.checks).toEqual([1, 3]);
    expect(result.skipped).toEqual(["item-2"]);
    expect(result.stopReason).toBe("completed");
  });

  it("trips the circuit breaker after 8 consecutive transient errors", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = await runEvalLoop(
      items,
      (n) => `item-${n}`,
      async (n) => {
        if (n >= 1) throw new Error("Request timed out.");
        return n;
      },
      identity,
      () => -1,
      "[test]",
    );
    expect(result.stopReason).toBe("circuit-breaker");
    expect(result.skipped).toHaveLength(8);
  });

  it("rethrows a real bug immediately, never swallowing it", async () => {
    await expect(
      runEvalLoop(
        [1],
        (n) => `item-${n}`,
        async () => {
          throw new TypeError("cannot read properties of undefined");
        },
        identity,
        () => -1,
        "[test]",
      ),
    ).rejects.toThrow("cannot read properties of undefined");
  });
});
