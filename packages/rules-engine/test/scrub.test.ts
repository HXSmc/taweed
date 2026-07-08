import { describe, expect, it } from "vitest";
import {
  scrub,
  SCRUBBER_RULES,
  type ClaimFacts,
  type ScrubRule,
} from "../src/index.js";

// A clean claim that trips NO rule. Every golden case is this base with a
// minimal set of triggering overrides, so a firing is unambiguously attributable.
const CLEAN: ClaimFacts = {
  claimId: "clm-clean",
  payerId: "PAYER-STD",
  hasPreAuth: true,
  patientGender: "female",
  patientAgeYears: 40,
  serviceDate: "2026-01-15",
  policyActive: true,
  sbsCodes: ["SBS-0001"],
  lineUnits: { "SBS-0001": 2 },
  totalAmount: 500,
  isDuplicate: false,
  hasDiagnosis: true,
  hasDocumentation: true,
};

function f(overrides: Partial<ClaimFacts>): ClaimFacts {
  return { ...CLEAN, ...overrides };
}

interface GoldenCase {
  name: string;
  facts: ClaimFacts;
  expect: string[]; // rule ids expected to fire (any order; compared sorted)
  expectUnevaluable?: string[];
}

// GOLDEN SET — the deterministic regression harness (build-plan §9). Exhaustive:
// a clean claim, every rule firing in isolation, an unevaluable (null-fact) case,
// and a multi-flag stack.
const GOLDEN: GoldenCase[] = [
  { name: "clean claim fires nothing", facts: CLEAN, expect: [] },

  {
    name: "D02 missing pre-auth on high-value claim",
    facts: f({ hasPreAuth: false, totalAmount: 2000 }),
    expect: ["R-D02-preauth-highcost"],
  },
  {
    name: "D02 payer pre-auth over unit threshold",
    facts: f({
      payerId: "PAYER-PREAUTH-STRICT",
      hasPreAuth: false,
      sbsCodes: ["SBS-0002"],
      lineUnits: { "SBS-0002": 6 },
    }),
    expect: ["R-D02-preauth-payer-units"],
  },
  {
    name: "D02 payer requires pre-auth for all procedures",
    facts: f({ payerId: "PAYER-ALL-PREAUTH", hasPreAuth: false }),
    expect: ["R-D02-preauth-payer-all"],
  },
  {
    name: "D03 gender / procedure mismatch",
    facts: f({
      patientGender: "male",
      sbsCodes: ["SBS-0003"],
      lineUnits: { "SBS-0003": 1 },
    }),
    expect: ["R-D03-gender-procedure"],
  },
  {
    name: "D03 age / procedure mismatch (adult-only on a minor)",
    facts: f({
      patientAgeYears: 10,
      sbsCodes: ["SBS-0004"],
      lineUnits: { "SBS-0004": 1 },
    }),
    expect: ["R-D03-age-procedure"],
  },
  {
    name: "D04 eligibility gap (policy inactive)",
    facts: f({ policyActive: false }),
    expect: ["R-D04-eligibility-gap"],
  },
  {
    name: "D05 duplicate risk",
    facts: f({ isDuplicate: true }),
    expect: ["R-D05-duplicate-risk"],
  },
  {
    name: "D07 bundling pair A",
    facts: f({
      sbsCodes: ["SBS-0007", "SBS-0008"],
      lineUnits: { "SBS-0007": 1, "SBS-0008": 1 },
    }),
    expect: ["R-D07-bundling-pair"],
  },
  {
    name: "D07 bundling pair B",
    facts: f({
      sbsCodes: ["SBS-0005", "SBS-0009"],
      lineUnits: { "SBS-0005": 1, "SBS-0009": 1 },
    }),
    expect: ["R-D07-bundling-pair-2"],
  },
  {
    name: "D08 quantity exceeds cap",
    facts: f({ sbsCodes: ["SBS-0001"], lineUnits: { "SBS-0001": 15 } }),
    expect: ["R-D08-qty-exceeds-cap"],
  },
  {
    name: "D03 missing diagnosis",
    facts: f({ hasDiagnosis: false }),
    expect: ["R-D03-missing-diagnosis"],
  },
  {
    name: "D01 service not covered",
    facts: f({ sbsCodes: ["SBS-9999"], lineUnits: { "SBS-9999": 1 } }),
    expect: ["R-D01-service-not-covered"],
  },
  {
    name: "D01 payer-excluded service",
    facts: f({
      payerId: "PAYER-NARROW-NET",
      sbsCodes: ["SBS-0006"],
      lineUnits: { "SBS-0006": 1 },
    }),
    expect: ["R-D01-payer-excluded-service"],
  },
  {
    name: "D06 missing supporting documentation",
    facts: f({ hasDocumentation: false }),
    expect: ["R-D06-missing-docs"],
  },
  {
    name: "info unusually high line count",
    facts: f({
      sbsCodes: [
        "SBS-0001",
        "SBS-0010",
        "SBS-0011",
        "SBS-0012",
        "SBS-0013",
        "SBS-0014",
        "SBS-0015",
        "SBS-0016",
        "SBS-0017",
      ],
      lineUnits: { "SBS-0001": 1 },
    }),
    expect: ["R-INFO-line-count"],
  },

  {
    name: "unevaluable: age unknown blocks the age rule (no false pass)",
    facts: f({
      patientAgeYears: null,
      sbsCodes: ["SBS-0004"],
      lineUnits: { "SBS-0004": 1 },
    }),
    expect: [],
    expectUnevaluable: ["R-D03-age-procedure"],
  },

  {
    name: "multi-flag stack drives risk to the ceiling",
    facts: f({
      hasPreAuth: false,
      totalAmount: 2000,
      policyActive: false,
      isDuplicate: true,
      hasDiagnosis: false,
      hasDocumentation: false,
      sbsCodes: ["SBS-0007", "SBS-0008", "SBS-9999"],
      lineUnits: { "SBS-0007": 15, "SBS-0008": 1, "SBS-9999": 1 },
    }),
    expect: [
      "R-D01-service-not-covered",
      "R-D02-preauth-highcost",
      "R-D03-missing-diagnosis",
      "R-D04-eligibility-gap",
      "R-D05-duplicate-risk",
      "R-D06-missing-docs",
      "R-D07-bundling-pair",
      "R-D08-qty-exceeds-cap",
    ],
  },
];

