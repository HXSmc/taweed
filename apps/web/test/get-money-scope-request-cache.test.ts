import { describe, it, expect, beforeEach, vi } from "vitest";

// getMoneyScope is now wrapped in next/cache's unstable_cache (tenant-scoped Data
// Cache). The real unstable_cache throws under plain vitest, so use the shared
// manual mock in __mocks__/next/cache.ts (in-memory dedupe + tag invalidation).
vi.mock("next/cache");

// Regression coverage for the audit finding: getMoneyScope() ran once for the
// CommandBar in (app)/layout.tsx, and getAnalytics()/getRecovery() EACH called
// moneyScope(db) again inside their own independent RLS transaction — doubling
// that query on every request to overview/analytics/recovery. getMoneyScope is
// now wrapped in React's cache() and getAnalytics/getRecovery call THAT shared
// function instead of moneyScope(db) directly, so a layout + page pair sharing
// a tenantId within one request-render issue exactly one moneyScope query.
//
// React's real cache() is only available through Next.js's own bundled React
// build (the plain "react" package installed for this workspace does not
// export it — confirmed: `typeof require("react").cache === "undefined"` under
// plain Node/vitest resolution). This test substitutes a real per-argument
// memoizing stand-in for "react"'s cache export so the memoization behavior
// itself is genuinely exercised, matching how "server-only" is stubbed for the
// same plain-Node-vs-bundler gap (see vitest.workspace.ts).
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <Args extends unknown[], R>(fn: (...args: Args) => R) => {
      const memo = new Map<string, R>();
      return ((...args: Args): R => {
        const key = JSON.stringify(args);
        if (!memo.has(key)) memo.set(key, fn(...args));
        return memo.get(key) as R;
      }) as (...args: Args) => R;
    },
  };
});

const mockedMoneyScope = vi.fn();
vi.mock("@taweed/analytics", () => ({
  moneyScope: (...args: unknown[]) => mockedMoneyScope(...args),
  reasonPareto: vi.fn(async () => []),
  trend: vi.fn(async () => []),
  getLatestBaseline: vi.fn(async () => null),
}));

const mockedWithSession = vi.fn();
const FAKE_MONEY = {
  recoveredSar: "100.00",
  atRiskSar: "200.00",
  deniedCount: 1,
  claimCount: 2,
};
// A stub `db` shaped just enough for the code paths this test exercises
// (denialRateDim's raw execute() for byPayer/byBranch, and getRecovery's
// rows/agg execute() calls) — none of them are the thing under test here.
const stubDb = { execute: vi.fn(async () => ({ rows: [] })) };

vi.mock("@/lib/db", () => ({
  withSession: (...args: unknown[]) => mockedWithSession(...args),
}));

describe("getMoneyScope request-level memoization (apps/web/lib/data.ts)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockedMoneyScope.mockReset();
    mockedMoneyScope.mockResolvedValue(FAKE_MONEY);
    mockedWithSession.mockReset();
    mockedWithSession.mockImplementation(
      async (_tenantId: string, fn: (db: unknown) => unknown) => fn(stubDb),
    );
    stubDb.execute.mockClear();
  });

  it("dedupes repeated getMoneyScope calls for the same tenant into one query", async () => {
    const { getMoneyScope } = await import("../lib/data");

    const [first, second] = await Promise.all([
      getMoneyScope("tenant-a"),
      getMoneyScope("tenant-a"),
    ]);

    expect(first).toEqual(FAKE_MONEY);
    expect(second).toEqual(FAKE_MONEY);
    expect(mockedMoneyScope).toHaveBeenCalledTimes(1);
    expect(mockedWithSession).toHaveBeenCalledTimes(1);
  });

  it("still queries separately per distinct tenant", async () => {
    const { getMoneyScope } = await import("../lib/data");

    await getMoneyScope("tenant-a");
    await getMoneyScope("tenant-b");

    expect(mockedMoneyScope).toHaveBeenCalledTimes(2);
  });

  it("getAnalytics reuses a getMoneyScope call already made for the same tenant (e.g. by the layout)", async () => {
    const { getMoneyScope, getAnalytics } = await import("../lib/data");

    // Simulate the layout resolving MoneyScope first, then the analytics page
    // fetching its bundle for the SAME request/tenant.
    await getMoneyScope("tenant-a");
    const bundle = await getAnalytics("tenant-a");

    expect(bundle.money).toEqual(FAKE_MONEY);
    expect(mockedMoneyScope).toHaveBeenCalledTimes(1);
  });

  it("getRecovery reuses a getMoneyScope call already made for the same tenant (e.g. by the layout)", async () => {
    const { getMoneyScope, getRecovery } = await import("../lib/data");

    await getMoneyScope("tenant-a");
    const bundle = await getRecovery("tenant-a");

    expect(bundle.money).toEqual(FAKE_MONEY);
    expect(mockedMoneyScope).toHaveBeenCalledTimes(1);
  });
});
