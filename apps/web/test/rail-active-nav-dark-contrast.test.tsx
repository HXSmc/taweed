// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test (axe:color-contrast finding, /en/analytics and /ar/analytics,
// dark theme): the active rail nav-link paired `bg-accent-subtle` with
// `text-accent`. `--accent-subtle` is retuned darker for `.dark`
// (app/globals.css) but `--accent` itself is intentionally locked across
// themes (design-brief §4.2), so the pairing dropped to ~2.64:1 in dark
// theme — under the WCAG AA 4.5:1 minimum for normal text (the active
// "Denial Analytics" label, 14px/font-medium). This asserts the active link
// also carries a `dark:` solid-fill override (`bg-accent` + `text-accent-fg`,
// ~5.9:1) — the same pairing already used for buttons, the brand mark, and
// the Badge `accent` variant's own dark override — and never regresses back
// to only the light-tuned `bg-accent-subtle`/`text-accent` pair.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: React.ComponentProps<"a">) => <a {...rest}>{children}</a>,
  usePathname: () => "/analytics",
}));

import { Rail } from "@/components/shell/rail";

describe("Rail — active nav-link dark-theme contrast", () => {
  // Single render (no `it`-per-assertion split): RTL's afterEach auto-cleanup
  // is not registered in this suite's setup, so a second `render()` in a
  // sibling `it` would double up the nav in the DOM.
  it("carries a dark: solid-fill override on the active link, but not on inactive links", () => {
    // Routed through a variable: eslint-plugin-jsx-a11y's aria-role rule
    // flags a literal role="rcm" as an invalid ARIA role, unable to tell this
    // is Rail's business "role" prop, not a DOM ARIA attribute.
    const testRole = "rcm";
    render(<Rail role={testRole} />);

    const activeLink = screen.getByRole("link", { name: /analytics/i });
    // Light theme pairing (AA in light, per the audit) stays present.
    expect(activeLink).toHaveClass("bg-accent-subtle");
    expect(activeLink).toHaveClass("text-accent");
    // Dark-theme override swaps to the solid accent fill so text-on-chip
    // contrast stays AA once `.dark` is active.
    expect(activeLink).toHaveClass("dark:bg-accent");
    expect(activeLink).toHaveClass("dark:text-accent-fg");

    const inactiveLink = screen.getByRole("link", { name: /overview/i });
    expect(inactiveLink).not.toHaveClass("text-accent");
    expect(inactiveLink).not.toHaveClass("dark:bg-accent");
  });
});
