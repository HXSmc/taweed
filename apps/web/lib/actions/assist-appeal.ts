"use server";
import { z } from "zod";
import { assistAppeal, isAiConfigError, isAiDisabledError } from "@taweed/ai";
import type { AppealSuggestion } from "@taweed/appeals";
import { authorizeAction } from "@/lib/authz";
import { appPool } from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import {
  getAppealDraft,
  recordSuggestion,
  recordSuppressedSuggestion,
  updateSuggestionOutcome,
} from "@/lib/appeals-data";

// AI-2 — additive appeal-draft assist (plan 04 §2, §4.2). Decision-support only:
// the reviewer keeps the deterministic template; the suggestion is a labelled DRAFT
// they insert, edit, or discard. Server-enforced RBAC + throttle (two billable
// model calls per request). Live use on real PHI stays gated behind the per-feature
// flag until BLK-AI-1 (counsel) + BLK-AI-2 (ZDR) clear — the feature returns
// {disabled} until then; synthetic operation is unrestricted.
const ASSIST_ROLES = ["full", "approve", "review", "evidence"] as const;

const ASSIST_RATE_LIMIT = 8;
const ASSIST_WINDOW_MS = 60_000;

// recordSuggestionEditAction is a cheap metadata write (no billable model
// call), but it is still an authenticated write path with no ceiling before
// this fix -- an actor could loop it to spam the rate_limit_windows-backed
// appPool with transactions. Give it its own, more generous budget than the
// AI-generation throttle above rather than reusing ASSIST_RATE_LIMIT, since
// legitimate use can call it once per suggestion (insert/edit/discard).
const EDIT_OUTCOME_RATE_LIMIT = 20;
const EDIT_OUTCOME_WINDOW_MS = 60_000;

export interface AssistAppealActionResult {
  ok: boolean;
  suggestion?: AppealSuggestion;
  /** appeal_suggestions row id, for edit-outcome tracking. */
  suggestionId?: string;
  disabled?: boolean;
  misconfigured?: boolean;
  suppressed?: boolean;
  error?: string;
}

const LocaleSchema = z.enum(["en", "ar"]);

/**
 * Generate a bilingual suggestion for a denial, or report why not. The deterministic
 * appeal letter is always available regardless of the outcome here.
 */
export async function assistAppealAction(
  denialId: string,
  locale: string,
): Promise<AssistAppealActionResult> {
  const session = await authorizeAction("appeals", [...ASSIST_ROLES]);
  if (!session) return { ok: false, error: "forbidden" };

  if (typeof denialId !== "string" || denialId.length === 0) {
    return { ok: false, error: "invalid" };
  }
  const loc = LocaleSchema.safeParse(locale).success
    ? (locale as "en" | "ar")
    : "en";

  if (
    !(await allowRequest(
      `assist:${session.tenantId}:${session.userId}`,
      ASSIST_RATE_LIMIT,
      ASSIST_WINDOW_MS,
    ))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const appeal = await getAppealDraft(session.tenantId, denialId);
  if (!appeal) return { ok: false, error: "not_found" };
  const ctx = appeal.context;

  try {
    const result = await assistAppeal({
      actor: session.userId,
      tenantId: session.tenantId,
      pool: appPool(),
      input: {
        facts: {
          claimRef: ctx.nphiesClaimId ?? ctx.claimId,
          sbsCode: ctx.sbsCode,
          denialCode: ctx.denialCode,
          atRiskSar: ctx.atRiskSar,
          serviceDate: ctx.serviceDate,
        },
        memberId: ctx.memberId,
        payerName: ctx.payerName,
        denialReasonLabel: appeal.reasonLabel,
      },
    });

    if (!result.ok) {
      // Record the suppression for the quality metric, then degrade gracefully.
      await recordSuppressedSuggestion(session.tenantId, {
        denialId,
        actor: session.email,
        locale: loc,
        model: "opus",
      }).catch(() => {});
      return { ok: false, suppressed: true };
    }

    const suggestionId = await recordSuggestion(session.tenantId, {
      denialId,
      actor: session.email,
      locale: loc,
      model: result.model,
      verifyScore: result.verifyScore,
      suggestionChars: loc === "ar" ? result.charsAr : result.charsEn,
    });

    return { ok: true, suggestion: result.suggestion, suggestionId };
  } catch (err) {
    if (isAiDisabledError(err)) return { ok: false, disabled: true };
    if (isAiConfigError(err)) return { ok: false, misconfigured: true };
    console.error("assistAppealAction failed", err);
    return { ok: false, error: "generation" };
  }
}

const OutcomeInput = z.object({
  suggestionId: z.string().uuid(),
  outcome: z.enum(["inserted", "edited", "discarded"]),
  editDistance: z.number().int().min(0).max(100_000).optional(),
  finalChars: z.number().int().min(0).max(100_000).optional(),
});

/**
 * Record what the reviewer did with a suggestion (the ongoing edit-distance metric).
 * Idempotent on a still-'suggested' row; a no-op afterwards.
 */
export async function recordSuggestionEditAction(
  suggestionId: string,
  outcome: "inserted" | "edited" | "discarded",
  editDistance?: number,
  finalChars?: number,
): Promise<{ ok: boolean }> {
  const session = await authorizeAction("appeals", [...ASSIST_ROLES]);
  if (!session) return { ok: false };

  if (
    !(await allowRequest(
      `assist-edit:${session.tenantId}:${session.userId}`,
      EDIT_OUTCOME_RATE_LIMIT,
      EDIT_OUTCOME_WINDOW_MS,
    ))
  ) {
    return { ok: false };
  }

  const parsed = OutcomeInput.safeParse({
    suggestionId,
    outcome,
    editDistance,
    finalChars,
  });
  if (!parsed.success) return { ok: false };
  const ok = await updateSuggestionOutcome(session.tenantId, suggestionId, {
    outcome: parsed.data.outcome,
    editDistance: parsed.data.editDistance,
    finalChars: parsed.data.finalChars,
  });
  return { ok };
}
