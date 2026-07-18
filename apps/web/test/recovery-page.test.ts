import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSession } from "../lib/session";

// Regression test (audit finding): RecoveryPage used to gate the read path
// with only requireSession() — any authenticated tenant user, of any role —
// then unconditionally fetch and render getRecovery() (SAR recovered/appealed
// figures, win rate, median days, and a per-claim pipeline table with NPHIES
// claim ids and payer names). Per rbac.ts's MATRIX, "recovery" is "hidden"
// for clinician. The mutation (markAppealOutcomeForm) was already protected
// by authorizeAction('recovery', ['full']), but nothing re-checked rbac.ts
// before rendering the read side. This test drives the real rbac.ts MATRIX
// (only session lookup and the data fetch are mocked) so it fails if the
// read-side gate regresses. Same bug class already fixed for ingest and
// settings (see ingest-page.test.ts, settings-page.test.ts).

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
vi.mock("@/lib/data", () => ({
  getRecovery: vi.fn(),
  getBranches: vi.fn(),
  resolveBranchId: vi.fn(),
}));
vi.mock("@/lib/actions/recovery", () => ({
  markAppealOutcomeForm: vi.fn(),
}));
// The page's own JSX tree is irrelevant to the RBAC gate under test — stub
// the child components so this test exercises real rbac.ts + control flow
// only, not React rendering (no DOM needed).
vi.mock("@/components/shell/page-header", () => ({
  PageHeader: () => null,
  Provenance: (props: { children?: unknown }) => props.children,
}));
vi.mock("@/components/ui/card", () => ({
  Card: (props: { children?: unknown }) => props.children,
  CardContent: (props: { children?: unknown }) => props.children,
}));
vi.mock("@/components/ui/badge", () => ({ Badge: (props: { children?: unknown }) => props.children }));
vi.mock("@/components/ui/button", () => ({ Button: (props: { children?: unknown }) => props.children }));
vi.mock("@/components/money/money-figure", () => ({ MoneyFigure: () => null }));
vi.mock("@/components/ui/table", () => ({
  TableWrap: (props: { children?: unknown }) => props.children,
  Table: (props: { children?: unknown }) => props.children,
  THead: (props: { children?: unknown }) => props.children,
  TBody: (props: { children?: unknown }) => props.children,
  TR: (props: { children?: unknown }) => props.children,
  TH: (props: { children?: unknown }) => props.children,
  TD: (props: { children?: unknown }) => props.children,
}));

import { requireSession } from "../lib/session";
import { getRecovery, getBranches, resolveBranchId } from "../lib/data";
import RecoveryPage from "../app/[locale]/(app)/recovery/page";

const mockedRequireSession = vi.mocked(requireSession);
const mockedGetRecovery = vi.mocked(getRecovery);
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

const emptyRecovery = {
  money: { recoveredSar: "0", appealedSar: "0" },
  winRate: 0,
  medianDays: 0,
  sharePct: 0,
  shareSar: "0",
  rows: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: no branch param → resolveBranchId returns undefined, so the page
  // calls getRecovery(tenantId, undefined). Individual tests override these to
  // exercise the branch-resolution path.
  mockedGetBranches.mockResolvedValue([]);
  mockedResolveBranchId.mockReturnValue(undefined);
});

describe("RecoveryPage — server-enforced RBAC gate on the read path", () => {
  it("notFound()s and never fetches recovery data for role=clinician (recovery is hidden per rbac.ts MATRIX)", async () => {
    // Arrange
    mockedRequireSession.mockResolvedValue(makeSession({ role: "clinician" }));

    // Act + Assert: a direct navigation to /[locale]/recovery must fail
    // closed, not silently render the financial recovery dashboard.
    await expect(
      RecoveryPage({ params: Promise.resolve({ locale: "en" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockedGetRecovery).not.toHaveBeenCalled();
  });

  it.each(["owner", "finance", "rcm", "admin"] as const)(
    "renders and fetches recovery data for role=%s (recovery is not hidden per rbac.ts MATRIX)",
    async (role) => {
      // Arrange
      mockedRequireSession.mockResolvedValue(makeSession({ role }));
      mockedGetRecovery.mockResolvedValue(emptyRecovery as unknown as Awaited<
        ReturnType<typeof getRecovery>
      >);

      // Act
      await expect(
        RecoveryPage({ params: Promise.resolve({ locale: "en" }) }),
      ).resolves.toBeTruthy();

      // Assert: no branch param → getRecovery called with (tenantId, undefined).
      expect(mockedGetRecovery).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        undefined,
      );
    },
  );
});

describe("RecoveryPage — ?branch param is resolved before reaching getRecovery", () => {
  it("passes the resolveBranchId() result (not the raw param) as the second arg to getRecovery", async () => {
    // Arrange
    mockedRequireSession.mockResolvedValue(makeSession({ role: "finance" }));
    mockedGetRecovery.mockResolvedValue(
      emptyRecovery as unknown as Awaited<ReturnType<typeof getRecovery>>,
    );
    mockedGetBranches.mockResolvedValue([
      { id: "resolved-branch-id", name: "Riyadh", city: null },
    ]);
    // resolveBranchId is the security boundary that validates the raw param
    // against the tenant's real branches — mock it to return a distinct id so
    // we can assert the RESOLVED value (not "some-id") reaches the data call.
    mockedResolveBranchId.mockReturnValue("resolved-branch-id");

    // Act
    await RecoveryPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ branch: "some-id" }),
    });

    // Assert: the resolved id reaches getRecovery, not the raw "some-id".
    expect(mockedGetBranches).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mockedResolveBranchId).toHaveBeenCalledWith("some-id", [
      { id: "resolved-branch-id", name: "Riyadh", city: null },
    ]);
    expect(mockedGetRecovery).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "resolved-branch-id",
    );
  });

  it("calls getRecovery with undefined branch when searchParams is absent (direct unit-test invocation)", async () => {
    // Arrange
    mockedRequireSession.mockResolvedValue(makeSession({ role: "finance" }));
    mockedGetRecovery.mockResolvedValue(
      emptyRecovery as unknown as Awaited<ReturnType<typeof getRecovery>>,
    );

    // Act — no searchParams passed (optional), as a direct unit test would do.
    await RecoveryPage({
      params: Promise.resolve({ locale: "en" }),
    });

    // Assert: undefined branchId → getRecovery called with two args, second
    // undefined (resolveBranchId's default mock returns undefined).
    expect(mockedGetRecovery).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      undefined,
    );
  });
});
