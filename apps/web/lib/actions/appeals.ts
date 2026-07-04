"use server";
import { getSession } from "@/lib/session";
import { recordPhiAccess } from "@/lib/audit";
import { getAppealDraft, type AppealResult } from "@/lib/appeals-data";

// Loading a draft reads the claim + patient context (PHI) → audit read.
export async function loadAppealDraft(denialId: string): Promise<AppealResult | null> {
  const session = await getSession();
  if (!session) return null;
  const result = await getAppealDraft(session.tenantId, denialId);
  if (result) await recordPhiAccess("read", "appeal-draft", denialId);
  return result;
}

// Exporting the letter is a PHI export → audit export. The human-in-the-loop
// review gate is enforced in the UI; this records that an export occurred.
export async function recordAppealExport(denialId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  await recordPhiAccess("export", "appeal-pdf", denialId);
  return { ok: true };
}
