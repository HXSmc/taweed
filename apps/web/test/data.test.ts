import { describe, it, expect, beforeEach, vi } from "vitest";
import { SQL, StringChunk } from "drizzle-orm";

// The analytics bundle functions are now wrapped in next/cache's unstable_cache
// (tenant-scoped Data Cache). The real unstable_cache needs Next's server runtime
// and throws under plain vitest, so use the shared manual mock in
// __mocks__/next/cache.ts (an in-memory dedupe + tag-invalidation stand-in), the
// same gap the react cache() mock below bridges for request-level memoization.
vi.mock("next/cache");

// Coverage gap fixed: every other test that imports "@/lib/data" (recovery-
// page.test.ts, settings-page.test.ts, scrubber-table.test.tsx, audit-report-
// document.test.tsx, owner-report-document.test.tsx, recovery-pipeline-*
// .test.tsx) does `vi.mock("@/lib/data", ...)` and injects canned bundles —
// none of them ever executes the join/aggregation logic actually WRITTEN in
// data.ts. This file drives the real data.ts functions against a fake
// drizzle-shaped db (the same fake-pool/fake-db harness style already
// established in db.test.ts, get-money-scope-request-cache.test.ts, and
// ingest-csv.test.ts), mocking only the true module boundaries: "@/lib/db"
// (withSession — no live Postgres), "@taweed/analytics" (a separately tested
// package), "@taweed/rules-engine" (ditto), and "@/lib/rules-data" (ditto).
// Exercises:
//  - denialRateDim's LEFT JOIN rate math (data.ts:66-100), via getAnalytics
//    and getAuditReportData, including the total_claims === 0 guard.
//  - getScrubRows' rule-scoping call into selectRulesForClaim and its
//    money-first riskScore-descending sort (data.ts:133-217).
//  - appealPipelineRows' row mapping incl. days_open Number() coercion
//    (data.ts:244-276), via getRecovery and getOwnerReportData.
//  - getOwnerReportData's baselineFirstPassRate derivation (data.ts:366-391).

// React's real cache() is only exported by Next's bundled React build, not
// plain "react" under vitest resolution (see get-money-scope-request-cache
// .test.ts) — substitute a real per-argument memoizing stand-in so
// getMoneyScope (used by every bundle under test) stays callable.
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
const mockedTrend = vi.fn();
const mockedGetLatestBaseline = vi.fn();
const mockedRecoverability = vi.fn();
vi.mock("@taweed/analytics", () => ({
  moneyScope: (...args: unknown[]) => mockedMoneyScope(...args),
  reasonPareto: (...args: unknown[]) => mockedReasonPareto(...args),
  trend: (...args: unknown[]) => mockedTrend(...args),
  getLatestBaseline: (...args: unknown[]) => mockedGetLatestBaseline(...args),
  recoverability: (...args: unknown[]) => mockedRecoverability(...args),
}));

const mockedScrub = vi.fn();
const mockedSelectRulesForClaim = vi.fn();
const mockedProjectClaimFacts = vi.fn();
vi.mock("@taweed/rules-engine", () => ({
  scrub: (...args: unknown[]) => mockedScrub(...args),
  SCRUBBER_RULES: [],
  selectRulesForClaim: (...args: unknown[]) => mockedSelectRulesForClaim(...args),
  projectClaimFacts: (...args: unknown[]) => mockedProjectClaimFacts(...args),
}));

const mockedLoadApprovedAuthoredRulesTx = vi.fn();
vi.mock("@/lib/rules-data", () => ({
  loadApprovedAuthoredRulesTx: (...args: unknown[]) =>
    mockedLoadApprovedAuthoredRulesTx(...args),
}));

const mockedWithSession = vi.fn();
vi.mock("@/lib/db", () => ({
  withSession: (...args: unknown[]) => mockedWithSession(...args),
}));

const FAKE_MONEY = {
  recoveredSar: "100.00",
  atRiskSar: "200.00",
  deniedCount: 1,
  claimCount: 2,
};

