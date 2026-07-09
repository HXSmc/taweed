// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AppSession } from "../lib/session";
import type { getRecovery as GetRecoveryFn } from "../lib/data";
import enMessages from "../messages/en.json";
import arMessages from "../messages/ar.json";

// Regression test (manual-keyboard WCAG AA finding, /en/recovery and
// /ar/recovery, Submitted-stage pipeline table): the per-row "Mark won" /
// "Mark lost" appeal-outcome buttons rendered with generic, identical
// accessible names (just the visible button text, e.g. "Mark won, button")
// and nothing tying the name to the row's claim/payer/amount — unlike the
// Scrubber page's equivalent per-row action, which sets
// `aria-label={`Claim ${id}, risk ${score}`}` (scrubber-table.tsx). A
// screen-reader user tabbing through N identical rows heard the same name N
// times and had to fall back to manual cell navigation to correlate a button
// back to its row before submitting an outcome that changes claim state.
//
// Fix: page.tsx now builds `t("markWonAriaLabel", { payer, amount })` /
// `t("markLostAriaLabel", { payer, amount })` per row (new keys in
// messages/en.json + messages/ar.json) and applies them as `aria-label` on
// the two buttons, so each row's actions announce with its own payer and
// appealed amount — mirroring the Scrubber convention and giving every row a
// distinct, contextual accessible name in both locales.
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

// Minimal but real interpolation against the project's own message catalogs,
// so this test fails if the translation templates regress (missing
// placeholder, locale drift) and not just if the wiring in page.tsx breaks.
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return Object.entries(values).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function makeTranslator(messages: typeof enMessages) {
  return (key: string, values?: Record<string, string | number>) => {
    const template = (messages.recovery as Record<string, string>)[key] ?? key;
    return interpolate(template, values);
  };
}

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => makeTranslator(enMessages) as unknown),
  setRequestLocale: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/data", () => ({ getRecovery: vi.fn() }));
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

function makeBundle(): Awaited<ReturnType<typeof GetRecoveryFn>> {
  return {
    money: { recoveredSar: "0", atRiskSar: "10000", deniedCount: 2, claimCount: 20 },
    winRate: 0,
    medianDays: 5,
    sharePct: 0,
    shareSar: "0",
    baseline: null,
    rows: [
      {
        appealId: "a1",
        claimId: "c1111111-1111-4111-8111-111111111111",
        nphiesClaimId: "N1",
        payerName: "MedGulf",
        appealedSar: "1437",
        recoveredSar: null,
        daysOpen: 4,
        status: "submitted",
      },
      {
        appealId: "a2",
        claimId: "c2222222-2222-4222-8222-222222222222",
        nphiesClaimId: "N2",
        payerName: "Bupa",
        appealedSar: "2600",
        recoveredSar: null,
        daysOpen: 9,
        status: "submitted",
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecoveryPage — per-row Mark won/lost aria-label carries row context (WCAG 2.4.6 / manual-keyboard)", () => {
  it("gives each row's Mark won / Mark lost buttons a distinct, payer+amount-scoped accessible name", async () => {
    // Arrange
    mockedRequireSession.mockResolvedValue(makeSession());
    mockedGetRecovery.mockResolvedValue(makeBundle());

    // Act
    const element = await RecoveryPage({ params: Promise.resolve({ locale: "en" }) });
    render(element);

    // Assert: row 1 (MedGulf, SAR 1,437) and row 2 (Bupa, SAR 2,600) each get
    // their own accessible name — no generic "Mark won"/"Mark lost" with no
    // row context, and no collision between rows.
    expect(
      screen.getByRole("button", { name: "Mark won, MedGulf, SAR 1,437" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark lost, MedGulf, SAR 1,437" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark won, Bupa, SAR 2,600" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark lost, Bupa, SAR 2,600" }),
    ).toBeInTheDocument();

    // The old bare, row-agnostic accessible name must no longer exist —
    // it's ambiguous the moment there's more than one row.
    expect(screen.queryByRole("button", { name: "Mark won" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark lost" })).not.toBeInTheDocument();
  });

  it("renders the Arabic aria-label translation (not a leftover English template) for /ar/recovery", async () => {
    // Arrange
    vi.mocked(
      (await import("next-intl/server")).getTranslations,
    ).mockResolvedValue(makeTranslator(arMessages) as never);
    mockedRequireSession.mockResolvedValue(makeSession());
    mockedGetRecovery.mockResolvedValue(makeBundle());

    // Act
    const element = await RecoveryPage({ params: Promise.resolve({ locale: "ar" }) });
    render(element);

    // Assert: the Arabic template `"markWonAriaLabel": "علّم كمقبولة، {payer}، {amount} ريال"`
    // is interpolated with this row's own payer/amount, not left untranslated.
    expect(
      screen.getByRole("button", { name: "علّم كمقبولة، MedGulf، 1,437 ريال" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "علّم كمرفوضة، MedGulf، 1,437 ريال" }),
    ).toBeInTheDocument();
  });
});
