import "server-only";
import { withTenant, type Pool } from "@taweed/db";
import { glossaryPromptLines } from "@taweed/shared";
import { AiConfigError, AiDisabledError } from "../errors.js";
import { isFeatureEnabled, missingProviderConfig } from "../config.js";
import {
  normalizeArabicOutput,
  normalizeArabicDigits,
} from "../postprocess-ar.js";
import { pseudonymize } from "../pseudonymize.js";
import { runStructured, isTenantAiEnabled } from "../run.js";
import { createAnthropicProvider } from "../anthropic-1p.js";
import type { LlmProvider } from "../provider.js";
import {
  buildFactSlots,
  slotLegend,
  detokenizeSlots,
  checkParagraphs,
  type AppealFacts,
  type AppealSuggestion,
  type SlotMap,
} from "../appeal-guardrails.js";
import {
  AppealAssistSchema,
  AppealVerifySchema,
  type AppealAssist,
} from "../schemas/appealAssist.js";

// AI-2 — additive EN/AR appeal-draft assist (plan 04 §2, §4.2). ADDITIVE by design:
// the deterministic bilingual template stays the primary output; this returns
// clearly-labelled DRAFT paragraphs a reviewer may insert, edit, or discard. The
// safety chain (in order): pseudonymize identifiers → slot-fill facts (digit-free)
// → generate → deterministic paragraph gate (no invented numbers / unknown slots)
// → second-model verify (register + consistency) → AR post-process → detokenize
// LAST. Any gate failure suppresses the suggestion (fail closed to template-only).
//
// Live use on real PHI is GATED behind the per-feature flag until BLK-AI-1 (counsel
// pseudonymization sign-off) + BLK-AI-2 (ZDR org) clear; synthetic operation is
// unrestricted. clinicalNote free text is EXCLUDED by default (statistical NER is
// not load-bearing — plan §4.4); only structured facts + a pseudonymized member id
// reach the model.

export interface AssistAppealInput {
  facts: AppealFacts;
  /** PHI identifier — pseudonymized to an opaque token before the model sees it. */
  memberId: string;
  payerName: string;
  /** EN label of the denial reason, for argumentative context (not PHI). */
  denialReasonLabel: string;
}

// A verify overall score below this suppresses the suggestion (0-100). Conservative:
// a middling draft is not shown; the reviewer keeps the deterministic letter.
const VERIFY_MIN_OVERALL = 60;
const MEMBER_TOKEN_COLUMN = "member_id";

const SYSTEM_PROMPT = [
  "You draft argumentative paragraphs for a medical-claim appeal letter to a Saudi Arabian payer (NPHIES).",
  "You write ONLY persuasive prose. Every amount, date, code, and identifier is given to you as a bracketed TOKEN (e.g. [AMOUNT_DENIED], [MEMBER_ID_1]). Reference the token verbatim; NEVER write a number, a date, a code, or an identifier yourself, and NEVER invent an authorization number or figure.",
  "Produce a short set of English paragraphs AND a matching set of Modern Standard Arabic paragraphs. Author the Arabic DIRECTLY in formal MSA with proper honorifics — do not translate word-for-word.",
  "",
  "HARD CONSTRAINTS (safety-critical):",
  "- Argue the ADMINISTRATIVE / billing basis for reconsideration only: coverage, eligibility, prior authorization, correct coding, or attached documentation. NEVER assert a clinical diagnosis, medical necessity judgment, or treatment decision yourself — where clinical support matters, refer to the attached clinical documentation rather than stating a clinical conclusion.",
  "- Do not restate the claim's facts numerically. Refer to them only through their tokens.",
  "- Keep it concise: two or three short paragraphs per language, ready for a human reviewer to insert into the letter.",
].join("\n");

function buildUserPrompt(
  input: AssistAppealInput,
  memberToken: string,
  facts: AppealFacts,
): string {
  return [
    `Payer: ${input.payerName}`,
    `Denial reason: ${input.denialReasonLabel}`,
    `Member (pseudonymized): ${memberToken}`,
    "",
    "Fact tokens you may reference:",
    slotLegend(facts),
    "",
    "Prefer these bilingual terms where relevant:",
    glossaryPromptLines(),
    "",
    "Write the argumentative appeal paragraphs (English and MSA).",
  ].join("\n");
}

const VERIFY_SYSTEM = [
  "You are a reviewer of a draft medical-claim appeal. You are shown tokenized paragraphs (facts appear as [TOKENS]).",
  "Score the draft 0-100 on three axes and give an overall score:",
  "- factual_consistency: does the argument stay consistent with the tokenized facts and invent nothing?",
  "- msa_register: is the Arabic formal Modern Standard Arabic with correct register and honorifics?",
  "- completeness: does it make a coherent administrative case for reconsideration?",
  "List concrete issues. Be strict — a middling draft should score below 60.",
].join("\n");

function buildVerifyPrompt(assist: AppealAssist): string {
  return [
    "English paragraphs:",
    ...assist.paragraphs_en.map((p, i) => `${i + 1}. ${p}`),
    "",
    "Arabic paragraphs:",
    ...assist.paragraphs_ar.map((p, i) => `${i + 1}. ${p}`),
    "",
    "Score the draft.",
  ].join("\n");
}