describe("scrub — golden set", () => {
  it.each(GOLDEN.map((g) => [g.name, g] as const))(
    "%s",
    async (_name, gc) => {
      const result = await scrub(gc.facts, SCRUBBER_RULES);

      const firedSorted = result.flags.map((fl) => fl.ruleId).sort();
      expect(firedSorted).toEqual([...gc.expect].sort());

      expect([...result.unevaluable].sort()).toEqual(
        [...(gc.expectUnevaluable ?? [])].sort(),
      );

      // An unevaluable rule must never also appear as a fired flag.
      for (const id of result.unevaluable) {
        expect(firedSorted).not.toContain(id);
      }

      // Every flag is fully traceable: rule id + name + field + both messages.
      for (const flag of result.flags) {
        expect(flag.ruleId.length).toBeGreaterThan(0);
        expect(flag.ruleName.trim().length).toBeGreaterThan(0);
        expect(flag.field.trim().length).toBeGreaterThan(0);
        expect(flag.message_en.trim().length).toBeGreaterThan(0);
        expect(flag.message_ar.trim().length).toBeGreaterThan(0);
      }

      expect(result.claimId).toBe(gc.facts.claimId);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    },
  );
});

describe("scrub — risk scoring & ordering", () => {
  it("a clean claim scores 0", async () => {
    const { riskScore, flags } = await scrub(CLEAN, SCRUBBER_RULES);
    expect(flags).toHaveLength(0);
    expect(riskScore).toBe(0);
  });

  it("a single high-severity rule lands in the 40..60 band", async () => {
    const { riskScore, flags } = await scrub(
      f({ policyActive: false }),
      SCRUBBER_RULES,
    );
    expect(flags).toHaveLength(1);
    expect(riskScore).toBeGreaterThanOrEqual(40);
    expect(riskScore).toBeLessThanOrEqual(60);
  });

  it("stacked flags raise the score above a single flag and clamp at 100", async () => {
    const single = await scrub(f({ policyActive: false }), SCRUBBER_RULES);
    const stacked = await scrub(
      f({
        hasPreAuth: false,
        totalAmount: 2000,
        policyActive: false,
        isDuplicate: true,
        hasDiagnosis: false,
        hasDocumentation: false,
        sbsCodes: ["SBS-0007", "SBS-0008", "SBS-9999"],
        lineUnits: { "SBS-0007": 15, "SBS-0008": 1, "SBS-9999": 1 },
      }),
      SCRUBBER_RULES,
    );
    expect(stacked.riskScore).toBeGreaterThan(single.riskScore);
    expect(stacked.riskScore).toBe(100);
  });

  it("flags are sorted by severity (high first) then weight", async () => {
    const rank = { info: 1, warn: 2, high: 3 } as const;
    const { flags } = await scrub(
      f({
        policyActive: false, // high
        isDuplicate: true, // warn
        hasDocumentation: false, // warn
      }),
      SCRUBBER_RULES,
    );
    expect(flags.length).toBeGreaterThan(1);
    expect(flags[0]?.severity).toBe("high");
    for (let i = 1; i < flags.length; i++) {
      const prev = flags[i - 1];
      const cur = flags[i];
      if (prev && cur) {
        expect(rank[prev.severity]).toBeGreaterThanOrEqual(rank[cur.severity]);
      }
    }
  });
});

