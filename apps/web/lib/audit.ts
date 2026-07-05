import "server-only";
import { logAudit, type AuditAction } from "@taweed/audit";
import { withSession } from "./db";
import { getSession } from "./session";

/**
 * Record a PHI read/write/export for the current session's tenant + actor
 * (build-plan §3, §6). Append-only; tenant_id is taken from the active RLS
 * setting inside logAudit, so an audit row can never be misattributed. No PHI
 * in the payload — only the entity + its id + the actor.
 */
export async function recordPhiAccess(
  action: AuditAction,
  entity: string,
  entityId: string,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await withSession(session.tenantId, async (db) => {
    await logAudit(db, {
      actor: session.email,
      action,
      entity,
      entityId,
    });
  });
}
