// AI-3 authorRule eval scoring — the primary metric runs NO model at all:
// rules-engine's validateAuthoredRule (shape check -> engine dry-run ->
// golden-corpus regression) is fully deterministic, so "does the draft pass
// the real gate a human approver's decision ultimately depends on" is an
// objective, cross-provider-fair pass/fail — measuring "does it work," not
// "did it parse". Secondary: a structural similarity score against a
// hand-authored expected draft (which fact/operator leaves the condition
// tree contains, ignoring exact nesting shape/order — a multiset match, not
// full tree isomorphism; that's more machinery than this needs). Pure/sync
// except for validateAuthoredRule itself (async — dry-run executes json-rules-
// engine), no server-only/network.

import {
  validateAuthoredRule,
  type AuthoredRuleDraft,
  type AuthoredRuleScope,
  type AuthoredConditionNode,
  type AuthoredLeaf,
  type ScrubRule,
  type RuleValidation,
} from "@taweed/rules-engine";
import { rate, average } from "./scoringUtils.js";

export interface ExpectedLeaf {
  fact: string;
  operator: string;
  /** omitted when any legitimate value is acceptable for this fact/operator pair. */
  value?: string | number | boolean;
}

export interface AuthorRuleFixture {
  id: string;
  smeText: string;
  scope: AuthoredRuleScope;
  expected: {
    severity: "info" | "warn" | "high";
    field: string;
    /** [min, max] inclusive acceptable weight range — the model proposes, not exact-matched. */
    weightRange: [number, number];
    leaves: ExpectedLeaf[];
  };
}

function isLeaf(node: AuthoredConditionNode): node is AuthoredLeaf {
  return (
    typeof node === "object" &&
    node !== null &&
    "fact" in node &&
    "operator" in node
  );
}

/** Flatten a condition tree into its leaf predicates, ignoring nesting/grouping shape. */
export function extractLeaves(node: AuthoredConditionNode): AuthoredLeaf[] {
  if (isLeaf(node)) return [node];
  const group = node as { all?: AuthoredConditionNode[]; any?: AuthoredConditionNode[] };
  const children = group.all ?? group.any ?? [];
  return children.flatMap(extractLeaves);
}

export interface StructuralMatch {
  severityMatch: boolean;
  fieldMatch: boolean;
  weightInRange: boolean;
  /** fraction of EXPECTED leaves that have a matching actual leaf (fact+operator; value compared only when the fixture specifies one). */
  leafCoverageRate: number;
  /** actual leaves with no expected counterpart — a sign of over-generation, not necessarily wrong. */
  extraLeafCount: number;
}

function scoreStructural(
  draft: AuthoredRuleDraft,
  expected: AuthorRuleFixture["expected"],
): StructuralMatch {
  const actualLeaves = extractLeaves(draft.conditions);
  const remaining = [...actualLeaves];
  let matched = 0;
  for (const exp of expected.leaves) {
    const idx = remaining.findIndex(
      (a) =>
        a.fact === exp.fact &&
        a.operator === exp.operator &&
        (exp.value === undefined || a.value === exp.value),
    );
    if (idx !== -1) {
      matched += 1;
      remaining.splice(idx, 1);
    }
  }
  return {
    severityMatch: draft.severity === expected.severity,
    fieldMatch: draft.field === expected.field,
    weightInRange:
      draft.weight >= expected.weightRange[0] && draft.weight <= expected.weightRange[1],
    leafCoverageRate: expected.leaves.length === 0 ? 1 : matched / expected.leaves.length,
    extraLeafCount: remaining.length,
  };
}

export interface AuthorRuleCheck {
  fixtureId: string;
  /** null only for a schema-invalid item — no draft was ever produced to gate. */
  validation: RuleValidation | null;
  /** which gate stage failed, when it did — undefined when validation.ok. */
  failedStage?: "shape" | "dry-run" | "golden" | "schema-invalid";
  structural: StructuralMatch;
}

export async function scoreAuthorRule(
  draft: AuthoredRuleDraft,
  fixture: AuthorRuleFixture,
  baseRules: ScrubRule[],
): Promise<AuthorRuleCheck> {
  const validation = await validateAuthoredRule(draft, fixture.scope, {
    id: `eval-${fixture.id}`,
    version: 1,
    baseRules,
  });
  return {
    fixtureId: fixture.id,
    validation,
    failedStage: validation.ok ? undefined : validation.stage,
    structural: scoreStructural(draft, fixture.expected),
  };
}

/**
 * A miss-shaped check for a structured-output parse failure (resilience.ts's
 * runEvalLoop) — no draft was ever produced, so there is nothing to run
 * through validateAuthoredRule; structural coverage is correctly zero rather
 * than compared against an empty/fabricated draft.
 */
export function schemaInvalidAuthorRuleCheck(fixtureId: string): AuthorRuleCheck {
  return {
    fixtureId,
    validation: null,
    failedStage: "schema-invalid",
    structural: {
      severityMatch: false,
      fieldMatch: false,
      weightInRange: false,
      leafCoverageRate: 0,
      extraLeafCount: 0,
    },
  };
}

export interface AuthorRuleReport {
  provider: string;
  itemCount: number;
  /** PRIMARY metric — passes the real deterministic gate a human approval flow depends on. */
  gatePassRate: number;
  schemaInvalidRate: number;
  shapeFailureRate: number;
  dryRunFailureRate: number;
  goldenFailureRate: number;
  avgLeafCoverageRate: number;
  severityMatchRate: number;
  fieldMatchRate: number;
}

export function buildAuthorRuleReport(
  provider: string,
  checks: AuthorRuleCheck[],
): AuthorRuleReport {
  return {
    provider,
    itemCount: checks.length,
    gatePassRate: rate(checks, (c) => c.validation?.ok === true),
    schemaInvalidRate: rate(checks, (c) => c.failedStage === "schema-invalid"),
    shapeFailureRate: rate(checks, (c) => c.failedStage === "shape"),
    dryRunFailureRate: rate(checks, (c) => c.failedStage === "dry-run"),
    goldenFailureRate: rate(checks, (c) => c.failedStage === "golden"),
    avgLeafCoverageRate: average(checks, (c) => c.structural.leafCoverageRate),
    severityMatchRate: rate(checks, (c) => c.structural.severityMatch),
    fieldMatchRate: rate(checks, (c) => c.structural.fieldMatch),
  };
}
