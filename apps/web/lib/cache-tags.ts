import "server-only";

// Single source of truth for the per-tenant analytics cache tag, used on BOTH
// the read side (apps/web/lib/data.ts tags each unstable_cache entry with it)
// and the write side (apps/web/lib/actions/*.ts call revalidateTag with it
// after a mutation). Generating the string here — instead of hand-typing
// `analytics:${tenantId}` in multiple places — guarantees the read and write
// sides can never drift apart and silently leave stale cached aggregations.
export function analyticsTag(tenantId: string): string {
  return `analytics:${tenantId}`;
}
