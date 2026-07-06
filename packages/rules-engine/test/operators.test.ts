import { describe, expect, it } from "vitest";
import { scrub, type ClaimFacts, type ScrubRule } from "../src/index.js";
import { goldenFacts } from "../src/golden.js";

// Engine operator safety (audit HIGH). json-rules-engine's DEFAULT `in`/`notIn`
// evaluate `constant.indexOf(factValue)`, which SUBSTRING-matches when the
// constant is a string: `"female".indexOf("male") === 2 !== -1`, so a rule of the
// shape `patientGender in "female"` fires for a MALE claim. Authoring already
// excludes these operators (registry.ts), but any rule that reaches the engine by
// another path (seed / manual DB / legacy) must not silently mis-fire. scrub()
// overrides both operators with STRICT array membership; these tests pin that.

function rule(conditions: unknown): ScrubRule {
  return {
    id: "R-TEST-op",
    name: "operator probe",
    scope: "global",
    version: 1,
    severity: "high",
    weight: 40,
    field: "patientGender",
    message_en: "probe",
    message_ar: "probe",
    conditions,
    payerId: null,
    tenantId: null,
  };
}

async function fires(facts: ClaimFacts, conditions: unknown): Promise<boolean> {
  const result = await scrub(facts, [rule(conditions)]);
  return result.flags.some((f) => f.ruleId === "R-TEST-op");
}

const male = goldenFacts({ patientGender: "male" });
const female = goldenFacts({ patientGender: "female" });

describe("in/notIn operator safety", () => {
  it("`in` with a STRING constant never substring-matches (the headline bug)", async () => {
    // "female".indexOf("male") === 2 under the default operator → WOULD fire.
    const cond = { all: [{ fact: "patientGender", operator: "in", value: "female" }] };
    expect(await fires(male, cond)).toBe(false);
  });

  it("`in` with an ARRAY constant is exact membership", async () => {
    const cond = { all: [{ fact: "patientGender", operator: "in", value: ["female"] }] };
    expect(await fires(female, cond)).toBe(true);
    expect(await fires(male, cond)).toBe(false);
  });

  it("`notIn` with an ARRAY constant is exact non-membership", async () => {
    const cond = { all: [{ fact: "patientGender", operator: "notIn", value: ["female"] }] };
    // male is NOT in {female} → fires; female IS → does not.
    expect(await fires(male, cond)).toBe(true);
    expect(await fires(female, cond)).toBe(false);
  });

  it("`notIn` with a STRING constant never substring-matches", async () => {
    // Default operator: "female".indexOf("male") === 2, so notIn === -1 is false
    // (doesn't fire) — but "female".indexOf("fem") === 0 would also short-circuit.
    // Strict membership: a non-array constant is a modelling error → never fires.
    const cond = { all: [{ fact: "patientGender", operator: "notIn", value: "female" }] };
    expect(await fires(male, cond)).toBe(false);
    expect(await fires(female, cond)).toBe(false);
  });
});
