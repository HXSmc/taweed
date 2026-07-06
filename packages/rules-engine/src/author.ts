import type { TopLevelCondition } from "json-rules-engine";
import type { ClaimFacts, ScrubRule, Severity } from "./types.js";
import { scrub } from "./scrub.js";
import { selectRulesForClaim } from "./select.js";
import {
  AUTHORABLE_FACT_KEYS,
  ARRAY_FACT_KEYS,
  NUMERIC_FACT_KEYS,
  BOOLEAN_FACT_KEYS,
  SCRUB_OPERATORS,
  isAuthorableFact,
  isScrubOperator,
  type AuthorableFact,
  type ScrubOperator,
} from "./registry.js";
import { PAYER_GOLDEN_CASES, goldenFacts, type GoldenCase } from "./golden.js";

// AI-3 rule-authoring gate (plan 04 §4.3). The LLM produces a DRAFT; nothing it
// emits is trusted. This module is the deterministic gate between "the model said
// so" and "this rule executes against real claims": shape validation → engine
// dry-run → golden-corpus regression. rules-engine OWNS what a valid rule is, so
// the gate lives here (not in @taweed/ai) — a single authority the AI layer calls.

// A leaf condition an authored rule may contain. Values are scalars only (a fact
// compared to a constant). The value type is checked against the fact in
// validateDraftShape (an array fact needs `contains`, a numeric fact an ordered
// comparator, etc.).
export interface AuthoredLeaf {
  fact: AuthorableFact;
  operator: ScrubOperator;
  value: string | number | boolean;
}

// A boolean group of conditions. `all`/`any` are BOTH optional so this recursive
// type is assignable-from the bounded (non-recursive) zod schema in @taweed/ai,
// whose groups have optional all/any. validateDraftShape rejects a group with
// neither (an empty group is a model error).
export interface AuthoredGroup {
  all?: AuthoredConditionNode[];
  any?: AuthoredConditionNode[];
}

// The condition tree. RECURSIVE here (TypeScript allows it) — only the WIRE schema
// sent to the model must be non-recursive (structured outputs reject recursion),
// which @taweed/ai enforces by bounding the zod schema to explicit levels. The
// validated object that comes back is treated as this recursive shape.
export type AuthoredConditionNode = AuthoredLeaf | AuthoredGroup;

export interface AuthoredRuleDraft {
  name: string;
  severity: Severity;
  /** display label for the failing field (e.g. "hasPreAuth"); shown in the flag. */
  field: string;
  message_en: string;
  message_ar: string;
  /** 0..100 points; clamped on persist. Not model-trusted for arithmetic. */
  weight: number;
  conditions: AuthoredConditionNode;
  /** plain-language reason, shown to the human approver. Never executed. */
  rationale?: string;
}

/** Scope bindings the SME chose (NOT the model) — where the rule applies. */
export interface AuthoredRuleScope {
  scope: "global" | "tenant" | "payer";
  payerId?: string | null;
  tenantId?: string | null;
}

// Nesting cap (plan 04 §4.3: "max 3 levels"). A top-level group of leaves is depth
// 1; group→group→leaves is depth 2; one more is depth 3. Deeper trees are rejected
// — they are almost always a model error and hurt the human review of the tree.
const MAX_GROUP_DEPTH = 3;
const WEIGHT_MIN = 1;
const WEIGHT_MAX = 100;

function isLeaf(node: AuthoredConditionNode): node is AuthoredLeaf {
  return (
    typeof node === "object" &&
    node !== null &&
    "fact" in node &&
    "operator" in node
  );
}

const ORDERED_OPERATORS: ReadonlySet<string> = new Set([
  "lessThan",
  "lessThanInclusive",
  "greaterThan",
  "greaterThanInclusive",
]);
const ARRAY_OPERATORS: ReadonlySet<string> = new Set([
  "contains",
  "doesNotContain",
]);
const EQUALITY_OPERATORS: ReadonlySet<string> = new Set(["equal", "notEqual"]);

/**
 * Validate the DRAFT's structure against the registry (plan 04 §4.3). This is the
 * first gate: every fact and operator must be registered, groups must be non-empty,
 * nesting must be bounded, and each operator must suit its fact's type (an ordered
 * comparator needs a numeric fact; contains/doesNotContain need an array fact).
 * Returns a list of human-readable problems — empty means the shape is sound.
 */
