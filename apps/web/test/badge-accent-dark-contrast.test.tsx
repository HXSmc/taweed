// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test (axe:color-contrast finding): `Badge variant="accent"`
// (the role chip on every /login demo-account row) paired `bg-accent-subtle`
// with `text-accent`. `--accent-subtle` is retuned darker for `.dark`
// (app/globals.css) but `--accent` itself is not, so the pairing dropped to
// ~2.64:1 in dark theme — well under the WCAG AA 4.5:1 minimum for normal
// text (axe flagged all 10 demo-account rows in both EN-dark and AR-dark).
// This asserts the accent variant also carries the `dark:` solid-fill
// pairing (`bg-accent` + `text-accent-fg`, ~5.9:1 AA — the same pairing
// already used for buttons and the brand mark) and never regresses back to
// only the light-tuned `bg-accent-subtle`/`text-accent` pair.

import { Badge } from "@/components/ui/badge";

describe("Badge — accent variant dark-theme contrast", () => {
  it("carries a dark: solid-fill override alongside the light accent-subtle pairing", () => {
    render(<Badge variant="accent">RCM</Badge>);
    const el = screen.getByText("RCM");

    // Light theme pairing (AA in light, per the audit) stays present.
    expect(el).toHaveClass("bg-accent-subtle");
    expect(el).toHaveClass("text-accent");

    // Dark-theme override swaps to the solid accent fill so text-on-chip
    // contrast stays AA once `.dark` is active.
    expect(el).toHaveClass("dark:bg-accent");
    expect(el).toHaveClass("dark:text-accent-fg");
  });
});
