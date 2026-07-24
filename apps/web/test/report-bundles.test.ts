import { describe, it, expect, beforeEach, vi } from "vitest";

// The report bundle functions are now wrapped in next/cache's unstable_cache
// (tenant-scoped Data Cache). The real unstable_cache throws under plain vitest,
// so use the shared manual mock in __mocks__/next/cache.ts.
vi.mock("next/cache");

// A3 bundle-assembly tests: getAuditReportData/getOwnerReportData compose
// EXISTING @taweed/analytics rollups (reasonPareto, recoverability, moneyScope,
// trend, getLatestBaseline) plus the private denialRateDim/appealPipelineRows
// raw queries already used by getAnalytics/getRecovery — no new money math.
// The report-data.ts pure derivations (recoverableSplit, projectedRecoveryRange,
// aggregateTopPayers) are unit-tested on their own in report-data.test.ts; this
// file proves the WIRING: the right inputs reach them and the bundle shape is
// correct end-to-end.

// getMoneyScope wraps moneyScope in React's cache(), same gap as
// get-money-scope-request-cache.test.ts: plain Node/vitest's "react" has no
// real cache() export (only Next's bundled React does). Substitute a real
// per-argument memoizing stand-in so the memoization behavior is genuinely
// exercised rather than crashing on `cache is not a function`.
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
const mockedReasonPareto = vi.fn();
const mockedRecoverability = vi.fn();
const mockedTrend = vi.fn();
const mockedGetLatestBaseline = vi.fn();
vi.mock("@taweed/analytics", () => ({
  moneyScope: (...args: unknown[]) => mockedMoneyScope(...args),
  reasonPareto: (...args: unknown[]) => mockedReasonPareto(...args),
  recoverability: (...args: unknown[]) => mockedRecoverability(...args),
  trend: (...args: unknown[]) => mockedTrend(...args),
  getLatestBaseline: (...args: unknown[]) => mockedGetLatestBaseline(...args),
}));

vi.mock("@taweed/rules-engine", () => ({
  scrub: vi.fn(),
  SCRUBBER_RULES: [],
  selectRulesForClaim: vi.fn(() => []),
  projectClaimFacts: vi.fn(),
}));
vi.mock("./rules-data", () => ({ loadApprovedAuthoredRulesTx: vi.fn(async () => []) }));
vi.mock("@/lib/rules-data", () => ({ loadApprovedAuthoredRulesTx: vi.fn(async () => []) }));

const denialRateDimRows = {
  rows: [
    { key: "p1", label: "Bupa Arabia", total_claims: 10, denied_claims: 3, at_risk_sar: "3000.00" },
    { key: "p2", label: "Tawuniya", total_claims: 5, denied_claims: 1, at_risk_sar: "500.00" },
  ],
};
const appealPipelineRowsResult = {
  rows: [
    {
      appeal_id: "a1",
      claim_id: "c1",
      nphies_claim_id: "N1",
      payer_name: "Bupa Arabia",
      status: "won",
      appealed_sar: "1000.00",
      recovered_sar: "800.00",
      days_open: 10,
    },
  ],
};
const stubDb = { execute: vi.fn() };