export function validateDraftShape(draft: AuthoredRuleDraft): string[] {
  const errors: string[] = [];

  if (!draft.name || draft.name.trim() === "") errors.push("name is empty");
  if (!draft.field || draft.field.trim() === "") errors.push("field is empty");
  if (!draft.message_en || draft.message_en.trim() === "")
    errors.push("message_en is empty");
  if (!draft.message_ar || draft.message_ar.trim() === "")
    errors.push("message_ar is empty");
  if (
    typeof draft.weight !== "number" ||
    Number.isNaN(draft.weight) ||
    draft.weight < WEIGHT_MIN ||
    draft.weight > WEIGHT_MAX
  ) {
    errors.push(`weight must be a number in [${WEIGHT_MIN}, ${WEIGHT_MAX}]`);
  }

  const walk = (node: AuthoredConditionNode, depth: number): void => {
    if (node === null || typeof node !== "object") {
      errors.push("condition node is not an object");
      return;
    }
    if (isLeaf(node)) {
      if (!isAuthorableFact(node.fact)) {
        errors.push(
          `unknown fact "${String(node.fact)}" (allowed: ${AUTHORABLE_FACT_KEYS.join(", ")})`,
        );
        return;
      }
      if (!isScrubOperator(node.operator)) {
        errors.push(
          `unknown operator "${String(node.operator)}" (allowed: ${SCRUB_OPERATORS.join(", ")})`,
        );
        return;
      }
      // Operator/fact type agreement — the checks json-rules-engine can't make
      // (it silently returns false on a type mismatch, so a nonsense rule would
      // just never fire; catch it here as an author error, not a silent no-op).
      const isArrayFact = ARRAY_FACT_KEYS.has(node.fact);
      const isNumericFact = NUMERIC_FACT_KEYS.has(node.fact);
      if (ARRAY_OPERATORS.has(node.operator) && !isArrayFact) {
        errors.push(
          `operator "${node.operator}" needs an array fact, but "${node.fact}" is not one`,
        );
      }
      if (ORDERED_OPERATORS.has(node.operator)) {
        if (!isNumericFact) {
          errors.push(
            `operator "${node.operator}" needs a numeric fact, but "${node.fact}" is not one`,
          );
        }
        if (typeof node.value !== "number") {
          errors.push(
            `operator "${node.operator}" on "${node.fact}" needs a numeric value`,
          );
        }
      }
      if (isArrayFact && !ARRAY_OPERATORS.has(node.operator)) {
        errors.push(
          `array fact "${node.fact}" only supports contains/doesNotContain, not "${node.operator}"`,
        );
      }
      // equal/notEqual on a scalar fact must compare like-typed values — a
      // wrongly-typed constant (e.g. the string "false" vs a boolean fact) is a
      // dead rule under json-rules-engine's strict === , not an author error.
      if (EQUALITY_OPERATORS.has(node.operator) && !isArrayFact) {
        const isBoolFact = BOOLEAN_FACT_KEYS.has(node.fact);
        if (isNumericFact && typeof node.value !== "number") {
          errors.push(`"${node.operator}" on numeric fact "${node.fact}" needs a numeric value`);
        } else if (isBoolFact && typeof node.value !== "boolean") {
          errors.push(`"${node.operator}" on boolean fact "${node.fact}" needs a boolean value`);
        } else if (!isNumericFact && !isBoolFact && typeof node.value !== "string") {
          errors.push(`"${node.operator}" on fact "${node.fact}" needs a string value`);
        }
      }
      return;
    }
    // Group node — must carry EXACTLY ONE of all/any. A node with BOTH is
    // ambiguous: json-rules-engine evaluates one branch (any short-circuits first)
    // while a reviewer reading the rendered tree may see the other, so the rule
    // that EXECUTES could differ from the one the human APPROVED — a hole in the
    // human-in-the-loop gate. Reject it.
    const group = node as AuthoredGroup;
    const hasAll = Array.isArray(group.all);
    const hasAny = Array.isArray(group.any);
    if (hasAll && hasAny) {
      errors.push("group must have exactly one of all/any, not both");
      return;
    }
    const children = hasAll ? group.all : hasAny ? group.any : undefined;
    if (!Array.isArray(children)) {
      errors.push("group must have a non-empty all/any array");
      return;
    }
    if (children.length === 0) {
      errors.push("group all/any array is empty");
      return;
    }
    if (depth + 1 > MAX_GROUP_DEPTH) {
      errors.push(`condition nesting exceeds ${MAX_GROUP_DEPTH} levels`);
      return;
    }
    for (const child of children) walk(child, depth + 1);
  };

  // A bare leaf at the top is depth 0 (no group); a top-level group is depth 1.
  walk(draft.conditions, isLeaf(draft.conditions) ? 0 : 0);

  return errors;
}

// Map the authored tree onto a json-rules-engine TopLevelCondition. A bare leaf is
// wrapped in an `all` so the engine always gets a top-level group (its contract).
function toEngineConditions(node: AuthoredConditionNode): TopLevelCondition {
  if (isLeaf(node)) {
    return { all: [{ fact: node.fact, operator: node.operator, value: node.value }] };
  }
  return node as unknown as TopLevelCondition;
}

const SEVERITY_DEFAULT_WEIGHT: Record<Severity, number> = {
  info: 10,
  warn: 25,
  high: 45,
};

function clampWeight(weight: number, severity: Severity): number {
  if (typeof weight !== "number" || Number.isNaN(weight)) {
    return SEVERITY_DEFAULT_WEIGHT[severity];
  }
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(weight)));
}

/**
 * Build a persistable ScrubRule from a validated draft + the SME-chosen scope.
 * `id`/`version` are assigned by the caller (DB), never by the model. Weight is
 * clamped deterministically — the model does not control the arithmetic weight.
 */