// One shared queue per db surface — each test seeds it in the exact call
// order data.ts issues those calls in (see per-test comments), mirroring the
// selectQueue pattern already used by ingest-csv.test.ts /
// ingest-bundle-cap.test.ts for this same drizzle-shaped fake db.
let executeQueue: { rows: unknown[] }[] = [];
let selectQueue: unknown[][] = [];
// Total `.where(...)` calls across the fake db's whole select-builder surface
// this test run — getScrubRows' claim_lines/patients/payers lookups always
// call `.where()` (3 calls); the OPTIONAL branch-scope narrowing on the
// claims query itself adds a 4th when (and only when) a branchId is passed.
// A plain call-count discriminates the two paths without needing to inspect
// Drizzle's internal eq() expression shape.
let whereCallCount = 0;
// Every `db.execute(sql\`...\`)` argument (the raw SQL object), in call order.
// Shared infra: lets tests assert which bound Param values a raw-SQL query
// carries (e.g. getAppealables' optional branch_id predicate) — the
// select-builder `.where()` count above does NOT apply to raw execute() calls.
// Reset in beforeEach alongside the other queues.
let executedQueries: unknown[] = [];

function fakeDb() {
  return {
    execute: vi.fn(async (q: unknown) => {
      executedQueries.push(q);
      return executeQueue.shift() ?? { rows: [] };
    }),
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(selectQueue.shift() ?? []),
        }),
        // Thenable AND chainable: most callers (claim_lines/patients/payers
        // lookups) just `await .where(...)` directly; getScrubRows' optional
        // branch-scope narrowing chains `.where(...).orderBy(...).limit(...)`
        // on top (real Drizzle supports both shapes).
        where: () => {
          whereCallCount += 1;
          const result = selectQueue.shift() ?? [];
          return {
            then: (resolve: (v: unknown) => void) => resolve(result),
            orderBy: () => ({
              limit: () => Promise.resolve(result),
            }),
          };
        },
      }),
    }),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  executeQueue = [];
  selectQueue = [];
  whereCallCount = 0;
  executedQueries = [];
  mockedMoneyScope.mockResolvedValue(FAKE_MONEY);
  mockedReasonPareto.mockResolvedValue([]);
  mockedTrend.mockResolvedValue([]);
  mockedGetLatestBaseline.mockResolvedValue(null);
  mockedRecoverability.mockResolvedValue([]);
  mockedLoadApprovedAuthoredRulesTx.mockResolvedValue([]);
  mockedWithSession.mockImplementation(
    async (_tenantId: string, fn: (db: unknown) => unknown) => fn(fakeDb()),
  );
});

describe("denialRateDim (private) via getAnalytics / getAuditReportData", () => {
  it("computes the true denial rate (denied / TOTAL claims), not per-affected-claim", async () => {
    // getAnalytics issues denialRateDim(db,"payer") then denialRateDim(db,"branch")
    // inside Promise.all — array literal order fixes db.execute call order.
    executeQueue = [
      {
        rows: [
          {
            key: "payer-1",
            label: "Bupa",
            total_claims: 10,
            denied_claims: 4,
            at_risk_sar: "4000.00",
          },
          {
            key: "payer-2",
            label: "Tawuniya",
            total_claims: 5,
            denied_claims: 0,
            at_risk_sar: "0.00",
          },
        ],
      },
      { rows: [] }, // byBranch
    ];
    const { getAnalytics } = await import("../lib/data");

    const bundle = await getAnalytics("tenant-a");

    expect(bundle.byPayer).toEqual([
      {
        key: "payer-1",
        label: "Bupa",
        claims: 10,
        denied: 4,
        rate: 0.4,
        atRiskSar: "4000.00",
      },
      {
        key: "payer-2",
        label: "Tawuniya",
        claims: 5,
        denied: 0,
        rate: 0,
        atRiskSar: "0.00",
      },
    ]);
    // overallRate is derived from the SAME byPayer rows getAnalytics returns
    // (totalClaims/deniedClaims reduced across byPayer), so it must agree.
    expect(bundle.overallRate).toBeCloseTo(4 / 15);
  });

  it("guards divide-by-zero: a dimension key with zero total claims reports rate 0, not NaN", async () => {
    executeQueue = [
      {
        rows: [
          {
            key: "branch-empty",
            label: "Unopened branch",
            total_claims: 0,
            denied_claims: 0,
            at_risk_sar: "0.00",
          },
        ],
      },
    ];
    const { getAuditReportData } = await import("../lib/data");

    const bundle = await getAuditReportData("tenant-a");

    expect(bundle.byPayer[0].rate).toBe(0);
    expect(Number.isNaN(bundle.byPayer[0].rate)).toBe(false);
    expect(bundle.overallRate).toBe(0);
  });
});