// A rule with an authored `any` (OR) group whose two branches read different
// facts — the shape AI-3 authoring supports (author.ts AuthoredGroup) that no
// SHIPPED rule happens to use (SCRUBBER_RULES is all `all`). Regression for the
// audit finding: unevaluableRuleIds used to flatten all/any into one flat set of
// referenced facts and mark the rule unevaluable the moment ANY referenced fact
// was null — even when the OTHER branch of the `any` was already known-true and
// sufficient on its own to fire the rule.
function orRule(): ScrubRule {
  return {
    id: "R-TEST-any-preauth-or-inactive",
    name: "Missing pre-auth or inactive policy",
    scope: "global",
    version: 1,
    severity: "high",
    weight: 40,
    field: "hasPreAuth",
    message_en: "probe",
    message_ar: "probe",
    conditions: {
      any: [
        { fact: "hasPreAuth", operator: "equal", value: false },
        { fact: "policyActive", operator: "equal", value: false },
      ],
    },
    payerId: null,
    tenantId: null,
  };
}

describe("scrub — any/OR groups short-circuit on a known-true branch", () => {
  it("fires via the known-false policyActive branch even though hasPreAuth is null", async () => {
    const result = await scrub(
      f({ hasPreAuth: null, policyActive: false }),
      [orRule()],
    );
    expect(result.unevaluable).not.toContain(orRule().id);
    expect(result.flags.map((fl) => fl.ruleId)).toContain(orRule().id);
  });

  it("stays unevaluable when NEITHER any-branch can be resolved", async () => {
    const result = await scrub(
      f({ hasPreAuth: null, policyActive: null }),
      [orRule()],
    );
    expect(result.unevaluable).toContain(orRule().id);
    expect(result.flags.map((fl) => fl.ruleId)).not.toContain(orRule().id);
  });

  it("stays unevaluable when the known branch is false and the other is null (OR not yet resolved true)", async () => {
    const result = await scrub(
      f({ hasPreAuth: null, policyActive: true }),
      [orRule()],
    );
    expect(result.unevaluable).toContain(orRule().id);
    expect(result.flags.map((fl) => fl.ruleId)).not.toContain(orRule().id);
  });
});
