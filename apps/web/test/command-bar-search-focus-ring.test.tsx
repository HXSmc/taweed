// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test (manual-visual finding, /en/overview (and every route —
// CommandBar is shared shell chrome), en-light + en-dark, same source renders
// identically for ar): the global search <input> used a hand-rolled Tailwind
// focus ring (`focus-visible:border-accent focus-visible:outline-none
// focus-visible:ring-2 focus-visible:ring-accent`) instead of the shared
// `.focus-ring` utility (app/globals.css) that every other focusable control
// in the shell uses (all 8 rail.tsx nav links, tenant-switcher, locale/theme
// toggles, account menu). That produced a flat single ring with no halo,
// breaking the otherwise-consistent tab sequence for this one control. Fixed
// by swapping the inline classes for the shared `focus-ring` utility class —
// same pattern as the login demo-account button fix
// (login-demo-button-focus-ring.test.tsx).

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
// Isolate CommandBar's own markup: its sibling children (tenant switcher,
// locale/theme toggles, role chip, account menu) have their own i18n/routing/
// dropdown dependencies that are irrelevant to this finding.
vi.mock("@/components/shell/money-indicator", () => ({
  MoneyIndicator: () => null,
}));
vi.mock("@/components/shell/tenant-switcher", () => ({
  TenantSwitcher: () => null,
}));
vi.mock("@/components/shell/locale-toggle", () => ({
  LocaleToggle: () => null,
}));
vi.mock("@/components/shell/theme-toggle", () => ({
  ThemeToggle: () => null,
}));
vi.mock("@/components/shell/role-chip", () => ({
  RoleChip: () => null,
}));
vi.mock("@/components/shell/account-menu", () => ({
  AccountMenu: () => null,
}));

import { CommandBar } from "@/components/shell/command-bar";

describe("CommandBar — global search input focus ring", () => {
  it("uses the shared .focus-ring utility instead of a hand-rolled ring-accent focus style", () => {
    // Routed through a variable, not a literal: eslint-plugin-jsx-a11y's
    // aria-role rule can't distinguish this component's business "role" prop
    // (owner/rcm/etc) from a real DOM ARIA role attribute when given a
    // literal string, and flags it as an invalid ARIA role.
    const testRole = "owner";
    render(
      <CommandBar
        tenantName="Acme Health"
        role={testRole}
        email="owner@acme.test"
        recovered={0}
        atRisk={0}
        scopeLabel="All branches"
        branches={[]}
      />,
    );

    const searchInput = screen.getByRole("searchbox", { name: "search" });
    expect(searchInput).toHaveClass("focus-ring");
    expect(searchInput.className).not.toMatch(/focus-visible:ring-accent/);
    expect(searchInput.className).not.toMatch(/focus-visible:outline-none/);
    expect(searchInput.className).not.toMatch(/focus-visible:border-accent/);
  });
});
