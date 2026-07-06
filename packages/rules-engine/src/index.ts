// @taweed/rules-engine — pre-submission scrubber (build-plan §3 rules-as-data, §7).
export * from "./types.js";
export { SCRUBBER_RULES } from "./rules.js";
export { scrub } from "./scrub.js";
export { selectRulesForClaim, type RuleSelector } from "./select.js";
export {
  projectClaimFacts,
  claimToFactsReal,
  claimToFactsSynthetic,
  type DataOrigin,
  type ProjectionClaim,
  type ProjectionLine,
  type ProjectionPatient,
} from "./project.js";

// AI-3 rule authoring — registry (single source of truth for authorable facts /
// operators), the golden corpus, and the deterministic authoring gate.
export {
  CLAIM_FACT_KEYS,
  DERIVED_FACT_KEYS,
  AUTHORABLE_FACT_KEYS,
  SCRUB_OPERATORS,
  ARRAY_FACT_KEYS,
  NUMERIC_FACT_KEYS,
  isAuthorableFact,
  isScrubOperator,
  type AuthorableFact,
  type ScrubOperator,
} from "./registry.js";
export {
  PAYER_GOLDEN_CASES,
  goldenFacts,
  type GoldenCase,
} from "./golden.js";
export {
  validateDraftShape,
  draftToScrubRule,
  dryRunRule,
  checkGoldenRegression,
  validateAuthoredRule,
  type AuthoredLeaf,
  type AuthoredGroup,
  type AuthoredConditionNode,
  type AuthoredRuleDraft,
  type AuthoredRuleScope,
  type DryRunResult,
  type GoldenRegression,
  type RuleValidation,
} from "./author.js";
