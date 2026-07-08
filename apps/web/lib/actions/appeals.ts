"use server";
import { authorizeAction } from "@/lib/authz";
import { recordPhiAccess } from "@/lib/audit";
import { getAppealDraft, type AppealResult } from "@/lib/appeals-data";

// Roles that may work an appeal (view/generate/export). admin is read-only for
// appeals and cannot export a PHI letter.
const APPEAL_ROLES = ["approve", "review", "full", "evidence"] as const;

// Loading a draft reads the claim + patient context (PHI) → audit read. admin's
// "read" capability is deliberately excluded here (not just from the export
// gate below): admin is read-only for the appeals MODULE (e.g. status/queue
// visibility), not entitled to the full bilingual PHI letter content
// (pdfEn/pdfAr) that this returns.
export async function loadAppealDraft(denialId: string): Promise<AppealResult | null> {
  const session = await authorizeAction("appeals", [...APPEAL_ROLES]);
  if (!session) return null;
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
export async function recordAppealExport(denialId: string): Promise<{ ok: boolean }> {
  const session = await authorizeAction("appeals", [...APPEAL_ROLES]);
  if (!session) return { ok: false };
  try {
    await recordPhiAccess("export", "appeal-pdf", denialId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
