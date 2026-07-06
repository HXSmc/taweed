import "server-only";
import { withTenant, type Pool } from "@taweed/db";
import {
  AUTHORABLE_FACT_KEYS,
  SCRUB_OPERATORS,
  type AuthoredRuleScope,
} from "@taweed/rules-engine";
import { AiConfigError, AiDisabledError } from "../errors.js";
import { isFeatureEnabled, missingProviderConfig } from "../config.js";
import { normalizeArabicOutput } from "../postprocess-ar.js";
import { sha256Hex } from "../sha256.js";
import { runStructured, isTenantAiEnabled } from "../run.js";
import { createAnthropicProvider } from "../anthropic-1p.js";
import type { LlmProvider } from "../provider.js";
import {
  ScrubRuleDraftSchema,
  type ScrubRuleDraft,
} from "../schemas/scrubRuleDraft.js";

// AI-3 — NL → ScrubRule DRAFT (plan 04 §2, §4.3). The SME types an English or
// Arabic sentence describing a BILLING rule; the model proposes a structured
// ScrubRule draft. PHI-FREE: the input is a rule description + a tenant/payer
// scope — no claim, patient, amount, or date. Nothing here is trusted: the draft
// runs through the deterministic gate (rules-engine validateAuthoredRule) and is
// persisted DISABLED for human approval before it can ever execute. This function
// only GENERATES the candidate.

export interface AuthorRuleInput {
  /** the SME's rule description (EN or AR). PHI-free by policy — a billing rule, not a claim. */
  smeText: string;
  /** where the rule applies — chosen by the SME, never the model. */
  scope: AuthoredRuleScope;
}

// A plain-language guide to every authorable fact, injected into the prompt so the
// model names facts/operators from the real vocabulary instead of inventing them.
// (The schema enum-constrains too; this improves the model's first-shot accuracy.)
const FACT_GUIDE: Record<string, string> = {
  payerId: "string — the insurer id; use `equal` to scope a rule to one payer.",
  hasPreAuth: "boolean — whether a prior authorization is on file.",
  patientGender: 'string — one of "male","female","other","unknown".',
  patientAgeYears: "number — patient age in whole years.",
  policyActive: "boolean — whether the policy is active on the service date.",
  sbsCodes: "array of strings — the SBS procedure codes; use `contains`/`doesNotContain`.",
  totalAmount: "number — the claim total.",
  isDuplicate: "boolean — whether the claim looks like a duplicate.",
  hasDiagnosis: "boolean — whether a diagnosis code is present.",
  hasDocumentation: "boolean — whether required documentation is attached.",
  maxLineUnits: "number — the highest per-line unit quantity on the claim.",
  sbsCount: "number — how many service lines the claim has.",
};

const SYSTEM_PROMPT = [
  "You convert a revenue-cycle specialist's description of a medical-claim BILLING rule into a structured pre-submission scrubber rule for Saudi Arabia (NPHIES).",
  "You output ONLY the structured rule — a name, severity, the flagged field, bilingual EN + MSA messages, a weight, a condition tree, and a short rationale.",
  "",
  "HARD CONSTRAINTS (safety-critical):",
  "- Author ADMINISTRATIVE / BILLING rules only. NEVER encode a clinical judgment, a diagnosis decision, or medical necessity. A rule may check that a diagnosis code is PRESENT (hasDiagnosis), never WHICH diagnosis is correct.",
  "- Use ONLY the facts and operators listed below. Do not invent a fact or operator — an unknown one is rejected.",
  "- Compare a fact to a constant. Numeric facts use lessThan/lessThanInclusive/greaterThan/greaterThanInclusive/equal; the array fact sbsCodes uses contains/doesNotContain; booleans and strings use equal/notEqual.",
  "- Keep the condition tree shallow (at most three levels of all/any groups).",
  "- messages: a plain-language English message and a Modern Standard Arabic message a biller reads when the rule fires. severity: 'high' for likely denials, 'warn' for review, 'info' for advisory. weight: 10-50 points reflecting how strongly the flag should raise the claim's risk score.",
  "- rationale: one or two sentences telling the human approver why this rule matches the request. Do not restate the condition mechanically.",
].join("\n");

