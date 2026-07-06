import { describe, it, expect } from "vitest";
import {
  scrub,
  selectRulesForClaim,
  SCRUBBER_RULES,
  PAYER_GOLDEN_CASES,
} from "@taweed/rules-engine";

// EXECUTE B7 / AI-3 — per-payer golden set (build-plan §8 wk10, §9 rule-correctness
// harness). The corpus now lives in src/golden.ts so this test AND the AI-3
// authoring gate (checkGoldenRegression) pin behaviour against the SAME cases —
// a rule edit that changes payer behaviour fails loudly in both places.
// selectRulesForClaim scopes the library to the claim's payer before scrubbing.

describe("payer-scoped golden set", () => {
  for (const c of PAYER_GOLDEN_CASES) {
    it(c.name, async () => {
      const rules = selectRulesForClaim(SCRUBBER_RULES, { payerId: c.payerId });
      const result = await scrub(c.facts, rules);
      const fired = new Set(result.flags.map((f) => f.ruleId));
      for (const id of c.expectFired) expect(fired).toContain(id);
      for (const id of c.expectNotFired) expect(fired.has(id)).toBe(false);
    });
  }

  it("a payer rule for another payer is not even selected for this claim", () => {
    const rules = selectRulesForClaim(SCRUBBER_RULES, {
      payerId: "PAYER-PREAUTH-STRICT",
    });
    const ids = rules.map((r) => r.id);
    // The narrow-net payer rule belongs to a different payer, so it is absent.
    expect(ids).not.toContain("R-D01-payer-excluded-service");
    // Global rules are always present.
    expect(ids).toContain("R-D02-preauth-highcost");
  });
});