describe("getScrubRows", () => {
  const CLAIM_A = {
    id: "claim-low",
    patient_id: "pt-1",
    payer_id: "payer-1",
    total_amount: "500.00",
    nphies_claim_id: "N-A",
  };
  const CLAIM_B = {
    id: "claim-high",
    patient_id: "pt-2",
    payer_id: "payer-2",
    total_amount: "900.00",
    nphies_claim_id: "N-B",
  };
  const CLAIM_C = {
    id: "claim-mid",
    patient_id: "pt-1",
    payer_id: "payer-1",
    total_amount: "700.00",
    nphies_claim_id: "N-C",
  };
  const PATIENTS = [
    { id: "pt-1", pseudonym: "PT-0001" },
    { id: "pt-2", pseudonym: "PT-0002" },
  ];
  const PAYERS = [
    { id: "payer-1", name: "Bupa" },
    { id: "payer-2", name: "Tawuniya" },
  ];
  const RISK_BY_CLAIM: Record<string, number> = {
    "claim-low": 10,
    "claim-high": 90,
    "claim-mid": 50,
  };

  beforeEach(() => {
    // Call order inside getScrubRows: claims (orderBy+limit), then sequential
    // awaits of claimLines, patients, payers (each a .where() call, in that
    // order — see bugs.md pass #22 for why this isn't Promise.all anymore).
    selectQueue = [
      [CLAIM_A, CLAIM_B, CLAIM_C], // claims
      [], // claim_lines (unused by this fake — facts come from the mock)
      PATIENTS,
      PAYERS,
    ];
    mockedProjectClaimFacts.mockImplementation((claim: { id: string }) => ({
      sbsCodes: [`SBS-${claim.id}`],
    }));
    mockedSelectRulesForClaim.mockImplementation(
      (_library: unknown[], scope: { payerId: string; tenantId: string }) => [
        { id: `rule-${scope.payerId}`, version: 1 },
      ],
    );
    mockedScrub.mockImplementation(async (facts: { sbsCodes: string[] }) => {
      const claimId = facts.sbsCodes[0].replace("SBS-", "");
      return {
        claimId,
        riskScore: RISK_BY_CLAIM[claimId],
        flags: [],
        unevaluable: [],
      };
    });
  });

  it("scopes the rule library to each claim's payer/tenant before scrubbing", async () => {
    const { getScrubRows } = await import("../lib/data");

    await getScrubRows("tenant-a", 60);

    expect(mockedSelectRulesForClaim).toHaveBeenCalledWith(expect.anything(), {
      payerId: "payer-1",
      tenantId: "tenant-a",
    });
    expect(mockedSelectRulesForClaim).toHaveBeenCalledWith(expect.anything(), {
      payerId: "payer-2",
      tenantId: "tenant-a",
    });
    // Called once per claim (3 claims), not once per unique payer.
    expect(mockedSelectRulesForClaim).toHaveBeenCalledTimes(3);
  });

  it("sorts rows money-first: highest riskScore first (design-brief §8.6)", async () => {
    const { getScrubRows } = await import("../lib/data");

    const rows = await getScrubRows("tenant-a", 60);

    expect(rows.map((r) => r.claimId)).toEqual([
      "claim-high", // riskScore 90
      "claim-mid", // riskScore 50
      "claim-low", // riskScore 10
    ]);
    expect(rows.map((r) => r.result.riskScore)).toEqual([90, 50, 10]);
  });

  it("resolves patient/payer labels via the batched lookup maps, not per-row queries", async () => {
    const { getScrubRows } = await import("../lib/data");

    const rows = await getScrubRows("tenant-a", 60);
    const highRow = rows.find((r) => r.claimId === "claim-high");

    expect(highRow?.patientLabel).toBe("PT-0002");
    expect(highRow?.payerName).toBe("Tawuniya");
  });

  it("narrows the claim query with a WHERE when a branchId is passed", async () => {
    const { getScrubRows } = await import("../lib/data");

    await getScrubRows("tenant-a", 60, "branch-1");

    // 3 unconditional `.where()` calls (claim_lines/patients/payers lookups)
    // + 1 for the branch-scope narrowing on the claims query itself.
    expect(whereCallCount).toBe(4);
  });

  it("does NOT add a claims WHERE when no branchId is passed (All branches)", async () => {
    const { getScrubRows } = await import("../lib/data");

    await getScrubRows("tenant-a", 60);

    // Only the 3 unconditional lookups — the claims query itself goes
    // straight to `.orderBy().limit()`, matching every other test in this
    // describe block that never seeds a branch-filter WHERE result.
    expect(whereCallCount).toBe(3);
  });
});

