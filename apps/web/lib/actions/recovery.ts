"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@taweed/db";
import { logAudit } from "@taweed/audit";
import { getSession } from "@/lib/session";
import { withSession } from "@/lib/db";

const Input = z.object({
  appealId: z.string().uuid(),
  outcome: z.enum(["won", "lost", "submitted"]),
});

// Mark an appeal won/lost/submitted. Recovered SAR on a win is derived from the
// denial's denied_amount (partial-pay realism); the change writes an AuditLog and
// revalidates so the ROI band + global money indicator recompute. Tenant is
// derived from the session; RLS + the composite same-tenant FK guarantee the
// appeal belongs to this tenant.
export async function markAppealOutcome(
  appealId: string,
  outcome: "won" | "lost" | "submitted",
): Promise<{ ok: boolean }> {
  const parsed = Input.safeParse({ appealId, outcome });
  if (!parsed.success) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };

  await withSession(session.tenantId, async (db) => {
    // Look up the appealed amount (RLS-scoped) to compute recovered on a win.
    const rows = await db.execute<{ denied_amount: string }>(sql`
      SELECT d.denied_amount FROM appeals a
        JOIN denials d ON d.id = a.denial_id
       WHERE a.id = ${appealId} LIMIT 1`);
    const denied = Number(rows.rows[0]?.denied_amount ?? "0");
    const recovered = outcome === "won" ? (denied * 0.85).toFixed(2) : null;

    await db
      .update(schema.appeals)
      .set({
        status: outcome,
        recovered_amount: recovered,
        submitted_at: new Date(),
      })
      .where(eq(schema.appeals.id, appealId));

    await logAudit(db, {
      actor: session.email,
      action: "write",
      entity: "appeal",
      entityId: appealId,
    });
  });

  // Revalidate the whole authenticated layout so the ROI band, overview, and the
  // command-bar money indicator all recompute.
  revalidatePath("/[locale]/(app)", "layout");
  return { ok: true };
}

/** Form-action shape (returns void): reads appealId + outcome from the form. */
export async function markAppealOutcomeForm(formData: FormData): Promise<void> {
  const appealId = String(formData.get("appealId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  if (outcome === "won" || outcome === "lost" || outcome === "submitted") {
    await markAppealOutcome(appealId, outcome);
  }
}
