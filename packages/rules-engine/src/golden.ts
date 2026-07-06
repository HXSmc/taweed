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

// Global cases run under a payer with no payer-scoped rules, so only the global
// library is in play and each firing is unambiguous. `GLOBAL_PAYER` matches the
// goldenFacts default so nothing payer-scoped is selected.
const GLOBAL_PAYER = "PAYER-GENERIC";

// The gender/age anti-false-positive pins (R-D03-gender-procedure must fire ONLY
// for a female-only procedure on a male claim, never on a bare male claim) guard
// the same class of defect as the engine `in`/`notIn` substring fix — a rule edit
// that widens the gender predicate is caught here too.
export const PAYER_GOLDEN_CASES: GoldenCase[] = [
  // --- payer-scoped ---
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
  // --- global: a clean claim trips nothing ---
  {
    name: "clean claim fires no global rule",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({}),
    expectFired: [],
    expectNotFired: [
      "R-D02-preauth-highcost",
      "R-D03-gender-procedure",
      "R-D04-eligibility-gap",
    ],
  },
  // --- global: each rule family firing in isolation ---
  {
    name: "missing pre-auth on a high-value claim",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({ hasPreAuth: false, totalAmount: 2000 }),
    expectFired: ["R-D02-preauth-highcost"],
    expectNotFired: ["R-D03-gender-procedure"],
  },
  {
    name: "female-only procedure on a MALE claim fires the gender rule",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({ patientGender: "male", sbsCodes: ["SBS-0003"] }),
    expectFired: ["R-D03-gender-procedure"],
    expectNotFired: [],
  },
  {
    name: "a bare MALE claim (no female-only procedure) does NOT fire the gender rule",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({ patientGender: "male", sbsCodes: ["SBS-0001"] }),
    expectFired: [],
    expectNotFired: ["R-D03-gender-procedure"],
  },
  {
    name: "adult-only procedure on a minor fires the age rule",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({ sbsCodes: ["SBS-0004"], patientAgeYears: 10 }),
    expectFired: ["R-D03-age-procedure"],
    expectNotFired: ["R-D03-gender-procedure"],
  },
  {
    name: "inactive policy on the service date fires the eligibility rule",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({ policyActive: false }),
    expectFired: ["R-D04-eligibility-gap"],
    expectNotFired: [],
  },
  {
    name: "a flagged duplicate fires the duplicate rule",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({ isDuplicate: true }),
    expectFired: ["R-D05-duplicate-risk"],
    expectNotFired: [],
  },
  {
    name: "a missing diagnosis code fires the diagnosis rule",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({ hasDiagnosis: false }),
    expectFired: ["R-D03-missing-diagnosis"],
    expectNotFired: [],
  },
  {
    name: "a non-covered service fires the coverage rule",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({ sbsCodes: ["SBS-9999"] }),
    expectFired: ["R-D01-service-not-covered"],
    expectNotFired: [],
  },
  {
    name: "missing documentation fires the docs rule",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({ hasDocumentation: false }),
    expectFired: ["R-D06-missing-docs"],
    expectNotFired: [],
  },
  {
    name: "a line quantity over the cap fires the quantity rule",
    payerId: GLOBAL_PAYER,
    facts: goldenFacts({ sbsCodes: ["SBS-0001"], lineUnits: { "SBS-0001": 12 } }),
    expectFired: ["R-D08-qty-exceeds-cap"],
    expectNotFired: [],
  },
];
