import { describe, it, expect, vi, beforeEach } from "vitest";

// A2 corridor step 4 (first-insight handoff): completeOnboarding() captures the
// EXECUTE B8 recovery baseline exactly once for the tenant, so isOnboarded()
// flips true and a return visit to /onboarding bounces out instead of
// re-running the corridor. Mirrors the rate-limit + session + audit shape of
// every sibling mutating action in lib/actions/.

const mockedGetSession = vi.fn();
vi.mock("@/lib/session", () => ({
  getSession: (...args: unknown[]) => mockedGetSession(...args),
}));

const mockedAllowRequest = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  allowRequest: (...args: unknown[]) => mockedAllowRequest(...args),
}));

const mockedWithSession = vi.fn();
vi.mock("@/lib/db", () => ({
  withSession: (...args: unknown[]) => mockedWithSession(...args),
}));

const mockedGetLatestBaseline = vi.fn();
const mockedCaptureBaseline = vi.fn();
vi.mock("@taweed/analytics", () => ({
  getLatestBaseline: (...args: unknown[]) => mockedGetLatestBaseline(...args),
  captureBaseline: (...args: unknown[]) => mockedCaptureBaseline(...args),
}));

const mockedLogAudit = vi.fn();
vi.mock("@taweed/audit", () => ({
  logAudit: (...args: unknown[]) => mockedLogAudit(...args),
}));

const mockedRevalidatePath = vi.fn();
const mockedRevalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockedRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockedRevalidateTag(...args),
}));

import { completeOnboarding } from "../lib/actions/onboarding";

const SESSION = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  tenantName: "Al Salama Dental",
  email: "owner@example.com",
  role: "owner",
};
const stubDb = { execute: vi.fn() };

// Records the order operations actually ran in, across all the separately
// mocked calls below — the only way to prove the advisory lock is taken
// BEFORE the read-then-write, not just that all three happened.
let callOrder: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  callOrder = [];
  mockedGetSession.mockResolvedValue(SESSION);
  mockedAllowRequest.mockResolvedValue(true);
  mockedWithSession.mockImplementation(
    async (_tenantId: string, fn: (db: unknown) => unknown) => fn(stubDb),
  );
  stubDb.execute.mockReset();
  stubDb.execute.mockImplementation(async () => {
    callOrder.push("lock");
    return { rows: [] };
  });
  mockedGetLatestBaseline.mockImplementation(async () => {
    callOrder.push("getLatestBaseline");
    return null;
  });
  mockedCaptureBaseline.mockImplementation(async () => {
    callOrder.push("captureBaseline");
  });
});

describe("completeOnboarding server action", () => {
  it("returns not-ok and never opens a session with no authenticated user", async () => {
    mockedGetSession.mockResolvedValue(null);

    const result = await completeOnboarding();

    expect(result).toEqual({ ok: false });
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("returns not-ok and does no work when rate-limited", async () => {
    mockedAllowRequest.mockResolvedValue(false);

    const result = await completeOnboarding();

    expect(result).toEqual({ ok: false });
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("keys the throttle per tenant+actor like every sibling action", async () => {
    await completeOnboarding();

    expect(mockedAllowRequest).toHaveBeenCalledWith(
      `onboarding:${SESSION.tenantId}:${SESSION.userId}`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("captures the baseline and writes an audit row when none exists yet", async () => {
    const result = await completeOnboarding();

    expect(mockedWithSession).toHaveBeenCalledWith(SESSION.tenantId, expect.any(Function));
    expect(mockedCaptureBaseline).toHaveBeenCalledWith(stubDb, "onboarding");
    expect(mockedLogAudit).toHaveBeenCalledWith(
      stubDb,
      expect.objectContaining({ actor: SESSION.email, action: "write" }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("invalidates the tenant's cached analytics on completion (Phase 4 finding)", async () => {
    // Regression coverage for a CONFIRMED architecture/correctness finding:
    // getRecovery/getOwnerReportData (apps/web/lib/data.ts) are cached via
    // unstable_cache and read the baseline this action writes. Without
    // revalidateTag, a tenant who viewed Recovery/Owner-report pre-onboarding
    // (baseline null) could see stale data for up to the cache TTL right
    // after completing onboarding — exactly the "first-insight" moment this
    // action exists for. Fires unconditionally, same as the revalidatePath
    // call right above it in the source — harmless on the idempotent
    // already-onboarded path (a cheap recompute, not a correctness issue),
    // and simpler than conditioning it on whether a new baseline landed.
    await completeOnboarding();

    expect(mockedRevalidateTag).toHaveBeenCalledWith(`analytics:${SESSION.tenantId}`);
  });

  it("takes a per-tenant advisory lock before the read-then-write, closing the TOCTOU race", async () => {
    // Regression coverage for a CONFIRMED security-review finding: two
    // concurrent completeOnboarding() calls for the same tenant could both
    // observe no baseline and both insert one (no unique constraint on
    // recovery_baselines). A pg_advisory_xact_lock scoped to the tenant,
    // held for the transaction, serializes concurrent callers.
    await completeOnboarding();

    expect(stubDb.execute).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["lock", "getLatestBaseline", "captureBaseline"]);
  });

  it("is idempotent: does not mint a second baseline row on a repeat call", async () => {
    mockedGetLatestBaseline.mockResolvedValue({
      id: "b1",
      capturedAt: "2026-01-01T00:00:00Z",
      atRiskSar: "100.00",
      deniedCount: 1,
      claimCount: 1,
      note: "onboarding",
    });

    const result = await completeOnboarding();

    expect(mockedCaptureBaseline).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
