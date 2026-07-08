"use server";
import { authorizeAction } from "@/lib/authz";
import { appPool } from "@/lib/db";
import { SCRUBBER_RULES } from "@taweed/rules-engine";
import {
  explainFlag,
  isAiDisabledError,
  type FlagExplanation,
} from "@taweed/ai";
import { allowRequest } from "@/lib/rate-limit";

// AI-1 — bilingual plain-language explanation of a scrub rule (plan 04 §2).
// Read-only decision support; anyone who can view the scrubber may request it.
const SCRUBBER_VIEW_ROLES = ["read", "full", "flag-only"] as const;

// Per-tenant+actor throttle for this BILLABLE endpoint (common/security.md): a
// cache miss triggers a paid model call, and the client's loading guard is
// UI-only + bypassable, so a burst of parallel direct calls could each pay.
const EXPLAIN_RATE_LIMIT = 30;
const EXPLAIN_WINDOW_MS = 60_000;

/**
 * Return the bilingual explanation for the rule (id, version) that fired, or
 * null. Additive: the deterministic messages are always shown; a null here just
 * means "no AI explanation" (kill switch off, or a provider/parse failure) — the
 * UI degrades gracefully. The prompt is re-derived from the authoritative rule
 * library, so the client never injects text into the LLM (PHI-free + no injection).
 */
export async function explainFlagAction(
  ruleId: string,
  ruleVersion: number,
): Promise<FlagExplanation | null> {
  const session = await authorizeAction("scrubber", [...SCRUBBER_VIEW_ROLES]);
  if (!session) return null;

  // Throttle server-side — the UI loading guard is bypassable on a public action.
  if (
    !(await allowRequest(
      `explain:${session.tenantId}:${session.userId}`,
      EXPLAIN_RATE_LIMIT,
      EXPLAIN_WINDOW_MS,
    ))
  ) {
    console.warn(
      `explainFlagAction rate limit exceeded (tenant=${session.tenantId} actor=${session.userId})`,
    );
    return null; // graceful — deterministic messages still render
  }

  // Boundary validation — a Server Action is a public HTTP endpoint (react/
  // security.md). These only drive a strict-equality lookup below, but validate
  // anyway so malformed input fails fast rather than reaching the feature.
  if (typeof ruleId !== "string" || !Number.isInteger(ruleVersion)) return null;

  const rule = SCRUBBER_RULES.find(
    (r) => r.id === ruleId && r.version === ruleVersion,
  );
  if (!rule) return null;

  try {
    return await explainFlag({
      actor: session.userId,
      tenantId: session.tenantId,
      pool: appPool(),
      flag: {
        ruleId: rule.id,
        ruleVersion: rule.version,
        ruleName: rule.name,
        field: rule.field,
        severity: rule.severity,
        message_en: rule.message_en,
        message_ar: rule.message_ar,
      },
    });
  } catch (err) {
    // AiDisabledError is the expected "AI off" path — fall back silently to the
    // deterministic messages already on the row. Anything else is a real
    // provider/DB/programming failure: log it server-side so ops has a signal,
    // then still fall back (the feature is additive, never load-bearing).
    if (!isAiDisabledError(err)) {
      console.error("explainFlagAction failed", err);
    }
    return null;
  }
}
