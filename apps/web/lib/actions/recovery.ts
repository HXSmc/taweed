"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@taweed/db";
import { resolveRecovery } from "@taweed/analytics";
import { logAudit } from "@taweed/audit";
import { authorizeAction } from "@/lib/authz";
import { withSession } from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import { SAR_MONEY_REGEX } from "@/lib/money";

const MONEY = SAR_MONEY_REGEX;
const Input = z.object({
  appealId: z.string().uuid(),
  outcome: z.enum(["won", "lost", "submitted"]),
  // Optional operator-stated recovered amount on a win (partial pay). Omitted =>
  // full recovery of the appealed amount. Clamped to the appealed ceiling (§8.5).
  recoveredSar: z.string().regex(MONEY).optional(),
});

// Per-tenant+actor throttle for this mutating action (common/security.md),
// mirroring every sibling mutating action in lib/actions/ (appeals.ts,
// eob-review.ts, assist-appeal.ts, author-rule.ts, eob-extract.ts, ingest.ts
// all call allowRequest). Without a ceiling, an already-authorized actor could
// loop this read + UPDATE + logAudit write with no limit.
const RECOVERY_RATE_LIMIT = 20;
const RECOVERY_WINDOW_MS = 60_000;

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
  // RBAC: only owner/finance/rcm (full) may change recovery outcomes. Checked
  // before input validation, matching every sibling action in lib/actions/
  // (e.g. eob-review.ts) — an unauthorized caller is turned away before
  // learning anything about expected input shape.
  const session = await authorizeAction("recovery", ["full"]);
  if (!session) return { ok: false };

  const parsed = Input.safeParse({ appealId, outcome, recoveredSar });
  if (!parsed.success) return { ok: false };

  // Throttle before the read + UPDATE + audit-write transaction below.
  if (
    !(await allowRequest(
      `recovery:${session.tenantId}:${session.userId}`,
      RECOVERY_RATE_LIMIT,
      RECOVERY_WINDOW_MS,
    ))
  ) {
    return { ok: false };
  }

  const resolution = await withSession(session.tenantId, async (db) => {
    // Look up the appealed amount + the owning denial (RLS-scoped) — the
    // ceiling for recovery. SELECT ... FOR UPDATE locks the owning denials row
    // for the rest of this transaction, serializing concurrent
    // markAppealOutcome calls that share this denial_id: the second caller
    // blocks here until the first commits, so its sibling-recovered sum read
    // below reflects the first caller's committed write instead of racing on
    // a stale 0. Closes the TOCTOU double-recovery finding
    // (docs/audit docs/bugs.md #1) the same way onboarding.ts serializes its
    // read-then-write — via a transaction-scoped row lock rather than a
    // separate advisory lock, since the denials row is the natural contention
    // point and this adds no extra round-trip.
    const rows = await db.execute<{ denied_amount: string; denial_id: string }>(sql`
      SELECT d.denied_amount, d.id AS denial_id FROM appeals a
        JOIN denials d ON d.id = a.denial_id
       WHERE a.id = ${appealId}
       LIMIT 1
      FOR UPDATE OF d`);
    const appeal = rows.rows[0];
    // No such appeal for this tenant (stale/wrong/deleted id, or RLS-scoped out):
    // do NOTHING. Otherwise the UPDATE below matches 0 rows yet we'd still write a
    // spurious 'write' audit row and report ok:true for a change that never happened.
    if (!appeal) return null;
    const appealedSar = appeal.denied_amount;

    // Sum what sibling won appeals on the SAME denial have already recovered
    // (excluding this appeal itself) — without this, a denial with more than
    // one appeal (e.g. a resubmission) could recover its full denied amount
    // more than once, breaking recovered + at_risk === total denied.
    const siblingRows = await db.execute<{ already_recovered: string | null }>(sql`
      SELECT COALESCE(SUM(a.recovered_amount), 0) AS already_recovered
        FROM appeals a
       WHERE a.denial_id = ${appeal.denial_id}
         AND a.id != ${appealId}
         AND a.status = 'won'`);
    const alreadyRecoveredSar = siblingRows.rows[0]?.already_recovered ?? "0";

    // B8 guardrail: recovered can never exceed appealed, never go negative,
    // and never double-book a sibling appeal's already-recovered amount.
    const r = resolveRecovery({
      outcome,
      appealedSar,
      requestedRecoveredSar: recoveredSar,
      alreadyRecoveredSar,
    });

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

  // Appeal not found for this tenant → nothing was changed or audited.
  if (!resolution) return { ok: false };

  // Revalidate the whole authenticated layout so the ROI band, overview, and the
  // command-bar money indicator all recompute.
  revalidatePath("/[locale]/(app)", "layout");
  return {
    ok: true,
    corrected: resolution.corrected,
    recoveredSar: resolution.recoveredSar,
  };
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
    const result = await markAppealOutcome(appealId, outcome, recoveredSar);
    // Surface failures instead of swallowing them. markAppealOutcome returns
    // {ok:false} — deliberately detail-free so it can't leak RBAC/RLS state —
    // when the caller is unauthorized, the input is invalid, the per-tenant
    // throttle trips, or the appeal isn't found for this tenant. Previously
    // this return was discarded (`await ... ` with no use), so a failed "mark
    // won/lost" was indistinguishable from a successful no-op: the operator
    // clicked and nothing visibly happened (e.g. an admin/read-only or
    // clinician/hidden role, or a stale appeal id). A server-action <form>
    // already re-renders the page on success; on failure we redirect with a
    // flag so the page renders an inline error region (settings.actionFailed).
    if (!result.ok) {
      // Locale comes from the next-intl middleware request header (set on the
      // form POST by apps/web/middleware.ts), so we don't pull next-auth into
      // this action just to read it off the session.
      const locale = (await headers()).get("x-next-intl-locale") ?? "en";
      redirect(`/${locale}/recovery?recoveryError=1`);
    }
  }
}
