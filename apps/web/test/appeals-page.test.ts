import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSession } from "../lib/session";

// Page-level control-flow test for AppealsPage: confirms the optional
// ?branch=<id> searchParam is resolved against the tenant's real branches
// (via resolveBranchId) and the RESOLVED id — not the raw, un-validated param
// — reaches getAppealables as its third argument. Same mocking shape as
// recovery-page.test.ts: mock the true module boundaries + every child
// component the page imports, so this exercises real control flow only (no
// JSX/DOM rendering). RLS remains the real data-security boundary; this just
// guards the param-resolution wiring.

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ((key: string) => key) as unknown),
  setRequestLocale: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}));
vi.mock("@/lib/appeals-data", () => ({
  getAppealables: vi.fn(),
}));
// The page now calls `resolveBranchScope`; mirror the real helper inside the
// mock so it composes the mocked getBranches / resolveBranchId — that keeps
// the existing assertions on those two boundaries meaningful without pulling
// in the real data.ts (which touches server-only React `cache`).
vi.mock("@/lib/data", () => {
  const getBranches = vi.fn();
  const resolveBranchId = vi.fn();
  return {
    getBranches,
    resolveBranchId,
    resolveBranchScope: vi.fn(
      async (
        tenantId: string,
        searchParams: Promise<{ branch?: string }> | undefined,
      ) => {
        const branches = await getBranches(tenantId);
        const sp = (await searchParams) ?? {};
        const branchId = resolveBranchId(sp.branch, branches);
        return { branches, branchId };
      },
    ),
  };
});
vi.mock("@/lib/audit", () => ({
  recordPhiAccess: vi.fn(),
}));
// The page's own JSX tree is irrelevant to the param-resolution wiring under
// test — stub the child components so this test exercises control flow only,
// not React rendering (no DOM needed).
vi.mock("@/components/shell/page-header", () => ({
  PageHeader: () => null,
}));
vi.mock("@/components/modules/appeals-composer", () => ({
  AppealsComposer: () => null,
}));

import { requireSession } from "../lib/session";
import { getAppealables } from "../lib/appeals-data";
import { getBranches, resolveBranchId } from "../lib/data";
import AppealsPage from "../app/[locale]/(app)/appeals/page";

const mockedRequireSession = vi.mocked(requireSession);
const mockedGetAppealables = vi.mocked(getAppealables);
const mockedGetBranches = vi.mocked(getBranches);
const mockedResolveBranchId = vi.mocked(resolveBranchId);

function makeSession(overrides: Partial<AppSession> = {}): AppSession {
  return {
    userId: "u1",
    tenantId: "11111111-1111-4111-8111-111111111111",
    tenantName: "Test Tenant",
    role: "finance",
    email: "user@example.com",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetAppealables.mockResolvedValue([]);
});

describe("AppealsPage — ?branch param is resolved before reaching getAppealables", () => {
  it("passes the resolveBranchId() result (not the raw param) as the third arg to getAppealables", async () => {
    // Arrange
    mockedRequireSession.mockResolvedValue(makeSession());
    mockedGetBranches.mockResolvedValue([
      { id: "resolved-branch-id", name: "Riyadh", city: null },
    ]);
    // resolveBranchId is the security boundary that validates the raw param
    // against the tenant's real branches — mock it to return a distinct id so
    // we can assert the RESOLVED value (not "some-id") reaches the data call.
    mockedResolveBranchId.mockReturnValue("resolved-branch-id");

    // Act
    await AppealsPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ branch: "some-id" }),
    });

    // Assert: the resolved id reaches getAppealables, not the raw "some-id".
    expect(mockedGetBranches).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mockedResolveBranchId).toHaveBeenCalledWith("some-id", [
      { id: "resolved-branch-id", name: "Riyadh", city: null },
    ]);
    expect(mockedGetAppealables).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      100,
      "resolved-branch-id",
    );
  });

  it("calls getAppealables with no branch when searchParams is absent (direct unit-test invocation)", async () => {
    // Arrange
    mockedRequireSession.mockResolvedValue(makeSession());
    mockedGetBranches.mockResolvedValue([]);
    mockedResolveBranchId.mockReturnValue(undefined);

    // Act — no searchParams passed (optional), as a direct unit test would do.
    await AppealsPage({
      params: Promise.resolve({ locale: "en" }),
    });

    // Assert: undefined branchId → getAppealables called with limit defaulted
    // to 100 and an explicit undefined third arg.
    expect(mockedGetAppealables).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      100,
      undefined,
    );
  });
});