function buildUserPrompt(input: AuthorRuleInput): string {
  const facts = AUTHORABLE_FACT_KEYS.map(
    (f) => `- ${f}: ${FACT_GUIDE[f] ?? ""}`,
  ).join("\n");
  const scopeLine =
    input.scope.scope === "payer"
      ? `Scope: this rule applies to payer ${input.scope.payerId ?? "(unspecified)"} only.`
      : input.scope.scope === "tenant"
        ? "Scope: this rule applies to this clinic only."
        : "Scope: this rule applies to all payers (global).";
  return [
    "Available facts:",
    facts,
    "",
    `Available operators: ${SCRUB_OPERATORS.join(", ")}`,
    "",
    scopeLine,
    "",
    "Specialist's rule description:",
    input.smeText,
    "",
    "Produce the structured billing rule.",
  ].join("\n");
}

// AR post-processing (design-brief §4.3 digit law) on every text field — an EN
// field carrying a stray Arabic-Indic digit is normalized too. The condition tree
// is left untouched (its values are typed constants, not prose).
function normalizeDraft(draft: ScrubRuleDraft): ScrubRuleDraft {
  return {
    ...draft,
    name: normalizeArabicOutput(draft.name),
    message_en: normalizeArabicOutput(draft.message_en),
    message_ar: normalizeArabicOutput(draft.message_ar),
    rationale: normalizeArabicOutput(draft.rationale),
  };
}

export interface AuthorRuleOptions {
  actor: string;
  tenantId: string;
  pool: Pool;
  input: AuthorRuleInput;
  /** Test/dev injection; defaults to the anthropic-1p provider on the live path. */
  provider?: LlmProvider;
  env?: NodeJS.ProcessEnv;
}

export interface AuthorRuleResult {
  /** the normalized, UNVALIDATED draft — caller must gate + persist DISABLED. */
  draft: ScrubRuleDraft;
  /** concrete provider model id, for the rules-table provenance row. */
  model: string;
  /** sha256 of the exact system+user prompt, matching the llm_calls audit hash. */
  promptSha256: string;
}

/**
 * Generate a ScrubRule DRAFT from the SME's description. Throws AiDisabledError
 * when any kill switch is off (the caller falls back to manual authoring) and
 * AiConfigError when the feature is on but no provider is configured. The returned
 * draft is UNVALIDATED — the caller MUST run it through rules-engine's
 * validateAuthoredRule gate and persist it DISABLED before it can execute. The
 * model id + prompt hash ride along so the persisted rule records its provenance.
 */
export async function authorRule(
  opts: AuthorRuleOptions,
): Promise<AuthorRuleResult> {
  const env = opts.env ?? process.env;

  if (!isFeatureEnabled("authorRule", env)) {
    throw new AiDisabledError("feature 'authorRule' is disabled");
  }

  // Per-tenant kill switch (short txn; no txn held across the model call).
  const tenantOk = await withTenant(opts.pool, opts.tenantId, (db) =>
    isTenantAiEnabled(db),
  );
  if (!tenantOk) throw new AiDisabledError("tenant AI flag is off");

  if (opts.provider === undefined) {
    const missing = missingProviderConfig(env);
    if (missing) throw new AiConfigError(missing);
  }
  const provider = opts.provider ?? createAnthropicProvider();

  const system = SYSTEM_PROMPT;
  const user = buildUserPrompt(opts.input);
  // Same hash formula as the audited runner (run.ts) — links the persisted rule's
  // provenance to its llm_calls audit row without re-deriving the prompt.
  const promptSha256 = sha256Hex(`${system}\n${user}`);

  const parsed = await runStructured<ScrubRuleDraft>({
    actor: opts.actor,
    feature: "authorRule",
    pool: opts.pool,
    tenantId: opts.tenantId,
    provider,
    env,
    req: {
      model: "opus",
      system,
      user,
      schema: ScrubRuleDraftSchema,
      schemaName: "ScrubRuleDraft",
      maxTokens: 2048,
      cacheSystem: true,
    },
  });

  return {
    draft: normalizeDraft(parsed),
    model: provider.mapModelId("opus"),
    promptSha256,
  };
}
