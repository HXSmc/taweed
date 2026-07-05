"use server";
import { authorizeAction } from "@/lib/authz";
import { withSession } from "@/lib/db";
import { SCRUBBER_RULES } from "@taweed/rules-engine";
import { explainFlag, type FlagExplanation } from "@taweed/ai";

// AI-1 — bilingual plain-language explanation of a scrub rule (plan 04 §2).
// Read-only decision support; anyone who can view the scrubber may request it.
const SCRUBBER_VIEW_ROLES = ["read", "full", "flag-only"] as const;

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

  const rule = SCRUBBER_RULES.find(
    (r) => r.id === ruleId && r.version === ruleVersion,
  );
  if (!rule) return null;

  try {
    return await withSession(session.tenantId, (db) =>
      explainFlag({
        actor: session.userId,
        db,
        flag: {
          ruleId: rule.id,
          ruleVersion: rule.version,
          ruleName: rule.name,
          field: rule.field,
          severity: rule.severity,
          message_en: rule.message_en,
          message_ar: rule.message_ar,
        },
      }),
    );
  } catch {
    // AI disabled, or a provider/parse failure — fall back to the deterministic
    // messages already on the row. The llm_calls audit row (if a call happened)
    // was written inside explainFlag before any throw, so there is still a trail.
    return null;
  }
}
