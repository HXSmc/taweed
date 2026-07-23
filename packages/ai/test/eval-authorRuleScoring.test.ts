import { describe, it, expect } from "vitest";
import {
  SCRUBBER_RULES,
  type AuthoredRuleDraft,
  type AuthoredConditionNode,
} from "@taweed/rules-engine";
import {
  extractLeaves,
  scoreAuthorRule,
  buildAuthorRuleReport,
  schemaInvalidAuthorRuleCheck,
  type AuthorRuleFixture,
} from "../evals/authorRuleScoring.js";

const FIXTURE: AuthorRuleFixture = {
  id: "preauth-missing",
  smeText: "Flag any claim over 1000 SAR that has no prior authorization on file.",
  scope: { scope: "global" },
  expected: {
    severity: "high",
    field: "hasPreAuth",
    weightRange: [20, 50],
    leaves: [
      { fact: "hasPreAuth", operator: "equal", value: false },
      { fact: "totalAmount", operator: "greaterThan" },
    ],
  },
};

function goodDraft(): AuthoredRuleDraft {
  return {
    name: "High-value claim missing pre-authorization",
    severity: "high",
    field: "hasPreAuth",
    message_en: "This claim requires prior authorization before submission.",
    message_ar: "تتطلب هذه المطالبة موافقة مسبقة قبل التقديم.",
    weight: 40,
    conditions: {
      all: [
        { fact: "hasPreAuth", operator: "equal", value: false },
        { fact: "totalAmount", operator: "greaterThan", value: 1000 },
      ],
    },
    rationale: "Matches the SME's description of high-value claims without pre-auth.",
  };
}

describe("extractLeaves", () => {
  it("flattens a bare leaf", () => {
    const leaf = { fact: "hasPreAuth", operator: "equal", value: true } as const;
    expect(extractLeaves(leaf)).toEqual([leaf]);
  });

  it("flattens a nested group ignoring structure", () => {
    const tree: AuthoredConditionNode = {
      all: [
        { fact: "hasPreAuth", operator: "equal", value: false },
        { any: [{ fact: "totalAmount", operator: "greaterThan", value: 1000 }] },
      ],
    };
    const leaves = extractLeaves(tree);
    expect(leaves).toHaveLength(2);
    expect(leaves.map((l) => l.fact).sort()).toEqual(["hasPreAuth", "totalAmount"]);
  });
});

describe("scoreAuthorRule", () => {
  it("passes the deterministic gate and matches structurally for a well-formed draft", async () => {
    const check = await scoreAuthorRule(goodDraft(), FIXTURE, [...SCRUBBER_RULES]);
    expect(check.validation?.ok).toBe(true);
    expect(check.failedStage).toBeUndefined();
    expect(check.structural.severityMatch).toBe(true);
    expect(check.structural.fieldMatch).toBe(true);
    expect(check.structural.weightInRange).toBe(true);
    expect(check.structural.leafCoverageRate).toBe(1);
  });

  it("fails the shape stage for an unregistered fact (a real model hallucination case)", async () => {
    const bad: AuthoredRuleDraft = {
      ...goodDraft(),
      // AuthoredRuleDraft.field is plain `string` at the TS level (only the
      // wire zod schema enum-constrains it) — this is a deliberately invalid
      // VALUE, not a type error, simulating a model that invents a fact
      // outside the registry; validateAuthoredRule's runtime shape check is
      // what's expected to reject it, not the compiler.
      field: "patientDiagnosisText",
      conditions: {
        all: [
          // @ts-expect-error AuthoredLeaf.fact IS a literal AuthorableFact
          // union at the type level, so this genuinely fails to typecheck —
          // still worth keeping as a fixture (cast through `as` below) since
          // the real-world failure mode is a model emitting exactly this at
          // the JSON level, past the type system entirely.
          { fact: "patientDiagnosisText", operator: "equal", value: "x" },
        ],
      },
    };
    const check = await scoreAuthorRule(bad, FIXTURE, [...SCRUBBER_RULES]);
    expect(check.validation?.ok).toBe(false);
    expect(check.failedStage).toBe("shape");
  });

  it("computes partial leaf coverage when only some expected leaves are present", async () => {
    const partial: AuthoredRuleDraft = {
      ...goodDraft(),
      conditions: { fact: "hasPreAuth", operator: "equal", value: false },
    };
    const check = await scoreAuthorRule(partial, FIXTURE, [...SCRUBBER_RULES]);
    expect(check.structural.leafCoverageRate).toBe(0.5);
  });
});

describe("schemaInvalidAuthorRuleCheck", () => {
  it("scores as a genuine miss (gate fails, zero leaf coverage), not a fabricated pass", () => {
    const checks = [schemaInvalidAuthorRuleCheck("fixture-1")];
    const report = buildAuthorRuleReport("test-provider", checks);
    expect(report.gatePassRate).toBe(0);
    expect(report.schemaInvalidRate).toBe(1);
    expect(report.avgLeafCoverageRate).toBe(0);
  });
});

describe("buildAuthorRuleReport", () => {
  it("aggregates gate pass rate and stage failure breakdown", async () => {
    const good = await scoreAuthorRule(goodDraft(), FIXTURE, [...SCRUBBER_RULES]);
    const badDraft: AuthoredRuleDraft = {
      ...goodDraft(),
      // Both "hasPreAuth" and "contains" are individually valid literals —
      // this is a semantic mismatch (an array-only operator on a boolean
      // fact) that only validateDraftShape's runtime type-agreement check
      // catches, not the compiler; no @ts-expect-error needed here.
      conditions: { fact: "hasPreAuth", operator: "contains", value: "x" },
    };
    const bad = await scoreAuthorRule(badDraft, FIXTURE, [...SCRUBBER_RULES]);
    const report = buildAuthorRuleReport("test-provider", [good, bad]);
    expect(report.itemCount).toBe(2);
    expect(report.gatePassRate).toBe(0.5);
    expect(report.shapeFailureRate).toBe(0.5);
  });
});
