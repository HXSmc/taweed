import type { ClaimFacts } from "./types.js";

// AI-3 rule authoring — the registry of what an authored rule may reference
// (plan 04 §4.3). An LLM-drafted ScrubRule is only as safe as the facts and
// operators it is allowed to name: an unregistered fact or operator would either
// silently never fire or throw at engine-run time (json-rules-engine rejects an
// unknown operator). These lists are the SINGLE SOURCE OF TRUTH — the AI schema
// enum-constrains against them, and the validator re-checks against them.

// Base ClaimFacts columns an authored rule may read. `satisfies` pins every entry
// to a real ClaimFacts key at compile time, so renaming a fact breaks the build
// here instead of shipping a rule that reads a nonexistent fact.
export const CLAIM_FACT_KEYS = [
  "payerId",
  "hasPreAuth",
  "patientGender",
  "patientAgeYears",
  "policyActive",
  "sbsCodes",
  "totalAmount",
  "isDuplicate",
  "hasDiagnosis",
  "hasDocumentation",
] as const satisfies readonly (keyof ClaimFacts)[];

// Facts DERIVED and injected by scrub() at run time (scrub.ts) — always present,
// so a rule that reads them is never "unevaluable". Authorable, but not columns.
export const DERIVED_FACT_KEYS = ["maxLineUnits", "sbsCount"] as const;

// The full set an authored rule may reference. `claimId`/`serviceDate`/`lineUnits`
// are intentionally EXCLUDED from authoring: claimId is an identifier (never a
// billing predicate), serviceDate is a free-form string (no safe comparator), and
// lineUnits is a per-code map only reachable via the params-driven `lineUnitsFor`
// dynamic fact — too complex for v1 NL authoring (YAGNI). Derived maxLineUnits
// covers the "quantity too high" case instead.
export const AUTHORABLE_FACT_KEYS = [
  ...CLAIM_FACT_KEYS,
  ...DERIVED_FACT_KEYS,
] as const;

export type AuthorableFact = (typeof AUTHORABLE_FACT_KEYS)[number];

const AUTHORABLE_FACT_SET: ReadonlySet<string> = new Set(AUTHORABLE_FACT_KEYS);
export function isAuthorableFact(value: unknown): value is AuthorableFact {
  return typeof value === "string" && AUTHORABLE_FACT_SET.has(value);
}

// Authorable json-rules-engine operators. Constrained decoding to these names
// keeps an authored rule from naming a custom operator we never registered (which
// would throw at run time). `in`/`notIn` are DELIBERATELY EXCLUDED: they need an
// ARRAY constant (`constant.indexOf(fact)`), but the draft value schema is scalar-
// only — a scalar `in` either throws (numeric: `(5).indexOf`) or silently degrades
// to substring matching (string), the inverse of intent. No shipped rule uses them.
export const SCRUB_OPERATORS = [
  "equal",
  "notEqual",
  "lessThan",
  "lessThanInclusive",
  "greaterThan",
  "greaterThanInclusive",
  "contains",
  "doesNotContain",
] as const;

export type ScrubOperator = (typeof SCRUB_OPERATORS)[number];

const SCRUB_OPERATOR_SET: ReadonlySet<string> = new Set(SCRUB_OPERATORS);
export function isScrubOperator(value: unknown): value is ScrubOperator {
  return typeof value === "string" && SCRUB_OPERATOR_SET.has(value);
}

// Facts whose value is an array (json-rules-engine `contains`/`doesNotContain`
// operate on these; a scalar comparator on them is a modelling error). Used by the
// validator to reject e.g. `sbsCodes greaterThan 5`.
export const ARRAY_FACT_KEYS: ReadonlySet<string> = new Set(["sbsCodes"]);

// Facts whose value is numeric — the ordered comparators (lessThan*/greaterThan*)
// only make sense on these. Used to reject e.g. `patientGender greaterThan 5`.
export const NUMERIC_FACT_KEYS: ReadonlySet<string> = new Set([
  "patientAgeYears",
  "totalAmount",
  "maxLineUnits",
  "sbsCount",
]);

// Facts whose value is boolean. Used so `equal`/`notEqual` on one of these rejects
// a wrongly-typed constant (e.g. the string "false"), which json-rules-engine's
// strict === would silently never match — a dead rule, not an author error.
export const BOOLEAN_FACT_KEYS: ReadonlySet<string> = new Set([
  "hasPreAuth",
  "policyActive",
  "isDuplicate",
  "hasDiagnosis",
  "hasDocumentation",
]);
