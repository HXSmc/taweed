import { describe, it, expect } from "vitest";
import {
  scrub,
  selectRulesForClaim,
  SCRUBBER_RULES,
  type ClaimFacts,
} from "@taweed/rules-engine";

// EXECUTE B7 — per-payer golden set (build-plan §8 wk10, §9 rule-correctness
// harness). Each case pins the EXACT rule ids a payer's tuned rule set must raise
// for a given claim, so a rule edit that changes payer behavior fails loudly.
// selectRulesForClaim scopes the library to the claim's payer before scrubbing.

interface GoldenCase {
  name: string;
  payerId: string;
  facts: ClaimFacts;
  expectFired: string[]; // rule ids that MUST fire
  expectNotFired: string[]; // rule ids that must NOT fire
}

function facts(over: Partial<ClaimFacts>): ClaimFacts {
  return {
    claimId: "c1",
    payerId: "PAYER-GENERIC",
    hasPreAuth: true,
    patientGender: "female",
    patientAgeYears: 40,
    serviceDate: "2026-01-01",
    policyActive: true,
    sbsCodes: [],
    lineUnits: {},
    totalAmount: 100,
    isDuplicate: false,
    hasDiagnosis: true,
    hasDocumentation: true,
    ...over,
  };
}

const CASES: GoldenCase[] = [
  {
    name: "strict-preauth payer flags the payer unit rule; a generic payer does not",
    payerId: "PAYER-PREAUTH-STRICT",
    facts: facts({
      payerId: "PAYER-PREAUTH-STRICT",
      hasPreAuth: false,
      sbsCodes: ["SBS-0002"],
      lineUnits: { "SBS-0002": 6 },
    }),
    expectFired: ["R-D02-preauth-payer-units"],
    expectNotFired: ["R-D01-payer-excluded-service"],
  },
  {
    name: "narrow-network payer excludes a service; other payers do not",
    payerId: "PAYER-NARROW-NET",
    facts: facts({ payerId: "PAYER-NARROW-NET", sbsCodes: ["SBS-0006"] }),
    expectFired: ["R-D01-payer-excluded-service"],
    expectNotFired: ["R-D02-preauth-payer-units"],
  },
];

describe("payer-scoped golden set", () => {
  for (const c of CASES) {
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
