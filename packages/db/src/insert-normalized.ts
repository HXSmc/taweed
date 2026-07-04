import type { NormalizedClaim } from "@taweed/shared";
import type { Database } from "./client.js";
import { claimLines, claimResponses, claims, denials } from "./schema.js";

/**
 * Persist a NormalizedClaim in FK order. Must be called inside `withTenant` so
 * RLS is active — every row's tenant_id must match the transaction tenant or
 * the INSERT is rejected by the RLS WITH CHECK policy.
 */
export async function insertNormalizedClaim(
  db: Database,
  normalized: NormalizedClaim,
): Promise<void> {
  await db.insert(claims).values(normalized.claim);
  if (normalized.lines.length > 0) {
    await db.insert(claimLines).values(normalized.lines);
  }
  await db.insert(claimResponses).values(normalized.response);
  if (normalized.denials.length > 0) {
    await db.insert(denials).values(normalized.denials);
  }
}