describe("resolveBranchId", () => {
  const BRANCHES = [
    { id: "branch-riyadh" },
    { id: "branch-mecca" },
  ];

  it("returns the id when it matches one of the tenant's own branches", async () => {
    const { resolveBranchId } = await import("../lib/data");
    expect(resolveBranchId("branch-riyadh", BRANCHES)).toBe("branch-riyadh");
  });

  it("returns undefined for a raw id that isn't any of the tenant's branches — the security boundary for the ?branch= URL param", async () => {
    // This is what stands between the branch-scope filter and a cross-tenant
    // or stale/forged branch id: an id that doesn't belong to THIS tenant's
    // own (RLS-scoped) branch list is silently ignored, never trusted as a
    // filter — so it can never widen or redirect the query to another
    // tenant's data. The underlying claims query still runs under RLS
    // regardless (defense in depth), but this is the first gate.
    const { resolveBranchId } = await import("../lib/data");
    expect(resolveBranchId("some-other-tenants-branch-id", BRANCHES)).toBeUndefined();
    expect(resolveBranchId("", BRANCHES)).toBeUndefined();
    expect(resolveBranchId(undefined, BRANCHES)).toBeUndefined();
    expect(resolveBranchId(null, BRANCHES)).toBeUndefined();
  });

  it("trims whitespace before matching", async () => {
    const { resolveBranchId } = await import("../lib/data");
    expect(resolveBranchId("  branch-mecca  ", BRANCHES)).toBe("branch-mecca");
  });
});

describe("getAnalytics branch scoping", () => {
  it("passes the branch filter to moneyScope/reasonPareto/trend when a branch is selected", async () => {
    executeQueue = [{ rows: [] }, { rows: [] }];
    const { getAnalytics } = await import("../lib/data");

    await getAnalytics("tenant-a", "branch-1");

    // Direct moneyScope(db, {branchIds:[...]}) call — NOT the cached
    // getMoneyScope wrapper (which always fetches the tenant's full,
    // unfiltered scope for the command-bar's global money indicator).
    expect(mockedMoneyScope).toHaveBeenCalledWith(
      expect.anything(),
      { branchIds: ["branch-1"] },
    );
    expect(mockedReasonPareto).toHaveBeenCalledWith(
      expect.anything(),
      { branchIds: ["branch-1"] },
    );
    expect(mockedTrend).toHaveBeenCalledWith(
      expect.anything(),
      { branchIds: ["branch-1"] },
    );
  });

  it("calls moneyScope/reasonPareto/trend UNFILTERED when no branch is selected (All branches)", async () => {
    executeQueue = [{ rows: [] }, { rows: [] }];
    const { getAnalytics } = await import("../lib/data");

    await getAnalytics("tenant-a");

    // No branchId -> routed through the cached getMoneyScope wrapper, which
    // still calls moneyScope(db) under the hood but with NO filter arg (1
    // argument, not 2) — distinct from the branchId path's moneyScope(db, f).
    expect(mockedMoneyScope).toHaveBeenCalledWith(expect.anything());
    expect(mockedMoneyScope).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    );
    expect(mockedReasonPareto).toHaveBeenCalledWith(expect.anything(), undefined);
    expect(mockedTrend).toHaveBeenCalledWith(expect.anything(), undefined);
  });
});

