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
import { getRecovery } from "../lib/data";
import RecoveryPage from "../app/[locale]/(app)/recovery/page";

const mockedRequireSession = vi.mocked(requireSession);
const mockedGetRecovery = vi.mocked(getRecovery);

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

      // Assert
      expect(mockedGetRecovery).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
      );
    },
  );
});
