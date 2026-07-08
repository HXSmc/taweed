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

// Three-valued (true/false/"unknown") result of evaluating a condition (sub)tree
// against only the facts we actually know. "unknown" means "cannot be
// determined without a fact that is null/undefined" — it is NOT the same as
// false, and must not be conflated with it when combined under all/any/not.
type TriState = true | false | "unknown";

// Resolve one leaf's fact value the same way scrub()'s runtime facts would:
// real ClaimFacts columns read directly, plus the three facts scrub() derives
// (maxLineUnits, sbsCount, the params-driven lineUnitsFor) computed the same
// way scrub() computes them. All three derived facts are always computable
// from non-nullable ClaimFacts columns (lineUnits, sbsCodes), so they are never
// "unknown" here — matching the "always computed" invariant documented below.
function resolveFactValue(
  key: string,
  params: unknown,
  facts: ClaimFacts,
): { known: boolean; value: unknown } {
  if (key === "maxLineUnits") {
    return { known: true, value: maxUnits(facts.lineUnits) };
  }
  if (key === "sbsCount") {
    return { known: true, value: facts.sbsCodes.length };
  }
  if (key === "lineUnitsFor") {
    const code =
      typeof params === "object" && params !== null
        ? (params as Record<string, unknown>)["code"]
        : undefined;
    const units =
      typeof code === "string" ? facts.lineUnits[code] : undefined;
    return { known: true, value: typeof units === "number" ? units : 0 };
  }
  const record = facts as unknown as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(facts, key)) {
    // Not a ClaimFacts column at all (e.g. a malformed/unregistered fact name).
    // json-rules-engine itself (Engine({ allowUndefinedFacts: true })) resolves
    // an unknown fact to `undefined` rather than throwing, so mirror that here
    // instead of blocking evaluability — this is a shape/config concern for the
    // engine to surface, not a "needs data" concern.
    return { known: true, value: undefined };
  }
  const value = record[key];
  return { known: value !== null && value !== undefined, value };
}

// Mirrors the engine operators actually reachable in scrub() (SCRUB_OPERATORS
// plus the strict `in`/`notIn` override below) so "definitely true/false" here
// means the same thing the real engine run would compute.
function evalOperator(
  operator: unknown,
  factValue: unknown,
  constValue: unknown,
): TriState {
  switch (operator) {
    case "equal":
      return factValue === constValue;
    case "notEqual":
      return factValue !== constValue;
    case "lessThan":
      return (factValue as number) < (constValue as number);
    case "lessThanInclusive":
      return (factValue as number) <= (constValue as number);
    case "greaterThan":
      return (factValue as number) > (constValue as number);
    case "greaterThanInclusive":
      return (factValue as number) >= (constValue as number);
    case "contains":
      return Array.isArray(factValue) && factValue.includes(constValue);
    case "doesNotContain":
      return Array.isArray(factValue) && !factValue.includes(constValue);
    case "in":
      return Array.isArray(constValue) && constValue.includes(factValue);
    case "notIn":
      return Array.isArray(constValue) && !constValue.includes(factValue);
    default:
      // An operator we don't recognize can't be asserted true or false —
      // conservative parity with treating the leaf as needing data.
      return "unknown";
  }
}

function evalLeaf(obj: Record<string, unknown>, facts: ClaimFacts): TriState {
  const fact = obj["fact"];
  if (typeof fact !== "string") {
    // Not a recognizable leaf shape at all (e.g. a malformed condition object
    // with no `fact`). This is a rule-shape problem for the engine's own
    // validation to surface at run time, not a "needs data" case — so it must
    // not be reported as "unknown" (which would silently exempt the rule from
    // ever reaching the engine instead of letting the real error surface).
    return false;
  }
  const resolved = resolveFactValue(fact, obj["params"], facts);
  if (!resolved.known) return "unknown";

  // A condition value may itself reference another fact ({ fact: "x" }).
  let constValue = obj["value"];
  if (typeof constValue === "object" && constValue !== null) {
    const nestedFact = (constValue as Record<string, unknown>)["fact"];
    if (typeof nestedFact === "string") {
      const nestedResolved = resolveFactValue(
        nestedFact,
        (constValue as Record<string, unknown>)["params"],
        facts,
      );
      if (!nestedResolved.known) return "unknown";
      constValue = nestedResolved.value;
    }
  }

  return evalOperator(obj["operator"], resolved.value, constValue);
}

// Walk a json-rules-engine condition tree with three-valued short-circuiting:
// an `all` (AND) is definitely false the moment any child is false, regardless
// of unknown siblings; an `any` (OR) is definitely true the moment any child is
// true, regardless of unknown siblings. Only when NEITHER short-circuit applies
// does an unknown child make the whole (sub)tree unknown. This is what makes an
// authored `any` group correctly fire off its one known-true branch even when
// its other branch reads a null fact (audit finding: OR was previously
// suppressed by flattening the tree and ignoring all/any structure entirely).
function evalNode(node: unknown, facts: ClaimFacts): TriState {
  if (typeof node !== "object" || node === null) return "unknown";
  const obj = node as Record<string, unknown>;

  if (Array.isArray(obj["all"])) {
    let sawUnknown = false;
    for (const child of obj["all"]) {
      const result = evalNode(child, facts);
      if (result === false) return false;
      if (result === "unknown") sawUnknown = true;
    }
    return sawUnknown ? "unknown" : true;
  }

  if (Array.isArray(obj["any"])) {
    let sawUnknown = false;
    for (const child of obj["any"]) {
      const result = evalNode(child, facts);
      if (result === true) return true;
      if (result === "unknown") sawUnknown = true;
    }
    return sawUnknown ? "unknown" : false;
  }

  if (obj["not"] !== undefined) {
    const result = evalNode(obj["not"], facts);
    return result === "unknown" ? "unknown" : !result;
  }

  return evalLeaf(obj, facts);
}

// A rule is unevaluable when its condition tree CANNOT be definitively resolved
// to true or false from known facts alone — "needs data, not a false pass"
// (design-brief §8.3). Respecting all/any structure means a rule stays
// evaluable when an already-true `any` branch (or already-false `all` branch)
// settles the outcome without needing the null fact at all.
function unevaluableRuleIds(facts: ClaimFacts, rules: ScrubRule[]): string[] {
  const ids: string[] = [];
  for (const rule of rules) {
    if (evalNode(rule.conditions, facts) === "unknown") ids.push(rule.id);
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