// Shared by every "branch scoping" describe block below. getAppealables/
// getRecovery issue raw `db.execute(sql\`...\`)` calls (NOT query-builder
// .where()), so whereCallCount does not apply. We instead walk the SQL
// object's public `.queryChunks` tree to recover bound values: drizzle-orm's
// sql`` tag pushes interpolated `${value}`s in as their raw, unwrapped JS
// value (a plain string/number — traced against the installed
// drizzle-orm@0.45.2 `sql()` implementation; there is no special wrapper
// class for this, `Param` is a distinct thing only produced by explicit
// `sql.param()` calls, which this codebase never uses), literal SQL text is
// a StringChunk (skipped), and an embedded `sql\`...\`` (an optional
// predicate) is a nested SQL we recurse into.
const boundValuesOf = (query: unknown): unknown[] => {
  const out: unknown[] = [];
  const walk = (chunk: unknown): void => {
    if (chunk instanceof SQL) {
      for (const c of chunk.queryChunks ?? []) walk(c);
      return;
    }
    if (chunk instanceof StringChunk) return; // literal SQL text, not a value
    out.push(chunk);
  };
  for (const c of (query as SQL)?.queryChunks ?? []) walk(c);
  return out;
};

describe("getAppealables branch scoping", () => {
  it("adds c.branch_id to the executed query when a branchId is provided", async () => {
    const { getAppealables } = await import("../lib/appeals-data");

    await getAppealables("tenant-a", 100, "branch-1");

    expect(executedQueries).toHaveLength(1);
    expect(boundValuesOf(executedQueries[0])).toContain("branch-1");
  });

  it("omits any branch_id predicate when branchId is not provided (All branches)", async () => {
    const { getAppealables } = await import("../lib/appeals-data");

    await getAppealables("tenant-a", 100);

    expect(executedQueries).toHaveLength(1);
    // The only bound value in this query is LIMIT (the number 100) — no
    // branch id string is interpolated when branchId is omitted.
    expect(boundValuesOf(executedQueries[0])).not.toContain("branch-1");
  });
});

describe("getRecovery branch scoping", () => {
  // getRecovery issues exactly two db.execute() calls when branchId is set
  // (appealPipelineRows, then the win-rate aggregate) — moneyScope/getLatestBaseline
  // are mocked and don't reach the db. Both queries must carry the branch id.

  it("moves all three surfaces (money, pipeline rows, win-rate aggregate) onto the branch when a branchId is passed", async () => {
    // executeQueue order matches getRecovery's call sequence: appealPipelineRows
    // (inside the opening Promise.all) resolves before the win-rate aggregate
    // (awaited after Promise.all settles). moneyScope/getLatestBaseline are
    // mocked, so only these two execute() calls reach the fake db.
    executeQueue = [
      { rows: [] }, // appealPipelineRows
      { rows: [{ won: 1, lost: 0, median_days: 14 }] }, // win-rate aggregate
    ];
    const { getRecovery } = await import("../lib/data");

    await getRecovery("tenant-a", "branch-1");

    // Surface 1 — money: direct moneyScope(db, {branchIds}), NOT the cached
    // getMoneyScope wrapper (same split getAnalytics uses).
    expect(mockedMoneyScope).toHaveBeenCalledWith(
      expect.anything(),
      { branchIds: ["branch-1"] },
    );
    // Two raw-SQL executes, in pipeline-rows then aggregate order.
    expect(executedQueries).toHaveLength(2);
    // Surface 2 — appealPipelineRows (executedQueries[0]) carries the branch id.
    expect(boundValuesOf(executedQueries[0])).toContain("branch-1");
    // Surface 3 — win-rate aggregate (executedQueries[1]) carries the branch id.
    expect(boundValuesOf(executedQueries[1])).toContain("branch-1");
  });

  it("leaves all three surfaces unfiltered when no branchId is passed (All branches)", async () => {
    executeQueue = [
      { rows: [] }, // appealPipelineRows
      { rows: [{ won: 0, lost: 0, median_days: 0 }] }, // win-rate aggregate
    ];
    const { getRecovery } = await import("../lib/data");

    await getRecovery("tenant-a");

    // Surface 1 — money: routed through the cached getMoneyScope wrapper, which
    // calls moneyScope(db) with NO filter arg (1 argument, not 2) — distinct
    // from the branchId path's moneyScope(db, f). Matches getAnalytics'
    // unfiltered test.
    expect(mockedMoneyScope).toHaveBeenCalledWith(expect.anything());
    expect(mockedMoneyScope).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    );
    // Surfaces 2 + 3 — neither raw query carries a branch predicate. The
    // pipeline-rows query's only bound value is LIMIT (the number 200); the
    // aggregate has no bound values at all when unfiltered.
    expect(executedQueries).toHaveLength(2);
    expect(boundValuesOf(executedQueries[0])).not.toContain("branch-1");
    expect(boundValuesOf(executedQueries[1])).not.toContain("branch-1");
  });
});

