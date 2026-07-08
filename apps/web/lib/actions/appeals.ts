"use server";
import { authorizeAction } from "@/lib/authz";
import { recordPhiAccess } from "@/lib/audit";
import { getAppealDraft, type AppealResult } from "@/lib/appeals-data";
import { allowRequest } from "@/lib/rate-limit";

// Roles that may work an appeal (view/generate/export). admin is read-only for
// appeals and cannot export a PHI letter.
const APPEAL_ROLES = ["approve", "review", "full", "evidence"] as const;

// Per-tenant+actor throttles for these PHI-bearing actions (common/security.md),
// mirroring the same-directory AI actions (explain-flag.ts, author-rule.ts,
// eob-extract.ts, ingest.ts all call allowRequest). Without a ceiling, an
// already-authorized actor could hammer either action to generate/scrape
// PHI letters, or write compliance-audit rows, faster than intended.
const LOAD_RATE_LIMIT = 30;
const LOAD_WINDOW_MS = 60_000;
const EXPORT_RATE_LIMIT = 10;
const EXPORT_WINDOW_MS = 60_000;

// Loading a draft reads the claim + patient context (PHI) → audit read. admin's
// "read" capability is deliberately excluded here (not just from the export
// gate below): admin is read-only for the appeals MODULE (e.g. status/queue
// visibility), not entitled to the full bilingual PHI letter content
// (pdfEn/pdfAr) that this returns.
export async function loadAppealDraft(denialId: string): Promise<AppealResult | null> {
  const session = await authorizeAction("appeals", [...APPEAL_ROLES]);
  if (!session) return null;

  // Throttle before touching PHI — an over-budget caller must not trigger the
  // draft fetch/assembly below.
  if (
    !(await allowRequest(
      `appeal-draft:${session.tenantId}:${session.userId}`,
      LOAD_RATE_LIMIT,
      LOAD_WINDOW_MS,
    ))
  ) {
    return null;
  }

  let result: AppealResult | null;
  try {
    result = await getAppealDraft(session.tenantId, denialId);
  } catch {
    // Surface as "no draft" rather than an unhandled rejection (spinner-forever).
    return null;
  }
  if (result) {
    try {
      await recordPhiAccess("read", "appeal-draft", denialId);
    } catch {
      // The fetch already succeeded; an audit-write failure must not lose it
      // (same tolerant posture as ingestBundle's own audit write).
    }
  }
  return result;
}

// Exporting the letter is a PHI export → audit export. The human-in-the-loop
// review gate is enforced in the UI; this records that an export occurred and is
// awaited so an export never completes without its compliance record.
//
// Audit-integrity note: letters are generated on-demand from claim data, never
// stored, so "a denialId for which no letter was ever generated" maps exactly
// to getAppealDraft returning null for it. Requiring a non-null draft here
// (tenant-scoped, via the caller's own session) before writing the audit row
// closes the fabrication vector — a caller cannot manufacture a compliance
// record for a denial that has no real, tenant-scoped appeal data. This does
// NOT prove a prior loadAppealDraft call actually happened for this denial
// (no cross-action sequencing state is tracked), nor does it prevent the
// opposite gap — a client completing a real export without ever invoking this
// action; both are out of scope for a server-side check confined to this
// action.
export async function recordAppealExport(denialId: string): Promise<{ ok: boolean }> {
  const session = await authorizeAction("appeals", [...APPEAL_ROLES]);
  if (!session) return { ok: false };

  if (
    !(await allowRequest(
      `appeal-export:${session.tenantId}:${session.userId}`,
      EXPORT_RATE_LIMIT,
      EXPORT_WINDOW_MS,
    ))
  ) {
    return { ok: false };
  }

  try {
    const draft = await getAppealDraft(session.tenantId, denialId);
    if (!draft) return { ok: false };
    await recordPhiAccess("export", "appeal-pdf", denialId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
