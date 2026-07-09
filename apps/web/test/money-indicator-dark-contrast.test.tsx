// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Regression test (axe:color-contrast finding, /en/ingest and /ar/ingest,
// dark theme): the command-bar MoneyIndicator's "Recovered" and "At risk"
// figures render with `text-recovered-text` / `text-at-risk-text`. Those
// tokens were defined only in `:root` (light theme) and never retuned inside
// app/globals.css's `.dark` override block, so dark theme inherited the
// light hex values against dark surfaces — ~3.15:1 (recovered) and ~2.5:1
// (at-risk), both under the 4.5:1 AA minimum for normal text. MoneyIndicator
// renders on every authenticated page (command-bar.tsx), so this is a
// systemic token gap, not an Ingest-only bug, and reproduces identically in
// EN-dark and AR-dark.
//
// The token-level fix and its own contrast-math regression test live in
// app/globals.css and analytics-dark-money-token-contrast.test.ts (shared
// root cause). This test guards the *component* contract at the level the
// Ingest page actually consumes: MoneyIndicator must keep routing its
// figures through the `-text` design tokens (never a hardcoded/inline color)
// so that CSS-level dark-mode fix keeps covering it.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// CountUp reads IntersectionObserver/matchMedia, neither available in jsdom
// and neither relevant to this finding — stub it to its settled value, the
// same pattern used by ingest-panel-contrast-and-i18n.test.tsx.
vi.mock("@/components/money/count-up", () => ({
  CountUp: ({ value, className }: { value: number; className?: string }) => (
    <span className={className}>{value}</span>
  ),
}));

import { MoneyIndicator } from "@/components/shell/money-indicator";

describe("MoneyIndicator — recovered/at-risk figure token contrast", () => {
  // This suite's setup does not register RTL's afterEach auto-cleanup (see
  // ingest-panel-contrast-and-i18n.test.tsx's note on the same convention),
  // so each test's DOM must be torn down explicitly.
  afterEach(cleanup);

  it("renders the recovered figure via the --recovered-text design token", () => {
    render(<MoneyIndicator recovered={66275} atRisk={131850} scopeLabel="All branches" />);

    const recoveredValue = screen.getByText("66275");
    const recoveredWrapper = recoveredValue.closest("span.text-recovered-text");
    expect(recoveredWrapper).not.toBeNull();
    // Regression guard: must never fall back to a hardcoded/inline color that
    // would bypass the `.dark` token override in app/globals.css.
    expect(recoveredWrapper).not.toHaveAttribute("style", expect.stringContaining("color"));
  });

  it("renders the at-risk figure via the --at-risk-text design token", () => {
    render(<MoneyIndicator recovered={66275} atRisk={131850} scopeLabel="All branches" />);

    const atRiskValue = screen.getByText("131850");
    const atRiskWrapper = atRiskValue.closest("span.text-at-risk-text");
    expect(atRiskWrapper).not.toBeNull();
    expect(atRiskWrapper).not.toHaveAttribute("style", expect.stringContaining("color"));
  });
});