describe("appealPipelineRows (private) via getRecovery / getOwnerReportData", () => {
  const RAW_ROWS = {
    rows: [
      {
        appeal_id: "appeal-1",
        claim_id: "claim-1",
        nphies_claim_id: "N-1",
        payer_name: "Bupa",
        status: "won",
        appealed_sar: "1000.00",
        recovered_sar: "800.00",
        days_open: "14", // Postgres numeric/EXTRACT often arrives as a string
      },
      {
        appeal_id: "appeal-2",
        claim_id: "claim-2",
        nphies_claim_id: null,
        payer_name: "Tawuniya",
        status: "pending",
        appealed_sar: "500.00",
        recovered_sar: null,
        days_open: 3,
      },
    ],
  };

  it("maps SQL rows to AppealPipelineRow, coercing days_open to a number", async () => {
    // getRecovery: Promise.all([getMoneyScope, getLatestBaseline, appealPipelineRows])
    // then a separate agg execute() call, in that order.
    executeQueue = [
      RAW_ROWS,
      { rows: [{ won: 1, lost: 0, median_days: 14 }] },
    ];
    const { getRecovery } = await import("../lib/data");

    const bundle = await getRecovery("tenant-a");

    expect(bundle.rows).toEqual([
      {
        appealId: "appeal-1",
        claimId: "claim-1",
        nphiesClaimId: "N-1",
        payerName: "Bupa",
        status: "won",
        appealedSar: "1000.00",
        recoveredSar: "800.00",
        daysOpen: 14,
      },
      {
        appealId: "appeal-2",
        claimId: "claim-2",
        nphiesClaimId: null,
        payerName: "Tawuniya",
        status: "pending",
        appealedSar: "500.00",
        recoveredSar: null,
        daysOpen: 3,
      },
    ]);
    expect(typeof bundle.rows[0].daysOpen).toBe("number");
  });

  it("feeds getOwnerReportData's topPayers aggregation with the same mapped rows", async () => {
    // getOwnerReportData: Promise.all([denialRateDim, trend, getLatestBaseline,
    // appealPipelineRows]) — denialRateDim's execute() call precedes
    // appealPipelineRows' in that array-literal order.
    executeQueue = [{ rows: [] }, RAW_ROWS];
    const { getOwnerReportData } = await import("../lib/data");

    const bundle = await getOwnerReportData("tenant-a");

    expect(bundle.topPayers).toEqual([
      { name: "Bupa", recoveredSar: "800.00" },
    ]);
  });
});

describe("getOwnerReportData baselineFirstPassRate derivation", () => {
  beforeEach(() => {
    executeQueue = [{ rows: [] }, { rows: [] }];
  });

  it("derives baseline first-pass rate as 1 - deniedCount/claimCount", async () => {
    mockedGetLatestBaseline.mockResolvedValue({
      id: "baseline-1",
      capturedAt: "2026-01-01T00:00:00Z",
      atRiskSar: "10000.00",
      deniedCount: 25,
      claimCount: 100,
      note: null,
    });
    const { getOwnerReportData } = await import("../lib/data");

    const bundle = await getOwnerReportData("tenant-a");

    expect(bundle.baselineFirstPassRate).toBeCloseTo(0.75);
  });

  it("is null when no baseline was ever captured", async () => {
    mockedGetLatestBaseline.mockResolvedValue(null);
    const { getOwnerReportData } = await import("../lib/data");

    const bundle = await getOwnerReportData("tenant-a");

    expect(bundle.baselineFirstPassRate).toBeNull();
  });

  it("is null (not NaN/Infinity) when the baseline's claimCount is 0", async () => {
    mockedGetLatestBaseline.mockResolvedValue({
      id: "baseline-2",
      capturedAt: "2026-01-01T00:00:00Z",
      atRiskSar: "0.00",
      deniedCount: 0,
      claimCount: 0,
      note: null,
    });
    const { getOwnerReportData } = await import("../lib/data");

    const bundle = await getOwnerReportData("tenant-a");

    expect(bundle.baselineFirstPassRate).toBeNull();
  });
});
