import { Engine } from "json-rules-engine";
import type { TopLevelCondition } from "json-rules-engine";
import type {
  ClaimFacts,
  ScrubFlag,
  ScrubResult,
  ScrubRule,
  Severity,
} from "./types.js";

// Severity ordering for flag sort + a stable tiebreak on weight then id, so the
// same facts always yield byte-identical output (this feeds the golden-set
// regression harness, §9).
const SEVERITY_RANK: Record<Severity, number> = { info: 1, warn: 2, high: 3 };

// Walk a json-rules-engine condition tree and collect every `fact` id it reads.
// Used to decide, BEFORE running, which rules depend on an absent fact.
function collectFactKeys(node: unknown, acc: Set<string>): void {
  if (typeof node !== "object" || node === null) return;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj["all"])) {
    for (const child of obj["all"]) collectFactKeys(child, acc);
    return;
  }
  if (Array.isArray(obj["any"])) {
    for (const child of obj["any"]) collectFactKeys(child, acc);
    return;
  }
  if (obj["not"] !== undefined) {
    collectFactKeys(obj["not"], acc);
    return;
  }
  const fact = obj["fact"];
  if (typeof fact === "string") {
    acc.add(fact);
    // A condition value may itself reference another fact ({ fact: "x" }).
    const value = obj["value"];
    if (typeof value === "object" && value !== null) {
      const nested = (value as Record<string, unknown>)["fact"];
      if (typeof nested === "string") acc.add(nested);
    }
  }
}

// A rule is unevaluable when any ClaimFacts field it reads is null/undefined —
// "needs data, not a false pass" (design-brief §8.3). Derived facts (maxLineUnits,
// sbsCount, lineUnitsFor) are always computed, so they never trigger this.
function unevaluableRuleIds(facts: ClaimFacts, rules: ScrubRule[]): string[] {
  const record = facts as unknown as Record<string, unknown>;
  const ids: string[] = [];
  for (const rule of rules) {
    const keys = new Set<string>();
    collectFactKeys(rule.conditions, keys);
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(facts, key)) continue;
      const val = record[key];
      if (val === null || val === undefined) {
        ids.push(rule.id);
        break;
      }
    }
  }
  return ids.sort();
}

function maxUnits(lineUnits: Record<string, number>): number {
  const values = Object.values(lineUnits);
  // Math.max() of no args is -Infinity; seed with 0 so an empty claim reads 0.
  return values.length === 0 ? 0 : Math.max(0, ...values);
}

export async function scrub(
  facts: ClaimFacts,
  rules: ScrubRule[],
): Promise<ScrubResult> {
  const unevaluable = unevaluableRuleIds(facts, rules);
  const unevalSet = new Set(unevaluable);
  // Only rules whose required facts are all present run — an unevaluable rule
  // is never added, so it can neither fire nor silently pass.
  const evaluable = rules.filter((r) => !unevalSet.has(r.id));

  const engine = new Engine([], { allowUndefinedFacts: true });
  // Defense-in-depth (audit HIGH): json-rules-engine's DEFAULT `in`/`notIn`
  // evaluate `constant.indexOf(factValue)`, which SUBSTRING-matches when the
  // constant is a string — a `patientGender in "female"` rule fires for a "male"
  // claim ("female".indexOf("male") === 2). Authoring already excludes these
  // operators (registry.SCRUB_OPERATORS), but the engine must not silently
  // mis-fire for any rule that reaches it by another path (seed / manual DB /
  // legacy). Override with STRICT array membership: a non-array constant is a
  // modelling error and simply never fires — no false positive, and (unlike a
  // throw) no aborted scrub for the whole claim.
  engine.addOperator("in", (factValue: unknown, arrayValue: unknown): boolean =>
    Array.isArray(arrayValue) && arrayValue.includes(factValue),
  );
  engine.addOperator(
    "notIn",
    (factValue: unknown, arrayValue: unknown): boolean =>
      Array.isArray(arrayValue) && !arrayValue.includes(factValue),
  );
  // Dynamic fact: per-SBS billed units, keyed by rule params { code }.
  engine.addFact("lineUnitsFor", (params: Record<string, unknown>): number => {
    const code = params["code"];
    if (typeof code !== "string") return 0;
    const units = facts.lineUnits[code];
    return typeof units === "number" ? units : 0;
  });

  for (const rule of evaluable) {
    engine.addRule({
      conditions: rule.conditions as TopLevelCondition,
      // event.type = rule id; params carry the trace so external consumers of
      // the raw engine result can explain a flag without the rule table.
      event: {
        type: rule.id,
        params: {
          ruleName: rule.name,
          field: rule.field,
          severity: rule.severity,
          message_en: rule.message_en,
          message_ar: rule.message_ar,
          weight: rule.weight,
        },
      },
    });
  }

  const runtimeFacts: Record<string, unknown> = {
    ...facts,
    maxLineUnits: maxUnits(facts.lineUnits),
    sbsCount: facts.sbsCodes.length,
  };

  const { events } = await engine.run(runtimeFacts);

  const byId = new Map(rules.map((r) => [r.id, r]));
  const firedRules = events
    .map((e) => byId.get(e.type))
    .filter((r): r is ScrubRule => r !== undefined);

  firedRules.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      b.weight - a.weight ||
      a.id.localeCompare(b.id),
  );

  const flags: ScrubFlag[] = firedRules.map((r) => ({
    ruleId: r.id,
    ruleName: r.name,
    field: r.field,
    severity: r.severity,
    message_en: r.message_en,
    message_ar: r.message_ar,
  }));

  // Weights are calibrated as points: one high rule lands ~40-60, several stack
  // past 100 and clamp. Unevaluable rules contribute nothing (neither pass nor fail).
  const rawScore = firedRules.reduce((sum, r) => sum + r.weight, 0);
  const riskScore = Math.min(100, Math.round(rawScore));

  return { claimId: facts.claimId, riskScore, flags, unevaluable };
}