export function draftToScrubRule(
  draft: AuthoredRuleDraft,
  scope: AuthoredRuleScope,
  id: string,
  version: number,
): ScrubRule {
  return {
    id,
    name: draft.name.trim(),
    scope: scope.scope,
    version,
    severity: draft.severity,
    weight: clampWeight(draft.weight, draft.severity),
    field: draft.field.trim(),
    message_en: draft.message_en.trim(),
    message_ar: draft.message_ar.trim(),
    conditions: toEngineConditions(draft.conditions),
    payerId: scope.scope === "payer" ? (scope.payerId ?? null) : null,
    tenantId: scope.scope === "tenant" ? (scope.tenantId ?? null) : null,
  };
}

// Fixture claims for the dry-run — enough variety to exercise every authorable
// fact type without any real PHI. The point is to surface a RUNTIME throw (an
// operator json-rules-engine rejects, a malformed tree) before the rule is ever
// stored; behaviour correctness is the golden gate's job.
const DRY_RUN_FIXTURES: ClaimFacts[] = [
  goldenFacts({}),
  goldenFacts({
    hasPreAuth: false,
    policyActive: false,
    isDuplicate: true,
    hasDiagnosis: false,
    hasDocumentation: false,
    patientGender: "male",
    patientAgeYears: 5,
    totalAmount: 5000,
    sbsCodes: ["SBS-0002", "SBS-0006", "SBS-9999"],
    lineUnits: { "SBS-0002": 12 },
  }),
];

export interface DryRunResult {
  ok: boolean;
  error?: string;
}

/**
 * Run the drafted rule ALONE through the real engine over fixture claims. Catches
 * runtime-only failures (a rejected operator, a malformed condition tree) that the
 * static shape check can miss. Uses scrub() so the exact production engine setup
 * (derived facts, allowUndefinedFacts) is exercised.
 */
export async function dryRunRule(rule: ScrubRule): Promise<DryRunResult> {
  try {
    for (const facts of DRY_RUN_FIXTURES) {
      await scrub(facts, [rule]);
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface GoldenRegression {
  case: string;
  ruleId: string;
  problem: string;
}

/**
 * Ensure adding the drafted rule to the library changes NO pinned golden outcome
 * (plan 04 §4.3 gate chain). For each case, scrub with (base + draft) scoped to the
 * case's payer and assert every expectFired still fires and every expectNotFired
 * still does not. A drafted rule that flips a pinned outcome is a regression and
 * blocks approval — the same guarantee the golden TEST gives hand-written edits.
 */
export async function checkGoldenRegression(
  draftRule: ScrubRule,
  baseRules: ScrubRule[],
  cases: GoldenCase[] = PAYER_GOLDEN_CASES,
): Promise<GoldenRegression[]> {
  const regressions: GoldenRegression[] = [];
  const augmented = [...baseRules, draftRule];
  for (const c of cases) {
    const rules = selectRulesForClaim(augmented, {
      payerId: c.payerId,
      tenantId: draftRule.tenantId ?? undefined,
    });
    const result = await scrub(c.facts, rules);
    const fired = new Set(result.flags.map((f) => f.ruleId));
    for (const id of c.expectFired) {
      if (!fired.has(id)) {
        regressions.push({
          case: c.name,
          ruleId: id,
          problem: `expected rule ${id} to fire but it did not after adding the draft`,
        });
      }
    }
    for (const id of c.expectNotFired) {
      if (fired.has(id)) {
        regressions.push({
          case: c.name,
          ruleId: id,
          problem: `rule ${id} must not fire but did after adding the draft`,
        });
      }
    }
  }
  return regressions;
}

export type RuleValidation =
  | { ok: true; rule: ScrubRule }
  | { ok: false; stage: "shape" | "dry-run" | "golden"; errors: string[] };

/**
 * Full deterministic gate for one LLM-authored draft (plan 04 §4.3). Runs the
 * stages in order and STOPS at the first failure — the returned `stage` tells the
 * approval UI which gate blocked. A pass returns the canonical ScrubRule ready to
 * persist DISABLED for human approval. `id`/`version` come from the caller (DB).
 */
export async function validateAuthoredRule(
  draft: AuthoredRuleDraft,
  scope: AuthoredRuleScope,
  opts: { id: string; version: number; baseRules: ScrubRule[] },
): Promise<RuleValidation> {
  const shapeErrors = validateDraftShape(draft);
  if (shapeErrors.length > 0) {
    return { ok: false, stage: "shape", errors: shapeErrors };
  }

  const rule = draftToScrubRule(draft, scope, opts.id, opts.version);

  const dry = await dryRunRule(rule);
  if (!dry.ok) {
    return {
      ok: false,
      stage: "dry-run",
      errors: [dry.error ?? "engine dry-run failed"],
    };
  }

  const regressions = await checkGoldenRegression(rule, opts.baseRules);
  if (regressions.length > 0) {
    return {
      ok: false,
      stage: "golden",
      errors: regressions.map((r) => `[${r.case}] ${r.problem}`),
    };
  }

  return { ok: true, rule };
}
