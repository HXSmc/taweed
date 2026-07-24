"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "drizzle-orm";
import { captureBaseline, getLatestBaseline } from "@taweed/analytics";
import { logAudit } from "@taweed/audit";
import { getSession } from "@/lib/session";
import { withSession } from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import { analyticsTag } from "@/lib/cache-tags";

// Per-tenant+actor throttle for this mutating action, mirroring every sibling
// action in this directory (ingest.ts, recovery.ts, appeals.ts, ...).
const ONBOARDING_RATE_LIMIT = 5;
const ONBOARDING_WINDOW_MS = 60_000;

export interface CompleteOnboardingResult {
  ok: boolean;
}

/**
 * A2 corridor step 4 (first-insight handoff). Captures the EXECUTE B8 recovery
 * baseline exactly once for the tenant — its presence is what `isOnboarded()`
 * checks, so this is the one write that flips a tenant from "first-run" to
 * "activated". No RBAC module gate: any authenticated member of the tenant may
 * complete onboarding for their tenant (this is a one-time system transition,
 * not a persistent nav-gated capability like the five module surfaces).
 */
export async function completeOnboarding(): Promise<CompleteOnboardingResult> {
  const session = await getSession();
  if (!session) return { ok: false };

  const allowed = await allowRequest(
    `onboarding:${session.tenantId}:${session.userId}`,
    ONBOARDING_RATE_LIMIT,
    ONBOARDING_WINDOW_MS,
  );
  if (!allowed) return { ok: false };

  await withSession(session.tenantId, async (db) => {
    // Closes a TOCTOU race (security-review finding): without a lock, two
    // concurrent calls for the same tenant could both observe no baseline
    // and both insert one (recovery_baselines has no unique constraint on
    // tenant_id). A per-tenant advisory lock, released automatically at
    // transaction end, serializes concurrent callers so the read-then-write
    // below is genuinely idempotent, not just idempotent-in-the-common-case.
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${session.tenantId}))`);
    const existing = await getLatestBaseline(db);
    if (existing) return;
    await captureBaseline(db, "onboarding");
    await logAudit(db, {
      actor: session.email,
      action: "write",
      entity: "recovery_baseline",
      entityId: session.tenantId,
    });
  });

  revalidatePath("/[locale]", "layout");
  // The baseline capture above changes what getRecovery/getOwnerReportData's
  // cached bundles read via getLatestBaseline (apps/web/lib/data.ts) — without
  // this, a tenant who viewed Recovery/Owner-report pre-onboarding (baseline
  // still null) could see stale data for up to the cache's TTL right after
  // completing onboarding, exactly the "first-insight" moment this action
  // exists for. Found in Phase 4 validation (architecture/correctness review).
  revalidateTag(analyticsTag(session.tenantId));
  return { ok: true };
}
