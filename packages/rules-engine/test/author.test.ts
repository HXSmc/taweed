import { describe, it, expect } from "vitest";
import {
  validateDraftShape,
  draftToScrubRule,
  dryRunRule,
  checkGoldenRegression,
  validateAuthoredRule,
  SCRUBBER_RULES,
  type AuthoredRuleDraft,
  type AuthoredRuleScope,
  type ScrubRule,
} from "@taweed/rules-engine";

// AI-3 authoring gate. The LLM produces a draft; these tests pin the deterministic
// gates that stand between the draft and an executing rule.

function draft(over: Partial<AuthoredRuleDraft> = {}): AuthoredRuleDraft {
  return {
    name: "High-value claim without pre-auth",
    severity: "high",
    field: "hasPreAuth",
    message_en: "High-value claim submitted without prior authorization.",
    message_ar: "تم تقديم مطالبة عالية القيمة دون موافقة مسبقة.",
    weight: 45,
    conditions: {
      all: [
        { fact: "hasPreAuth", operator: "equal", value: false },
        { fact: "totalAmount", operator: "greaterThanInclusive", value: 1000 },
      ],
    },
    ...over,
  };
}

const GLOBAL_SCOPE: AuthoredRuleScope = { scope: "global" };

describe("validateDraftShape", () => {
  it("accepts a well-formed draft", () => {
    expect(validateDraftShape(draft())).toEqual([]);
  });

  it("rejects an unregistered fact", () => {
    const errors = validateDraftShape(
      draft({ conditions: { all: [{ fact: "ssn" as never, operator: "equal", value: "x" }] } }),
    );
    expect(errors.join(" ")).toContain('unknown fact "ssn"');
  });

  it("rejects an unregistered operator", () => {
    const errors = validateDraftShape(
      draft({
        conditions: { all: [{ fact: "totalAmount", operator: "sqlInject" as never, value: 1 }] },
      }),
    );
    expect(errors.join(" ")).toContain('unknown operator "sqlInject"');
  });

  it("rejects an ordered comparator on a non-numeric fact", () => {
    const errors = validateDraftShape(
      draft({
        conditions: { all: [{ fact: "patientGender", operator: "greaterThan", value: 1 }] },
      }),
    );
    expect(errors.join(" ")).toContain("needs a numeric fact");
  });

  it("rejects a scalar comparator on an array fact", () => {
    const errors = validateDraftShape(
      draft({
        conditions: { all: [{ fact: "sbsCodes", operator: "equal", value: "SBS-0001" }] },
      }),
    );
    expect(errors.join(" ")).toContain("only supports contains/doesNotContain");
  });

  it("accepts contains on the array fact", () => {
    expect(
      validateDraftShape(
        draft({ conditions: { all: [{ fact: "sbsCodes", operator: "contains", value: "SBS-0001" }] } }),
      ),
    ).toEqual([]);
  });

  it("rejects an empty group", () => {
    const errors = validateDraftShape(draft({ conditions: { all: [] } }));
    expect(errors.join(" ")).toContain("empty");
  });

  it("rejects nesting deeper than 3 groups", () => {
    // all -> any -> all -> leaf  == 4 group levels
    const errors = validateDraftShape(
      draft({
        conditions: {
          all: [{ any: [{ all: [{ any: [{ fact: "hasPreAuth", operator: "equal", value: false }] }] }] }],
        },
      }),
    );
    expect(errors.join(" ")).toContain("nesting exceeds 3");
  });

  it("rejects an out-of-range weight and empty text", () => {
    const errors = validateDraftShape(draft({ weight: 500, message_en: "" }));
    expect(errors.join(" ")).toContain("weight");
    expect(errors.join(" ")).toContain("message_en");
  });

  // Review fix #2 (HIGH): a group with BOTH all and any is reviewed on one branch
  // but executed on the other — the executed rule could differ from the approved one.
  it("rejects a group carrying both all and any", () => {
    const errors = validateDraftShape(
      draft({
        conditions: {
          all: [{ fact: "hasPreAuth", operator: "equal", value: false }],
          any: [{ fact: "totalAmount", operator: "greaterThan", value: 1 }],
        } as never,
      }),
    );
    expect(errors.join(" ")).toContain("exactly one of all/any");
  });

  // Review fix #3 (MEDIUM): equal/notEqual value type must match the fact — a string
  // "false" vs a boolean fact is a dead rule under strict ===, not a valid rule.
  it("rejects equal on a boolean fact with a non-boolean value", () => {
    const errors = validateDraftShape(
      draft({ conditions: { all: [{ fact: "hasPreAuth", operator: "equal", value: "false" }] } }),
    );
    expect(errors.join(" ")).toContain("boolean value");
  });

  it("rejects equal on a numeric fact with a string value", () => {
    const errors = validateDraftShape(
      draft({ conditions: { all: [{ fact: "patientAgeYears", operator: "equal", value: "40" }] } }),
    );
    expect(errors.join(" ")).toContain("numeric value");
  });

  it("accepts equal on a string fact with a string value", () => {
    expect(
      validateDraftShape(
        draft({ conditions: { all: [{ fact: "payerId", operator: "equal", value: "PAYER-X" }] } }),
      ),
    ).toEqual([]);
  });
});

