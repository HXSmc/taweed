// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AppSession } from "../lib/session";
import type { getRecovery as GetRecoveryFn } from "../lib/data";

// Regression test (manual-visual audit finding, /en/recovery and /ar/recovery,
// all themes): the appeal-pipeline table's last <th> (the column holding the
// per-row Mark Won / Mark Lost action buttons) rendered with no text content
// at all — `<TH className="text-end" />`. Not an axe-hard-fail (an empty <th>
// isn't auto-flagged), but a WCAG 1.3.1 best-practice gap: screen-reader
// users navigating column-by-column (a standard NVDA/JAWS/VoiceOver table
// gesture) reached that column header and heard nothing, only the per-row
// button text once they entered a data cell. Fix: a visually-hidden
// `t("actions")` label inside the <th> (page.tsx's pipeline table header
// row), so the header cell now has a real accessible name while staying
// visually blank to sighted users.
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
  resolveBranchScope: vi.fn(async () => ({ branches: [], branchId: undefined })),
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
  Badge: (props: { children?: React.ReactNode }) => <span>{props.children}</span>,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecoveryPage — pipeline table action column header", () => {
  it("gives the trailing (Mark Won / Mark Lost) column header an accessible name", async () => {
    // Arrange
    mockedRequireSession.mockResolvedValue(makeSession());
    mockedGetRecovery.mockResolvedValue({
      money: { recoveredSar: "0", atRiskSar: "5000", deniedCount: 1, claimCount: 10 },
      winRate: 0,
      medianDays: 3,
      sharePct: 0,
      shareSar: "0",
      baseline: null,
      rows: [
        {
          appealId: "a1",
          claimId: "c1111111-1111-4111-8111-111111111111",
          nphiesClaimId: "N1",
          payerName: "Bupa",
          appealedSar: "5000",
          recoveredSar: null,
          daysOpen: 3,
          status: "submitted",
        },
      ],
    } satisfies Awaited<ReturnType<typeof GetRecoveryFn>>);

    // Act
    const element = await RecoveryPage({ params: Promise.resolve({ locale: "en" }) });
    render(element);

    // Assert: the header cell for the action column must expose a real
    // accessible name (the translated "actions" label), not the empty
    // string a column-by-column screen-reader walk previously heard.
    const actionsHeader = screen.getByRole("columnheader", { name: "actions" });
    expect(actionsHeader).toBeInTheDocument();

    // The label must be visually hidden (sr-only), not printed to sighted
    // users — this column intentionally has no visible header text.
    const label = actionsHeader.querySelector(".sr-only");
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe("actions");

    // Every other data-bearing header must still be present and unaffected.
    expect(screen.getByRole("columnheader", { name: "owner" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "payer" })).toBeInTheDocument();
  });
});
