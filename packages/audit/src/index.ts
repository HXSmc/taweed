// @taweed/audit — append-only PHI-access audit log (build-plan §3, §6).
// Two responsibilities: a pure guard (sanitizeAuditEntry) that refuses to let
// any non-whitelisted field reach the trail, and logAudit which appends one row
// scoped to the ACTIVE RLS tenant so a row can never be misattributed.
import { sql } from "drizzle-orm";
import { schema, type Database } from "@taweed/db";

export type AuditAction = "read" | "write" | "export";

export interface AuditEntry {
  actor: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  ip?: string;
}

// The ONLY keys an audit entry may carry. Anything else (patientName, dob,
// ssn...) means a caller spread a PHI-bearing record into the entry — reject it
// rather than silently persist PHI into an immutable, exportable log.
const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "actor",
  "action",
  "entity",
  "entityId",
  "ip",
]);

const AUDIT_ACTIONS: readonly AuditAction[] = ["read", "write", "export"];

function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}

function requireString(value: unknown, field: string): string {
  // Empty strings are treated as absent — an audit row with a blank actor or
  // entityId is useless for the access trail it exists to provide.
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`audit: "${field}" must be a non-empty string`);
  }
  return value;
}

/**
 * Whitelist-narrow an untrusted object into an AuditEntry. Throws if it carries
 * any key outside the whitelist (assumed PHI leak), is missing a required
 * field, or has an action outside the AuditAction set. Pure and side-effect
 * free so it is unit-testable in isolation.
 */
export function sanitizeAuditEntry(entry: Record<string, unknown>): AuditEntry {
  for (const key of Object.keys(entry)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`audit: unexpected key "${key}" (possible PHI leak)`);
    }
  }

  const actor = requireString(entry.actor, "actor");
  const action = requireString(entry.action, "action");
  if (!isAuditAction(action)) {
    throw new Error(`audit: invalid action "${action}"`);
  }
  const entity = requireString(entry.entity, "entity");
  const entityId = requireString(entry.entityId, "entityId");

  const sanitized: AuditEntry = { actor, action, entity, entityId };
  // Keep `ip` optional: only attach it when supplied so valid entries without
  // an ip round-trip unchanged (no `ip: undefined` noise).
  if (entry.ip !== undefined) {
    sanitized.ip = requireString(entry.ip, "ip");
  }
  return sanitized;
}

/**
 * Append exactly one row to audit_logs. MUST be called inside withTenant(...):
 * tenant_id is read from the active RLS GUC (`app.tenant_id`) rather than passed
 * in, so a row can never be attributed to a tenant other than the one the
 * transaction is bound to. The entry is re-sanitized here as defense in depth —
 * a runtime PHI leak is blocked even if the caller bypassed the type.
 */
export async function logAudit(db: Database, entry: AuditEntry): Promise<void> {
  const safe = sanitizeAuditEntry({ ...entry });
  await db.insert(schema.auditLogs).values({
    // No missing_ok flag: if the GUC is unset (called outside withTenant) the
    // ::uuid cast fails and the insert throws — that is the desired guard.
    tenant_id: sql`current_setting('app.tenant_id')::uuid`,
    actor: safe.actor,
    action: safe.action,
    entity: safe.entity,
    entity_id: safe.entityId,
    ip: safe.ip ?? null,
  });
}
