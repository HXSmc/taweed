// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Regression test (axe:color-contrast finding, /en/settings and /ar/settings,
// "Scrubber rules" tab, dark theme): the rules table in
// app/[locale]/(app)/settings/page.tsx renders each rule's severity via
// `<Badge variant={r.severity === "high" ? "atRisk" : "neutral"}>` (the
// "rules" TabsContent, around the rules.map() table body). The `atRisk`
// variant routes through the `--at-risk-bg`/`--at-risk-text` tokens. Live
// verification (chrome-devtools + axe-core, /en/settings and /ar/settings,
// dark theme, "Scrubber rules" tab) confirms this already resolves via the
// same `.dark` token retune documented in app/globals.css and covered by
// analytics-dark-money-token-contrast.test.ts: computed color
// rgb(240, 162, 119) (#f0a277) on rgb(42, 23, 16) (#2a1710), 0 axe
// color-contrast violations on 8 "high"-severity badges per locale.
//
// This test guards the *component* contract at the level the Settings rules
// table actually consumes — same shared contract as
// scrubber-flag-badge-dark-contrast.test.tsx (Scrubber tab's flag-detail
// Sheet), added here because the Settings "Scrubber rules" tab is a distinct
// render site for the same `atRisk` variant and had no component-level
// coverage of its own: it must keep routing through the `-bg`/`-text` design
// token pair (never a hardcoded/inline color) so the shared `.dark` fix in
// app/globals.css keeps covering it.

import { Badge } from "@/components/ui/badge";

// Mirrors settings/page.tsx: variant={r.severity === "high" ? "atRisk" : "neutral"}.
// Kept as a function (not an inline ternary on a literal-initialized const) so
// TS can't control-flow-narrow `severity` down to a single literal and flag
// the "medium" case's comparison as a no-overlap contradiction.
function variantForSeverity(severity: "high" | "medium"): "atRisk" | "neutral" {
  return severity === "high" ? "atRisk" : "neutral";
}

describe("Badge — atRisk variant (Settings 'Scrubber rules' tab severity chip) dark-theme contrast", () => {
  afterEach(cleanup);

  it("renders 'high' severity via the --at-risk-bg/--at-risk-text token pair, matching settings/page.tsx's rules table", () => {
    const severity: "high" | "medium" = "high";
    render(<Badge variant={variantForSeverity(severity)}>{severity}</Badge>);
    const el = screen.getByText("high");

    expect(el).toHaveClass("bg-at-risk-bg");
    expect(el).toHaveClass("text-at-risk-text");
    // Regression guard: must never fall back to a hardcoded/inline color that
    // would bypass the `.dark` token override in app/globals.css.
    expect(el).not.toHaveAttribute("style", expect.stringContaining("color"));
  });

  it("renders non-'high' severities via the neutral variant, not atRisk", () => {
    const severity: "high" | "medium" = "medium";
    render(<Badge variant={variantForSeverity(severity)}>{severity}</Badge>);
    const el = screen.getByText("medium");

    expect(el).toHaveClass("bg-surface-2");
    expect(el).toHaveClass("text-muted");
    expect(el).not.toHaveClass("bg-at-risk-bg");
  });
});