describe("draftToScrubRule", () => {
  it("maps a draft + scope into a persistable ScrubRule", () => {
    const rule = draftToScrubRule(draft(), { scope: "payer", payerId: "PAYER-X" }, "R-LLM-1", 1);
    expect(rule.id).toBe("R-LLM-1");
    expect(rule.version).toBe(1);
    expect(rule.scope).toBe("payer");
    expect(rule.payerId).toBe("PAYER-X");
    expect(rule.tenantId).toBeNull();
    expect(rule.weight).toBe(45);
  });

  it("clamps an out-of-range weight and rounds", () => {
    expect(draftToScrubRule(draft({ weight: 999 }), GLOBAL_SCOPE, "R", 1).weight).toBe(100);
    expect(draftToScrubRule(draft({ weight: 0 }), GLOBAL_SCOPE, "R", 1).weight).toBe(1);
    expect(draftToScrubRule(draft({ weight: 30.6 }), GLOBAL_SCOPE, "R", 1).weight).toBe(31);
  });

  it("wraps a bare leaf condition in a top-level group the engine accepts", () => {
    const rule = draftToScrubRule(
      draft({ conditions: { fact: "isDuplicate", operator: "equal", value: true } }),
      GLOBAL_SCOPE,
      "R",
      1,
    );
    expect(rule.conditions).toEqual({
      all: [{ fact: "isDuplicate", operator: "equal", value: true }],
    });
  });
});

describe("dryRunRule", () => {
  it("passes a well-formed rule through the real engine", async () => {
    const rule = draftToScrubRule(draft(), GLOBAL_SCOPE, "R-OK", 1);
    expect(await dryRunRule(rule)).toEqual({ ok: true });
  });

  it("reports a runtime failure instead of throwing", async () => {
    // A malformed condition tree that passes NO shape check but is handed straight
    // to the engine — the runner must catch the throw and report it.
    const bad: ScrubRule = {
      ...draftToScrubRule(draft(), GLOBAL_SCOPE, "R-BAD", 1),
      conditions: { totallyInvalid: true } as unknown as ScrubRule["conditions"],
    };
    const result = await dryRunRule(bad);
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});

describe("checkGoldenRegression", () => {
  it("passes a benign new global rule (fresh id)", async () => {
    const rule = draftToScrubRule(
      draft({ conditions: { all: [{ fact: "hasDocumentation", operator: "equal", value: false }] } }),
      GLOBAL_SCOPE,
      "R-LLM-benign",
      1,
    );
    expect(await checkGoldenRegression(rule, SCRUBBER_RULES)).toEqual([]);
  });

  it("catches a version bump that stops a pinned rule from firing", async () => {
    // A new v2 of the strict-payer unit rule whose threshold no golden claim meets
    // — the pinned expectFired ["R-D02-preauth-payer-units"] would break.
    const rule = draftToScrubRule(
      draft({
        conditions: {
          all: [{ fact: "totalAmount", operator: "greaterThan", value: 9_999_999 }],
        },
      }),
      { scope: "payer", payerId: "PAYER-PREAUTH-STRICT" },
      "R-D02-preauth-payer-units",
      2,
    );
    const regressions = await checkGoldenRegression(rule, SCRUBBER_RULES);
    expect(regressions.length).toBeGreaterThan(0);
    expect(regressions[0]?.ruleId).toBe("R-D02-preauth-payer-units");
  });
});

describe("validateAuthoredRule (full gate)", () => {
  const base = { id: "R-LLM-x", version: 1, baseRules: SCRUBBER_RULES };

  it("returns the canonical rule when every gate passes", async () => {
    const result = await validateAuthoredRule(draft(), GLOBAL_SCOPE, base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rule.id).toBe("R-LLM-x");
  });

  it("stops at the shape gate on a bad fact", async () => {
    const result = await validateAuthoredRule(
      draft({ conditions: { all: [{ fact: "ssn" as never, operator: "equal", value: "x" }] } }),
      GLOBAL_SCOPE,
      base,
    );
    expect(result).toMatchObject({ ok: false, stage: "shape" });
  });

  it("stops at the golden gate on a regressing version bump", async () => {
    const result = await validateAuthoredRule(
      draft({
        conditions: { all: [{ fact: "totalAmount", operator: "greaterThan", value: 9_999_999 }] },
      }),
      { scope: "payer", payerId: "PAYER-PREAUTH-STRICT" },
      { id: "R-D02-preauth-payer-units", version: 2, baseRules: SCRUBBER_RULES },
    );
    expect(result).toMatchObject({ ok: false, stage: "golden" });
  });
});
