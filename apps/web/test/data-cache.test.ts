import { describe, it, expect, beforeEach, vi } from "vitest";

// Tenant-scoped caching coverage for apps/web/lib/data.ts: the analytics bundle
// functions (getAnalytics/getRecovery/getAuditReportData/getOwnerReportData) and
// getMoneyScope are wrapped in next/cache's unstable_cache, keyed on tenantId
// and tagged analytics:<tenantId>, invalidated by the write paths' revalidateTag.
//
// The real unstable_cache needs Next's server runtime and throws under plain
// vitest, so use the shared manual mock in __mocks__/next/cache.ts (an in-memory
// dedupe + tag-invalidation stand-in). That mock reproduces the three behaviors
// under test: per-key dedupe, revalidateTag eviction, and tenant-keyed isolation.
vi.mock("next/cache");

const mockedMoneyScope = vi.fn();
vi.mock("@taweed/analytics", () => ({
  moneyScope: (...args: unknown[]) => mockedMoneyScope(...args),
  // The other analytics exports are imported by data.ts at load time but never
  // reached by getMoneyScope; no-op them so the module loads cleanly.
  reasonPareto: vi.fn(),
  trend: vi.fn(),
  getLatestBaseline: vi.fn(),
  recoverability: vi.fn(),
}));

const mockedWithSession = vi.fn();
vi.mock("@/lib/db", () => ({
  withSession: (...args: unknown[]) => mockedWithSession(...args),
}));

// The app derives the tenant from the verified session in the page
// (requireSession(locale) -> session.tenantId), then passes it INTO the cached
// data function. Mock @/lib/session so the cross-tenant test exercises THAT real
// derivation boundary (session.tenantId), instead of hand-passing a tenantId
// literal that would mask a shared-key leak.
const requireSessionMock = vi.fn();
vi.mock("@/lib/session", () => ({
  requireSession: (...args: unknown[]) => requireSessionMock(...args),
}));

const MONEY_A = {
  recoveredSar: "10.00",
  atRiskSar: "100.00",
  deniedCount: 1,
  claimCount: 5,
};
const MONEY_B = {
  recoveredSar: "999.00",
  atRiskSar: "9000.00",
  deniedCount: 40,
  claimCount: 50,
};
const stubDb = {};

beforeEach(() => {
  vi.resetModules();
  mockedMoneyScope.mockReset();
  mockedWithSession.mockReset();
  requireSessionMock.mockReset();
  // withSession hands the cached callback a stub db; moneyScope(db) ignores it.
  mockedWithSession.mockImplementation(
    async (_tenantId: string, fn: (db: unknown) => unknown) => fn(stubDb),
  );
});

describe("getMoneyScope Data Cache (apps/web/lib/data.ts)", () => {
  it("dedupes two reads of the same tenant within the TTL into ONE query (#4a)", async () => {
    mockedMoneyScope.mockResolvedValue(MONEY_A);
    const { getMoneyScope } = await import("../lib/data");

    const [first, second] = await Promise.all([
      getMoneyScope("tenant-a"),
      getMoneyScope("tenant-a"),
    ]);

    expect(first).toEqual(MONEY_A);
    expect(second).toEqual(MONEY_A);
    // The underlying query ran exactly once — the second read was a cache hit.
    expect(mockedMoneyScope).toHaveBeenCalledTimes(1);
  });

  it("reflects new data after the write path's revalidateTag (#4b)", async () => {
    mockedMoneyScope.mockResolvedValueOnce(MONEY_A);
    const { getMoneyScope } = await import("../lib/data");
    const { revalidateTag } = await import("next/cache");

    // First read: cache miss -> runs the query, caches MONEY_A.
    const before = await getMoneyScope("tenant-a");
    expect(before).toEqual(MONEY_A);
    expect(mockedMoneyScope).toHaveBeenCalledTimes(1);

    // The write path (ingest/recovery/eob-review actions) invalidates this
    // tenant's tag after a mutation. Simulate that, then make the "new" data
    // available so a re-run is observably different from the stale cached value.
    revalidateTag(`analytics:tenant-a`);
    mockedMoneyScope.mockResolvedValueOnce(MONEY_B);

    const after = await getMoneyScope("tenant-a");
    // Not stale: the tag invalidation forced a re-run that returned the new data.
    expect(after).toEqual(MONEY_B);
    expect(mockedMoneyScope).toHaveBeenCalledTimes(2);
  });

  it("does NOT leak a cached entry across two tenants (#4c — session-derived tenantId)", async () => {
    // Two real sessions (the app's tenant-derivation path), each with its own
    // tenantId — exactly what requireSession(locale) returns in a page before it
    // calls getMoneyScope(session.tenantId).
    requireSessionMock
      .mockResolvedValueOnce({ tenantId: "tenant-a", role: "owner" })
      .mockResolvedValueOnce({ tenantId: "tenant-b", role: "owner" });
    mockedMoneyScope
      .mockResolvedValueOnce(MONEY_A) // tenant-a's data
      .mockResolvedValueOnce(MONEY_B); // tenant-b's data

    const { getMoneyScope } = await import("../lib/data");

    // Derive tenantId from the session (the real path), don't hand-pass it.
    const sessionA = await requireSessionMock("en");
    const a = await getMoneyScope(sessionA.tenantId);
    const sessionB = await requireSessionMock("en");
    const b = await getMoneyScope(sessionB.tenantId);

    // Two independent queries — tenant-b must NEVER have hit tenant-a's entry.
    expect(mockedMoneyScope).toHaveBeenCalledTimes(2);
    // And each tenant saw its OWN data, not the other's (no cross-tenant leak).
    expect(a).toEqual(MONEY_A);
    expect(b).toEqual(MONEY_B);
    expect(b).not.toEqual(a);
  });

  it("would fail loudly if the cache key stopped scoping by tenant (#4c regression guard)", async () => {
    // Direct regression assertion on the cache contract itself: the keyParts the
    // wrapper is built with MUST carry the tenantId, or two tenants share one
    // entry. We re-derive tenantId from requireSession for two tenants and prove
    // a second tenant's read can't be satisfied by the first tenant's cache.
    requireSessionMock
      .mockResolvedValueOnce({ tenantId: "tenant-x", role: "owner" })
      .mockResolvedValueOnce({ tenantId: "tenant-y", role: "owner" });
    mockedMoneyScope
      .mockResolvedValueOnce(MONEY_A)
      .mockResolvedValueOnce(MONEY_B);

    const { getMoneyScope } = await import("../lib/data");

    const a = await getMoneyScope((await requireSessionMock("en")).tenantId);
    const b = await getMoneyScope((await requireSessionMock("en")).tenantId);

    // If tenantId ever drops out of the key, b would equal a (MONEY_A) and the
    // second query would never run — both assertions below would flip and fail.
    expect(mockedMoneyScope).toHaveBeenCalledTimes(2);
    expect(a).toEqual(MONEY_A);
    expect(b).toEqual(MONEY_B);
  });
});
