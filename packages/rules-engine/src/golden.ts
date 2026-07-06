import type { ClaimFacts } from "./types.js";

// EXECUTE B7 / AI-3 — the per-payer golden corpus as DATA (build-plan §9 rule-
// correctness harness). Extracted from the golden test so BOTH the regression test
// (test/payer-golden.test.ts) and the AI-3 authoring gate (author.ts
// checkGoldenRegression) pin behaviour against the exact same cases. A rule edit —
// hand-written OR LLM-authored — that changes any pinned outcome fails loudly.

export interface GoldenCase {
  name: string;
  payerId: string;
  facts: ClaimFacts;
  /** rule ids that MUST fire */
  expectFired: string[];
  /** rule ids that must NOT fire */
  expectNotFired: string[];
}

/** Build a full ClaimFacts from a partial override — the neutral, all-pass base. */
export function goldenFacts(over: Partial<ClaimFacts>): ClaimFacts {
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

export const PAYER_GOLDEN_CASES: GoldenCase[] = [
  {
    name: "strict-preauth payer flags the payer unit rule; a generic payer does not",
    payerId: "PAYER-PREAUTH-STRICT",
    facts: goldenFacts({
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
    facts: goldenFacts({ payerId: "PAYER-NARROW-NET", sbsCodes: ["SBS-0006"] }),
    expectFired: ["R-D01-payer-excluded-service"],
    expectNotFired: ["R-D02-preauth-payer-units"],
  },
];