export type AssistAppealResult =
  | {
      ok: true;
      suggestion: AppealSuggestion;
      verifyScore: number;
      model: string;
      charsEn: number;
      charsAr: number;
    }
  | { ok: false; suppressed: true; reason: string };

export interface AssistAppealOptions {
  actor: string;
  tenantId: string;
  pool: Pool;
  input: AssistAppealInput;
  provider?: LlmProvider;
  env?: NodeJS.ProcessEnv;
  /** injected clock for the pseudonymizer (age banding); defaults to now. */
  now?: Date;
}

function clamp0to100(n: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Produce a bilingual suggestion for a denial, or suppress it. Throws
 * AiDisabledError (kill switch off) / AiConfigError (enabled but unconfigured);
 * returns {ok:false, suppressed} when a guardrail rejects the draft — in every
 * fail case the caller keeps the deterministic template. On success returns the
 * detokenized suggestion plus the verify score + char counts for edit tracking.
 */
export async function assistAppeal(
  opts: AssistAppealOptions,
): Promise<AssistAppealResult> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();

  if (!isFeatureEnabled("appeal", env)) {
    throw new AiDisabledError("feature 'appeal' is disabled");
  }
  const tenantOk = await withTenant(opts.pool, opts.tenantId, (db) =>
    isTenantAiEnabled(db),
  );
  if (!tenantOk) throw new AiDisabledError("tenant AI flag is off");
  if (opts.provider === undefined) {
    const missing = missingProviderConfig(env);
    if (missing) throw new AiConfigError(missing);
  }
  const provider = opts.provider ?? createAnthropicProvider();

  // 1. Pseudonymize the one PHI identifier (member id) — the load-bearing PHI
  //    control. Free text is not included, so nothing PHI-dense reaches the model.
  const pseudo = pseudonymize(
    { [MEMBER_TOKEN_COLUMN]: opts.input.memberId },
    { identifiers: { [MEMBER_TOKEN_COLUMN]: "MEMBER_ID" } },
    now,
  );
  const memberToken = pseudo.record[MEMBER_TOKEN_COLUMN] ?? "[MEMBER_ID_1]";

  // 2. Digit-free fact slots + merge the pseudonym token into the known-token set.
  const factSlots = buildFactSlots(opts.input.facts);
  const slots: SlotMap = { ...factSlots, ...pseudo.detokenMap };

  // 3. Generate (Opus). Audited via runStructured.
  const assist = await runStructured<AppealAssist>({
    actor: opts.actor,
    feature: "appeal",
    pool: opts.pool,
    tenantId: opts.tenantId,
    provider,
    env,
    req: {
      model: "opus",
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(opts.input, memberToken, opts.input.facts),
      schema: AppealAssistSchema,
      schemaName: "AppealAssist",
      maxTokens: 2048,
      cacheSystem: true,
    },
  });

  // 4. Deterministic paragraph gate (per language) — no invented numbers, no
  //    unknown slots, non-empty. Fail closed.
  const enCheck = checkParagraphs(assist.paragraphs_en, slots);
  if (!enCheck.ok) {
    return { ok: false, suppressed: true, reason: `en:${enCheck.reason}` };
  }
  const arCheck = checkParagraphs(assist.paragraphs_ar, slots);
  if (!arCheck.ok) {
    return { ok: false, suppressed: true, reason: `ar:${arCheck.reason}` };
  }

  // 5. Second-model verify (Sonnet judge) over the TOKENIZED draft — no PHI to the
  //    judge. Audited. A low overall score suppresses the suggestion.
  const verify = await runStructured({
    actor: opts.actor,
    feature: "appeal",
    pool: opts.pool,
    tenantId: opts.tenantId,
    provider,
    env,
    req: {
      model: "sonnet",
      system: VERIFY_SYSTEM,
      user: buildVerifyPrompt(assist),
      schema: AppealVerifySchema,
      schemaName: "AppealVerify",
      maxTokens: 1024,
      cacheSystem: true,
    },
  });
  const overall = clamp0to100(verify.overall);
  if (overall < VERIFY_MIN_OVERALL) {
    return { ok: false, suppressed: true, reason: `verify:${overall}` };
  }

  // 6. Detokenize (real values appear only after every CHECK has passed), THEN
  //    format: AR gets the full digit + bidi law (Latin codes isolated); EN gets
  //    digit normalization only (Latin isolation would mangle already-LTR prose and
  //    is meaningless there). Detokenize MUST precede AR isolation, or the bidi
  //    marks would break the slot tokens before they can be substituted.
  const paragraphs_en = assist.paragraphs_en.map((p) =>
    normalizeArabicDigits(detokenizeSlots(p, slots)),
  );
  const paragraphs_ar = assist.paragraphs_ar.map((p) =>
    normalizeArabicOutput(detokenizeSlots(p, slots)),
  );

  const charsEn = paragraphs_en.join("\n").length;
  const charsAr = paragraphs_ar.join("\n").length;

  return {
    ok: true,
    suggestion: { paragraphs_en, paragraphs_ar },
    verifyScore: overall,
    model: provider.mapModelId("opus"),
    charsEn,
    charsAr,
  };
}
