// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import type { AppSession } from "../lib/session";
import type { getRecovery as GetRecoveryFn, AppealPipelineRow } from "../lib/data";

// Regression test (confirmed audit finding, recovery/page.tsx:123): the
// pipeline table sliced each status group down to 25 rows client-render-side
// on top of the underlying query's own LIMIT 200 — a stage with more than 25
// open appeals silently hid the rest with no "view all"/pagination control,
// and the count Badge still showed group.length (the full count), not the
// number of rows actually rendered. Fix: the Badge now shows "shown of total"
// once a stage exceeds the per-stage row cap, so the truncation is visible
// instead of silent; the table itself still renders only the capped rows.
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ((key: string) => key) as unknown),
  setRequestLocale: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/data", () => ({
  getRecovery: vi.fn(),
  getBranches: vi.fn(() => Promise.resolve([])),
  resolveBranchId: vi.fn(() => undefined),
}));
vi.mock("@/lib/actions/recovery", () => ({ markAppealOutcomeForm: vi.fn() }));
vi.mock("@/components/shell/page-header", () => ({
  PageHeader: () => null,
  Provenance: (props: { children?: React.ReactNode }) => <>{props.children}</>,
}));
vi.mock("@/components/ui/card", () => ({
  Card: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
  CardContent: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
}));
vi.mock("@/components/ui/badge", () => ({
  Badge: (props: { children?: React.ReactNode }) => <span data-testid="badge">{props.children}</span>,
}));
vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ComponentProps<"button">) => <button {...props} />,
}));
vi.mock("@/components/money/money-figure", () => ({ MoneyFigure: () => null }));
vi.mock("@/components/ui/table", () => ({
  TableWrap: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
  Table: (props: { children?: React.ReactNode }) => <table>{props.children}</table>,
  THead: (props: { children?: React.ReactNode }) => <thead>{props.children}</thead>,
  TBody: (props: { children?: React.ReactNode }) => <tbody>{props.children}</tbody>,
  TR: (props: { children?: React.ReactNode }) => <tr>{props.children}</tr>,
  TH: (props: React.ComponentProps<"th">) => <th {...props} />,
  TD: (props: React.ComponentProps<"td">) => <td {...props} />,
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

function makeRow(n: number): AppealPipelineRow {
  return {
    appealId: `a${n}`,
    claimId: `c1111111-1111-4111-8111-11111111${String(n).padStart(4, "0")}`,
    nphiesClaimId: `N${n}`,
    payerName: "Bupa",
    appealedSar: "5000",
    recoveredSar: null,
    daysOpen: 3,
    status: "submitted",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("RecoveryPage — pipeline table row cap is reflected in the count Badge", () => {
  it("shows 'shown of total' and renders only 25 rows when a stage has more than 25 appeals", async () => {
    // Arrange: 30 open appeals in the same stage, well past the 25-row cap.
    mockedRequireSession.mockResolvedValue(makeSession());
    const rows = Array.from({ length: 30 }, (_, i) => makeRow(i));
    mockedGetRecovery.mockResolvedValue({
      money: { recoveredSar: "0", atRiskSar: "150000", deniedCount: 0, claimCount: 30 },
      winRate: 0,
      medianDays: 3,
      sharePct: 0,
      shareSar: "0",
      baseline: null,
      rows,
    } satisfies Awaited<ReturnType<typeof GetRecoveryFn>>);

    // Act
    const element = await RecoveryPage({ params: Promise.resolve({ locale: "en" }) });
    render(element);

    // Assert: the truncation is now visible on the Badge (translated via the
    // "shownOfTotal" key here mocked to return its own key name), not the
    // raw full-group count of 30.
    const badge = screen.getByTestId("badge");
    expect(badge.textContent).toBe("shownOfTotal");
    expect(badge.textContent).not.toBe("30");

    // The table itself must still be capped at 25 rendered rows — the cap
    // is a real render-cost guard, not something this fix removes.
    const table = screen.getByRole("table");
    const dataRows = within(table).getAllByRole("row").slice(1); // drop header row
    expect(dataRows).toHaveLength(25);
  });

  it("shows the plain count (not 'shown of total') when a stage has 25 or fewer appeals", async () => {
    // Arrange: exactly at the cap — no truncation should be signaled.
    mockedRequireSession.mockResolvedValue(makeSession());
    const rows = Array.from({ length: 25 }, (_, i) => makeRow(i));
    mockedGetRecovery.mockResolvedValue({
      money: { recoveredSar: "0", atRiskSar: "125000", deniedCount: 0, claimCount: 25 },
      winRate: 0,
      medianDays: 3,
      sharePct: 0,
      shareSar: "0",
      baseline: null,
      rows,
    } satisfies Awaited<ReturnType<typeof GetRecoveryFn>>);

    // Act
    const element = await RecoveryPage({ params: Promise.resolve({ locale: "en" }) });
    render(element);

    // Assert
    const badge = screen.getByTestId("badge");
    expect(badge.textContent).toBe("25");

    const table = screen.getByRole("table");
    const dataRows = within(table).getAllByRole("row").slice(1);
    expect(dataRows).toHaveLength(25);
  });
});
