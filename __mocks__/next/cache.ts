// vitest manual mock for `next/cache`, auto-applied to every unit test (vitest
// resolves a `__mocks__/<pkg>` folder adjacent to node_modules without an
// explicit `vi.mock` call — verified against this workspace). The REAL
// `unstable_cache` / `revalidateTag` require the Next.js server runtime's
// incremental cache + request context, so under plain vitest they throw
// ("Invariant: incrementalCache missing in unstable_cache"), exactly like the
// `react` `cache()` gap the existing data.test.ts / get-money-scope-request-cache
// .test.ts already bridge with an inline react mock. This file is that bridge
// for `next/cache` — a single shared implementation instead of duplicating the
// mock in every test that transitively imports apps/web/lib/data.ts.
//
// It reproduces the three behaviors the cache feature (apps/web/lib/data.ts) and
// its tests rely on:
//   1. per-key dedupe: two calls with the same (keyParts + args) run the wrapped
//      function ONCE, returning the cached value thereafter;
//   2. tag invalidation: revalidateTag(tag) evicts every entry tagged with that
//      tag, so the next read re-runs the wrapped function;
//   3. tenant isolation: tenantId lives in keyParts (data.ts passes it both as a
//      keyPart AND a call arg), so two tenants never share an entry.
// `revalidatePath` is a no-op here (no router/render layer in unit tests).

type Entry = { value: unknown; tags: ReadonlyArray<string> };

// tag -> evictors that drop any entry carrying that tag from a store. Registered
// by each unstable_cache wrapper for its own store; lives across the module
// mock (which vitest caches), but each wrapper closure keeps its own entry Map,
// so vi.resetModules (which re-evaluates data.ts and re-creates the wrappers)
// yields fresh empty stores automatically — no manual reset needed per test.
const tagEvictors = new Map<string, Set<() => void>>();

export function unstable_cache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts?: ReadonlyArray<unknown>,
  opts?: { tags?: ReadonlyArray<string>; revalidate?: number },
): (...args: TArgs) => Promise<TResult> {
  const entries = new Map<string, Entry>();
  const tags = opts?.tags ?? [];
  // Register an evictor so revalidateTag can reach this wrapper's private store.
  for (const tag of tags) {
    let set = tagEvictors.get(tag);
    if (!set) {
      set = new Set();
      tagEvictors.set(tag, set);
    }
    set.add(() => {
      for (const [key, entry] of entries) {
        if (entry.tags.includes(tag)) entries.delete(key);
      }
    });
  }
  return async (...args: TArgs): Promise<TResult> => {
    const key = JSON.stringify([keyParts ?? [], args]);
    const hit = entries.get(key);
    if (hit) return hit.value as Promise<TResult>;
    // Store the IN-FLIGHT promise synchronously (before awaiting) so concurrent
    // calls with the same key — e.g. layout + page issuing getMoneyScope in the
    // same render via Promise.all — share one execution instead of racing past
    // the empty entry and each running the wrapped function. Matches the real
    // unstable_cache / React cache() dedupe semantics the production code relies
    // on; the repo's existing react cache() test-double does the same.
    const promise = fn(...args).catch((err) => {
      // Don't cache a rejection: a later retry should re-run the wrapped fn.
      entries.delete(key);
      throw err;
    });
    entries.set(key, { value: promise, tags });
    return promise;
  };
}

export function revalidateTag(tag: string): void {
  tagEvictors.get(tag)?.forEach((evict) => evict());
}

export function revalidatePath(): void {
  /* no-op in unit tests */
}