const mockedWithSession = vi.fn();
vi.mock("@/lib/db", () => ({
  withSession: (...args: unknown[]) => mockedWithSession(...args),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockedWithSession.mockImplementation(
    async (_tenantId: string, fn: (db: unknown) => unknown) => fn(stubDb),
  );
  mockedMoneyScope.mockResolvedValue({
    recoveredSar: "800.00",
    atRiskSar: "3500.00",
    deniedCount: 4,
    claimCount: 15,
  });
  mockedReasonPareto.mockResolvedValue([
    { code: "MISSING_PREAUTH", label: "Missing pre-authorization", count: 3, sar: "3000.00", cumulativePct: 100 },
    { code: "AGE_MISMATCH", label: "Age mismatch", count: 1, sar: "500.00", cumulativePct: 100 },
  ]);
  mockedRecoverability.mockResolvedValue([
    { payerId: "p1", reasonCode: "MISSING_PREAUTH", won: 2, resolved: 5, recoveryRate: 0.4 },
  ]);
  mockedTrend.mockResolvedValue([
    { period: "2026-06", deniedSar: "1000.00", recoveredSar: "200.00" },
    { period: "2026-07", deniedSar: "2500.00", recoveredSar: "800.00" },
  ]);
  mockedGetLatestBaseline.mockResolvedValue({
    id: "b1",
    capturedAt: "2026-01-01T00:00:00Z",
    atRiskSar: "5000.00",
    deniedCount: 5,
    claimCount: 20,
    note: "onboarding",
  });
  stubDb.execute.mockReset();
  stubDb.execute
    .mockResolvedValueOnce(denialRateDimRows) // getAuditReportData/getOwnerReportData's denialRateDim(db,"payer")
    .mockResolvedValueOnce(appealPipelineRowsResult); // getOwnerReportData's appealPipelineRows(db)
});

describe("getAuditReportData", () => {
  it("assembles overallRate, byPayer, pareto, split, and range from the shared rollups", async () => {
    const { getAuditReportData } = await import("../lib/data");

    const bundle = await getAuditReportData("tenant-a");

    expect(mockedWithSession).toHaveBeenCalledWith("tenant-a", expect.any(Function));
    // overallRate: (3+1) denied / (10+5) claims = 4/15
    expect(bundle.overallRate).toBeCloseTo(4 / 15);
    expect(bundle.byPayer).toHaveLength(2);
    expect(bundle.pareto).toHaveLength(2);
    // split: MISSING_PREAUTH has won>0 in recoverability -> recoverable;
    // AGE_MISMATCH has no matching row -> structural.
    expect(bundle.split.recoverableSar).toBe("3000.00");
    expect(bundle.split.structuralSar).toBe("500.00");
    // range: uses money.atRiskSar (3500.00) and the recoverability rows (resolved=5 -> modeled false)
    expect(bundle.range.modeled).toBe(false);
  });
});

describe("getOwnerReportData", () => {
  it("uses the latest trend bucket for recoveredThisMonthSar and monthLabel", async () => {
    const { getOwnerReportData } = await import("../lib/data");

    const bundle = await getOwnerReportData("tenant-a");

    expect(bundle.recoveredThisMonthSar).toBe("800.00");
    expect(bundle.monthLabel).toBe("2026-07");
  });

  it("derives firstPassRate as 1 minus the true denial rate from denialRateDim", async () => {
    const { getOwnerReportData } = await import("../lib/data");

    const bundle = await getOwnerReportData("tenant-a");

    expect(bundle.firstPassRate).toBeCloseTo(1 - 4 / 15);
  });

  it("derives baselineFirstPassRate from the captured baseline", async () => {
    const { getOwnerReportData } = await import("../lib/data");

    const bundle = await getOwnerReportData("tenant-a");

    expect(bundle.baselineFirstPassRate).toBeCloseTo(1 - 5 / 20);
  });

  it("returns null baselineFirstPassRate when no baseline was ever captured", async () => {
    mockedGetLatestBaseline.mockResolvedValue(null);
    const { getOwnerReportData } = await import("../lib/data");

    const bundle = await getOwnerReportData("tenant-a");

    expect(bundle.baselineFirstPassRate).toBeNull();
  });

  it("aggregates top payers from the appeal pipeline rows", async () => {
    const { getOwnerReportData } = await import("../lib/data");

    const bundle = await getOwnerReportData("tenant-a");

    expect(bundle.topPayers).toEqual([{ name: "Bupa Arabia", recoveredSar: "800.00" }]);
  });

  it("returns null monthLabel with no dated trend buckets, never throws", async () => {
    mockedTrend.mockResolvedValue([]);
    const { getOwnerReportData } = await import("../lib/data");

    const bundle = await getOwnerReportData("tenant-a");

    expect(bundle.monthLabel).toBeNull();
    expect(bundle.recoveredThisMonthSar).toBe("0.00");
  });
});
