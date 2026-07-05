import type { ScrubRule } from "./types.js";

// EXECUTE B7 — resolve which rules apply to a claim (build-plan §8 wk10,
// design-brief §8.3). A payer's own rule version overrides the shared library, so
// rules are tunable per payer as data without touching engine code.

export interface RuleSelector {
  payerId?: string | null;
  tenantId?: string | null;
}

function applies(rule: ScrubRule, sel: RuleSelector): boolean {
  switch (rule.scope) {
    case "global":
      return true;
    case "payer":
      // Unbound (null/undefined) payer rules apply to every payer.
      return rule.payerId == null || rule.payerId === sel.payerId;
    case "tenant":
      return rule.tenantId == null || rule.tenantId === sel.tenantId;
    default:
      return false;
  }
}

/**
 * Rules applicable to a claim, with per-family version resolution: within one
 * logical rule id, only the HIGHEST version survives, so a payer's v2 supersedes
 * v1. Output is sorted by id for deterministic downstream ordering (golden set).
 */
export function selectRulesForClaim(
  rules: ScrubRule[],
  sel: RuleSelector,
): ScrubRule[] {
  const byKey = new Map<string, ScrubRule>();
  for (const rule of rules) {
    if (!applies(rule, sel)) continue;
    const prev = byKey.get(rule.id);
    if (!prev || rule.version > prev.version) byKey.set(rule.id, rule);
  }
  return [...byKey.values()].sort((a, b) => a.id.localeCompare(b.id));
}
