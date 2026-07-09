// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Regression test (axe:color-contrast finding, /en/scrubber and /ar/scrubber,
// dark theme): the row-detail Sheet in scrubber-table.tsx renders each flag's
// severity via `<Badge variant={f.severity === "high" ? "atRisk" : "neutral"}>`
// (scrubber-table.tsx around the flags list). The `atRisk` (and sibling
// `recovered`) Badge variants route through `--at-risk-text` /
// `--recovered-text`, which were defined only in `:root` (light theme) and
// never retuned inside app/globals.css's `.dark` override block — dark theme
// inherited the light hex values against dark surfaces, ~2.5:1 and ~3.15:1,
// both under the 4.5:1 AA minimum for normal text.
//
// The token-level fix and its own contrast-math regression test (against both
// --surface-1 and each token's own --*-bg, which is exactly what these Badge
// variants render on) live in app/globals.css and
// analytics-dark-money-token-contrast.test.ts (shared root cause — the same
// tokens also drive the command-bar MoneyIndicator figures and this Sheet's
// severity chip). This test guards the *component* contract at the level the
// Scrubber Sheet actually consumes: the `atRisk`/`recovered` Badge variants
// must keep routing through the `-bg`/`-text` design token pairs (never a
// hardcoded/inline color) so the CSS-level dark-mode fix keeps covering them.
// Neither variant has component-level coverage elsewhere: the Rail and Badge
// `accent`-variant regression tests only exercise the `accent` variant.

import { Badge } from "@/components/ui/badge";

describe("Badge — atRisk/recovered variants (Scrubber flag-severity chip) dark-theme contrast", () => {
  afterEach(cleanup);

  it("renders the atRisk variant via the --at-risk-bg/--at-risk-text token pair", () => {
    render(<Badge variant="atRisk">high</Badge>);
    const el = screen.getByText("high");

    expect(el).toHaveClass("bg-at-risk-bg");
    expect(el).toHaveClass("text-at-risk-text");
    // Regression guard: must never fall back to a hardcoded/inline color that
    // would bypass the `.dark` token override in app/globals.css.
    expect(el).not.toHaveAttribute("style", expect.stringContaining("color"));
  });

  it("renders the recovered variant via the --recovered-bg/--recovered-text token pair", () => {
    render(<Badge variant="recovered">recovered</Badge>);
    const el = screen.getByText("recovered");

    expect(el).toHaveClass("bg-recovered-bg");
    expect(el).toHaveClass("text-recovered-text");
    expect(el).not.toHaveAttribute("style", expect.stringContaining("color"));
  });
});
