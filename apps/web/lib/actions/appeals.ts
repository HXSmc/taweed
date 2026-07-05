"use server";
import { authorizeAction } from "@/lib/authz";
import { recordPhiAccess } from "@/lib/audit";
import { getAppealDraft, type AppealResult } from "@/lib/appeals-data";

// Roles that may work an appeal (view/generate/export). admin is read-only for
// appeals and cannot export a PHI letter.
const APPEAL_ROLES = ["approve", "review", "full", "evidence"] as const;

// Loading a draft reads the claim + patient context (PHI) → audit read.
export async function loadAppealDraft(denialId: string): Promise<AppealResult | null> {
  const session = await authorizeAction("appeals", [...APPEAL_ROLES, "read"]);
  if (!session) return null;
  try {
    const result = await getAppealDraft(session.tenantId, denialId);
    if (result) await recordPhiAccess("read", "appeal-draft", denialId);
    return result;
  } catch {
    // Surface as "no draft" rather than an unhandled rejection (spinner-forever).
    return null;
  }
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
