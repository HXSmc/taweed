// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test (manual-visual finding, /en/analytics and app-wide): every
// shell control (Button — backing ThemeToggle/LocaleToggle/AccountMenu
// trigger/TenantSwitcher trigger — and Rail's nav links) hand-rolled its own
// `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`
// instead of the single documented `.focus-ring` utility (app/globals.css,
// matching the `--focus-ring` token in docs/03_design_brief.md §4.2) that the
// rest of the app already standardizes on (e.g. components/modules/
// scrubber-table.tsx, the login demo-account button). Fixed by pointing each
// control at the shared `focus-ring` class so a future retune of the token
// propagates everywhere instead of leaving most of the shell stuck on a
// hand-copied duplicate.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: React.ComponentProps<"a">) => <a {...rest}>{children}</a>,
  usePathname: () => "/analytics",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/analytics",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/auth", () => ({
  signOutAction: vi.fn(),
}));

import { Button } from "@/components/ui/button";
import { Rail } from "@/components/shell/rail";
import { AccountMenu } from "@/components/shell/account-menu";
import { TenantSwitcher } from "@/components/shell/tenant-switcher";

function expectSharedFocusRing(el: HTMLElement) {
  expect(el).toHaveClass("focus-ring");
  expect(el.className).not.toMatch(/focus-visible:ring-2/);
  expect(el.className).not.toMatch(/focus-visible:ring-accent/);
  expect(el.className).not.toMatch(/focus-visible:outline-none/);
}

describe("Shell controls — shared .focus-ring utility", () => {
  it("Button applies the shared focus-ring instead of an inline ring-accent style", () => {
    render(<Button>Save</Button>);
    expectSharedFocusRing(screen.getByRole("button", { name: "Save" }));
  });

  it("Rail nav links apply the shared focus-ring", () => {
    // Routed through a variable: eslint-plugin-jsx-a11y's aria-role rule
    // flags a literal role="rcm" as an invalid ARIA role, unable to tell this
    // is Rail's business "role" prop, not a DOM ARIA attribute.
    const testRole = "rcm";
    render(<Rail role={testRole} />);
    expectSharedFocusRing(screen.getByRole("link", { name: /analytics/i }));
  });

  it("AccountMenu trigger applies the shared focus-ring", () => {
    render(<AccountMenu email="owner@acme.test" tenant="Acme Health" />);
    expectSharedFocusRing(screen.getByRole("button", { name: "owner@acme.test" }));
  });

  it("TenantSwitcher trigger applies the shared focus-ring", () => {
    render(<TenantSwitcher tenantName="Acme Health" branches={[]} />);
    expectSharedFocusRing(screen.getByRole("button", { name: /Acme Health/ }));
  });
});
