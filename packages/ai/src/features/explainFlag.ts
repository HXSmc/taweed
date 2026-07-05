import { and, eq, sql } from "drizzle-orm";
import { schema, type Database } from "@taweed/db";
import type { Severity } from "@taweed/rules-engine";
import { AiDisabledError } from "../errors.js";
import { isFeatureEnabled } from "../config.js";
import { normalizeArabicOutput } from "../postprocess-ar.js";
import { sha256Hex } from "../sha256.js";
import { runStructured, isTenantAiEnabled } from "../run.js";
import { createAnthropicProvider } from "../anthropic-1p.js";
import type { LlmProvider } from "../provider.js";
import {
  FlagExplanationSchema,
  type FlagExplanation,
} from "../schemas/flagExplanation.js";

// AI-1 — plain-language, bilingual explainer for a scrub flag (plan 04 §2).
// A scrub flag is PHI-FREE BY CONSTRUCTION: it carries only rule metadata and
// generic bilingual messages — never a claim id, patient field, amount, or date.
// The type has no such field; a runtime guard rejects any extra key so nothing
// PHI-bearing can reach the prompt. Additive: the deterministic message_en/ar
// are always shown; this explanation appears only when AI is enabled.
export interface ExplainableFlag {
  ruleId: string;
  ruleVersion: number;
  ruleName: string;
  field: string;
  severity: Severity;
  message_en: string;
  message_ar: string;
}

const ALLOWED_FLAG_KEYS: ReadonlySet<string> = new Set([
  "ruleId",
  "ruleVersion",
  "ruleName",
  "field",
  "severity",
  "message_en",
  "message_ar",
]);

/** Reject any key outside the PHI-free set — a claim/patient field must never reach the prompt. */
export function assertPhiFreeFlag(flag: Record<string, unknown>): void {
  for (const key of Object.keys(flag)) {
    if (!ALLOWED_FLAG_KEYS.has(key)) {
      throw new Error(
        `explainFlag: unexpected key "${key}" — the prompt must stay PHI-free (no claim/patient fields)`,
      );
    }
  }
}

// SFDA carve-out (02 §6): explain the BILLING rule only, never clinical judgment.
const SYSTEM_PROMPT = [
  "You explain medical-claim BILLING scrub rules to clinic revenue-cycle staff in Saudi Arabia.",
  "A pre-submission scrubber flagged a claim against an administrative/billing rule.",
  "Explain, in plain language, WHY the rule fired and HOW a biller corrects the claim before resubmission.",
  "",
  "HARD CONSTRAINTS:",
  "- Explain the BILLING/administrative rule only. NEVER suggest a diagnosis, clinical judgment, or treatment.",
  "- Do not invent claim-specific facts (amounts, dates, codes, patient details) — you are given none.",
  "- Provide an English explanation and a Modern Standard Arabic (MSA) explanation, plus a concrete billing fix in each language.",
  "- Keep each field to two or three sentences; concrete and actionable for a biller.",
].join("\n");

function buildUserPrompt(flag: ExplainableFlag): string {
  return [
    `Rule id: ${flag.ruleId}`,
    `Rule name: ${flag.ruleName}`,
    `Field flagged: ${flag.field}`,
    `Severity: ${flag.severity}`,
    `Deterministic message (English): ${flag.message_en}`,
    `Deterministic message (Arabic): ${flag.message_ar}`,
    "",
    "Explain why this billing rule fired and how a biller fixes it, in English and MSA.",
  ].join("\n");
}

export interface ExplainFlagOptions {
  actor: string;
  db: Database;
  flag: ExplainableFlag;
  /** Test/dev injection; defaults to the anthropic-1p provider on the live path. */
  provider?: LlmProvider;
  env?: NodeJS.ProcessEnv;
}

/**
 * Return the bilingual explanation for a scrub flag, generating + caching it on
 * first use per (tenant, rule, version). Throws AiDisabledError when any kill
 * switch is off — the caller (server action) catches it and shows only the
 * deterministic messages. MUST run inside withTenant(...).
 */
export async function explainFlag(
  opts: ExplainFlagOptions,
): Promise<FlagExplanation> {
  const env = opts.env ?? process.env;
  assertPhiFreeFlag({ ...(opts.flag as unknown as Record<string, unknown>) });

  // Kill switches first — a disabled tenant sees no AI at all (not even cached).
  if (!isFeatureEnabled("explain", env)) {
    throw new AiDisabledError("feature 'explain' is disabled");
  }
  if (!(await isTenantAiEnabled(opts.db))) {
    throw new AiDisabledError("tenant AI flag is off");
  }

  // Dedupe: each (rule, version) explained once per tenant (RLS scopes tenant).
  const cached = await opts.db
    .select()
    .from(schema.flagExplanations)
    .where(
      and(
        eq(schema.flagExplanations.rule_id, opts.flag.ruleId),
        eq(schema.flagExplanations.rule_version, opts.flag.ruleVersion),
      ),
    )
    .limit(1);
  const hit = cached[0];
  if (hit) {
    return {
      explanation_en: hit.explanation_en,
      explanation_ar: hit.explanation_ar,
      suggested_fix_en: hit.suggested_fix_en,
      suggested_fix_ar: hit.suggested_fix_ar,
    };
  }

  const provider = opts.provider ?? createAnthropicProvider();
  const system = SYSTEM_PROMPT;
  const user = buildUserPrompt(opts.flag);

  const parsed = await runStructured<FlagExplanation>({
    actor: opts.actor,
    feature: "explain",
    db: opts.db,
    provider,
    env,
    req: {
      model: "haiku",
      system,
      user,
      schema: FlagExplanationSchema,
      schemaName: "FlagExplanation",
      maxTokens: 1024,
      cacheSystem: true,
    },
  });

  // Deterministic AR post-processing (design-brief §4.3 digit law) before persist.
  const explanation: FlagExplanation = {
    explanation_en: parsed.explanation_en,
    explanation_ar: normalizeArabicOutput(parsed.explanation_ar),
    suggested_fix_en: parsed.suggested_fix_en,
    suggested_fix_ar: normalizeArabicOutput(parsed.suggested_fix_ar),
  };

  await opts.db
    .insert(schema.flagExplanations)
    .values({
      tenant_id: sql`current_setting('app.tenant_id')::uuid`,
      rule_id: opts.flag.ruleId,
      rule_version: opts.flag.ruleVersion,
      model: provider.mapModelId("haiku"),
      prompt_sha256: sha256Hex(`${system}\n${user}`),
      explanation_en: explanation.explanation_en,
      explanation_ar: explanation.explanation_ar,
      suggested_fix_en: explanation.suggested_fix_en,
      suggested_fix_ar: explanation.suggested_fix_ar,
    })
    // A concurrent explain of the same rule already inserted — keep the first.
    .onConflictDoNothing();

  return explanation;
}
