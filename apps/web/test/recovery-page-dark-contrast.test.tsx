// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { AppSession } from "../lib/session";
import type { getRecovery as GetRecoveryFn } from "../lib/data";

// Regression test (axe:color-contrast finding, /en/recovery and /ar/recovery,
// dark theme): three Recovery-page money figures render via the
// `text-recovered-text` utility class — the hero "share of recovered SAR"
// stat (page.tsx ~L77-79), the per-stage-group "Recovered (SAR)" rollup next
// to the appealed total (~L100-104), and each Won-stage table row's
// "Recovered (SAR)" cell (~L167-168). `--recovered-text` was only defined in
// `:root` and never retuned inside app/globals.css's `.dark` block, so all
// three inherited the light hex (#07734f) against dark surfaces — ~3.15:1,
// under the 4.5:1 AA minimum for normal text.
//
// The token-level fix and its own contrast-math regression test live in
// app/globals.css and analytics-dark-money-token-contrast.test.ts (shared
// root cause with every other page using --recovered-text/--at-risk-text).
// This test guards the *page* contract at the level Recovery actually
// consumes it: these three call sites must keep routing through the
// `text-recovered-text` token class (never a hardcoded/inline color) so the
// CSS-level dark-mode fix keeps covering them.

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

describe("RecoveryPage — recovered-figure token contrast", () => {
  it("routes the hero share stat, stage-group rollup, and Won-stage table cell through --recovered-text", async () => {
    // Arrange
    mockedRequireSession.mockResolvedValue(makeSession());
    mockedGetRecovery.mockResolvedValue({
      money: { recoveredSar: "66275", atRiskSar: "131850", deniedCount: 40, claimCount: 400 },
      winRate: 0.62,
      medianDays: 14,
      sharePct: 0.12,
      shareSar: "7953",
      baseline: null,
      rows: [
        {
          appealId: "a1",
          claimId: "c1111111-1111-4111-8111-111111111111",
          nphiesClaimId: "N1",
          payerName: "Bupa",
          appealedSar: "5000",
          recoveredSar: "4000",
          daysOpen: 3,
          status: "won",
        },
      ],
    } satisfies Awaited<ReturnType<typeof GetRecoveryFn>>);

    // Act
    const element = await RecoveryPage({ params: Promise.resolve({ locale: "en" }) });
    const { container } = render(element);

    // Assert
    const recoveredTextEls = Array.from(container.querySelectorAll(".text-recovered-text"));
    expect(recoveredTextEls).toHaveLength(3);

    // Hero "share of recovered SAR" stat.
    expect(recoveredTextEls.some((el) => (el.textContent ?? "").includes("7,953"))).toBe(true);

    // Per-stage-group "Recovered (SAR)" rollup, rendered next to the label key.
    expect(
      recoveredTextEls.some(
        (el) => (el.textContent ?? "").includes("recoveredSar") && (el.textContent ?? "").includes("4,000"),
      ),
    ).toBe(true);

    // Won-stage table row's "Recovered (SAR)" cell — the TD itself carries the
    // class (no wrapper span), so its trimmed text is exactly the amount.
    expect(recoveredTextEls.some((el) => (el.textContent ?? "").trim() === "4,000")).toBe(true);

    // Regression guard: none of the three may fall back to an inline/hardcoded
    // color that would bypass the `.dark` token override in app/globals.css.
    for (const el of recoveredTextEls) {
      expect(el).not.toHaveAttribute("style", expect.stringContaining("color"));
    }
  });
});
