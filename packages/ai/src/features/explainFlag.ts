import { and, eq, sql } from "drizzle-orm";
import { withTenant, schema, type Pool } from "@taweed/db";
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

// SFDA carve-out (02 §6, plan 04 §3.4): explain the BILLING rule only, never
// clinical judgment. The constraints below are the load-bearing safety control
// for this PHI-free surface; they also forbid payment-motivated code changes
// (upcoding/unbundling) — a fraud/abuse gap adjacent to the SFDA carve-out.
const SYSTEM_PROMPT = [
  "You explain medical-claim BILLING scrub rules to clinic revenue-cycle staff in Saudi Arabia.",
  "A pre-submission scrubber flagged a claim against an administrative/billing rule.",
  "Explain, in plain language, WHY the rule fired and HOW a biller corrects the claim before resubmission.",
  "",
  "HARD CONSTRAINTS (safety-critical):",
  "- Explain the BILLING/administrative rule only. NEVER suggest, imply, or reason about a diagnosis, a clinical judgment, a treatment, or medical necessity.",
  "- NEVER advise adding, removing, upcoding, or changing a diagnosis or procedure code to obtain or increase payment. The fix must be administrative only: correcting a data-entry field, attaching required documentation or pre-authorization, verifying eligibility, or resubmitting through the correct channel.",
  "- If a correct fix would require a clinical decision (e.g. which diagnosis applies), say the claim must be returned to the treating clinician — do NOT make the clinical call yourself.",
  "- Do not invent claim-specific facts (amounts, dates, codes, patient details) — you are given none. Do not state specific numeric deadlines, counts, or amounts unless they are well-established general NPHIES rules; prefer 'the payer's resubmission window' over a specific number of days.",
  "- Provide an English explanation and a Modern Standard Arabic (MSA) explanation, plus a concrete administrative fix in each language.",
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

// The stored row shape we read back (a subset of flag_explanations).
interface ExplanationRow {
  explanation_en: string;
  explanation_ar: string;
  suggested_fix_en: string;
  suggested_fix_ar: string;
}

function toExplanation(row: ExplanationRow): FlagExplanation {
  return {
    explanation_en: row.explanation_en,
    explanation_ar: row.explanation_ar,
    suggested_fix_en: row.suggested_fix_en,
    suggested_fix_ar: row.suggested_fix_ar,
  };
}

export interface ExplainFlagOptions {
  actor: string;
  tenantId: string;
  /** app-role pool; each DB step runs in a SHORT withTenant transaction (no txn held across the LLM call). */
  pool: Pool;
  flag: ExplainableFlag;
  /** Test/dev injection; defaults to the anthropic-1p provider on the live path. */
  provider?: LlmProvider;
  env?: NodeJS.ProcessEnv;
}

/**
 * Return the bilingual explanation for a scrub flag, generating + caching it on
 * first use per (tenant, rule, version). Throws AiDisabledError when any kill
 * switch is off — the caller (server action) catches it and shows only the
 * deterministic messages. Manages its own short transactions via `pool` so the
 * live model call is never wrapped in a held DB transaction.
 */
export async function explainFlag(
  opts: ExplainFlagOptions,
): Promise<FlagExplanation> {
  const env = opts.env ?? process.env;
  assertPhiFreeFlag({ ...(opts.flag as unknown as Record<string, unknown>) });

  // Feature switch (env only) fails fast before any DB/provider work.
  if (!isFeatureEnabled("explain", env)) {
    throw new AiDisabledError("feature 'explain' is disabled");
  }

  // Short txn: per-tenant kill switch + dedupe cache read. A disabled tenant
  // sees no AI at all — not even a cached explanation.
  const gate = await withTenant(opts.pool, opts.tenantId, async (db) => {
    if (!(await isTenantAiEnabled(db))) return { enabled: false as const };
    const rows = await db
      .select()
      .from(schema.flagExplanations)
      .where(
        and(
          eq(schema.flagExplanations.rule_id, opts.flag.ruleId),
          eq(schema.flagExplanations.rule_version, opts.flag.ruleVersion),
        ),
      )
      .limit(1);
    return { enabled: true as const, hit: rows[0] };
  });
  if (!gate.enabled) throw new AiDisabledError("tenant AI flag is off");
  if (gate.hit) return toExplanation(gate.hit);

  const provider = opts.provider ?? createAnthropicProvider();
  const system = SYSTEM_PROMPT;
  const user = buildUserPrompt(opts.flag);

  // The provider call + its audit row happen here (audit inside a short txn).
  const parsed = await runStructured<FlagExplanation>({
    actor: opts.actor,
    feature: "explain",
    pool: opts.pool,
    tenantId: opts.tenantId,
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

  // Deterministic AR post-processing (design-brief §4.3 digit law) on ALL fields
  // — an EN field carrying a stray Arabic-Indic digit is normalized too.
  const explanation: FlagExplanation = {
    explanation_en: normalizeArabicOutput(parsed.explanation_en),
    explanation_ar: normalizeArabicOutput(parsed.explanation_ar),
    suggested_fix_en: normalizeArabicOutput(parsed.suggested_fix_en),
    suggested_fix_ar: normalizeArabicOutput(parsed.suggested_fix_ar),
  };

  // Short txn: persist (idempotent) then re-read the CANONICAL row, so if a
  // concurrent caller won the insert, both callers return the same cached text.
  const canonical = await withTenant(opts.pool, opts.tenantId, async (db) => {
    await db
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
      .onConflictDoNothing();
    const rows = await db
      .select()
      .from(schema.flagExplanations)
      .where(
        and(
          eq(schema.flagExplanations.rule_id, opts.flag.ruleId),
          eq(schema.flagExplanations.rule_version, opts.flag.ruleVersion),
        ),
      )
      .limit(1);
    return rows[0];
  });

  return canonical ? toExplanation(canonical) : explanation;
}
