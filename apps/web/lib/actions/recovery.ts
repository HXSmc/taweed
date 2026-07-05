"use server";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@taweed/db";
import { resolveRecovery } from "@taweed/analytics";
import { logAudit } from "@taweed/audit";
import { authorizeAction } from "@/lib/authz";
import { withSession } from "@/lib/db";

const MONEY = /^\d+(\.\d{1,2})?$/;
const Input = z.object({
  appealId: z.string().uuid(),
  outcome: z.enum(["won", "lost", "submitted"]),
  // Optional operator-stated recovered amount on a win (partial pay). Omitted =>
  // full recovery of the appealed amount. Clamped to the appealed ceiling (§8.5).
  recoveredSar: z.string().regex(MONEY).optional(),
});

export interface RecoveryOutcomeResult {
  ok: boolean;
  /** True when the recovered amount was clamped to the appealed ceiling (§8.5). */
  corrected?: boolean;
  recoveredSar?: string | null;
}

// Mark an appeal won/lost/submitted. Recovered SAR on a win is derived from the
// denial's denied_amount (partial-pay realism); the change writes an AuditLog and
// revalidates so the ROI band + global money indicator recompute. Tenant is
// derived from the session; RLS + the composite same-tenant FK guarantee the
// appeal belongs to this tenant.
export async function markAppealOutcome(
  appealId: string,
  outcome: "won" | "lost" | "submitted",
  recoveredSar?: string,
): Promise<RecoveryOutcomeResult> {
  const parsed = Input.safeParse({ appealId, outcome, recoveredSar });
  if (!parsed.success) return { ok: false };
  // RBAC: only owner/finance/rcm (full) may change recovery outcomes.
  const session = await authorizeAction("recovery", ["full"]);
  if (!session) return { ok: false };

  const resolution = await withSession(session.tenantId, async (db) => {
    // Look up the appealed amount (RLS-scoped) — the ceiling for recovery.
    const rows = await db.execute<{ denied_amount: string }>(sql`
      SELECT d.denied_amount FROM appeals a
        JOIN denials d ON d.id = a.denial_id
       WHERE a.id = ${appealId} LIMIT 1`);
    const appealedSar = rows.rows[0]?.denied_amount ?? "0.00";

    // B8 guardrail: recovered can never exceed appealed, never go negative.
    const r = resolveRecovery({ outcome, appealedSar, requestedRecoveredSar: recoveredSar });

    await db
      .update(schema.appeals)
      .set({
        status: outcome,
        recovered_amount: r.recoveredSar,
        submitted_at: new Date(),
      })
      .where(eq(schema.appeals.id, appealId));

    await logAudit(db, {
      actor: session.email,
      action: "write",
      entity: "appeal",
      entityId: appealId,
    });
    // The clamp (§8.5) is surfaced to the operator via the return value for an
    // inline correction; the audit row records the write itself (PHI-safe fields
    // only — the audit guard rejects any extra key).
    return r;
  });

  // Revalidate the whole authenticated layout so the ROI band, overview, and the
  // command-bar money indicator all recompute.
  revalidatePath("/[locale]/(app)", "layout");
  return { ok: true, corrected: resolution.corrected, recoveredSar: resolution.recoveredSar };
}

/** Form-action shape (returns void): reads appealId + outcome (+ optional recovered) from the form. */
export async function markAppealOutcomeForm(formData: FormData): Promise<void> {
  const appealId = String(formData.get("appealId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const recoveredRaw = formData.get("recoveredSar");
  const recoveredSar =
    typeof recoveredRaw === "string" && recoveredRaw.length > 0
      ? recoveredRaw
      : undefined;
  if (outcome === "won" || outcome === "lost" || outcome === "submitted") {
    await markAppealOutcome(appealId, outcome, recoveredSar);
  }
}
