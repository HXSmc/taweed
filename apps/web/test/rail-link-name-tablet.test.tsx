// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test (axe:link-name finding, /en/recovery and /ar/recovery —
// shared left rail nav, every authenticated page, all locale/theme combos,
// viewport-width-driven not locale/theme-driven): below the `lg` (1024px)
// breakpoint each nav Link's only children were an `aria-hidden` icon and a
// label `<span className="hidden lg:inline">`. Tailwind's `hidden` compiles
// to `display: none`, which removes the text from the accessibility tree
// entirely (not just visually) — so every module link had zero accessible
// name at tablet width (e.g. 768px, an explicitly required test width).
// JSDOM does not apply CSS, so an accessible-name query alone would pass
// even with the regression present; this test instead asserts on the
// underlying classes so a revert back to `hidden lg:inline` fails here even
// without a real layout engine. Fix: `sr-only lg:not-sr-only lg:inline` —
// the same visually-hidden-but-AT-visible pattern already used by
// `components/shell/skip-link.tsx` — keeps the name in the a11y tree at
// every width while still hiding it visually below `lg`.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: React.ComponentProps<"a">) => <a {...rest}>{children}</a>,
  usePathname: () => "/analytics",
}));

import { Rail } from "@/components/shell/rail";

describe("Rail — module link accessible name below the lg breakpoint", () => {
  it("keeps each label visually-hidden (sr-only) instead of display:none (hidden)", () => {
    // Routed through a variable: eslint-plugin-jsx-a11y's aria-role rule
    // flags a literal role="rcm" as an invalid ARIA role, unable to tell this
    // is Rail's business "role" prop, not a DOM ARIA attribute.
    const testRole = "rcm";
    render(<Rail role={testRole} />);

    const overviewLink = screen.getByRole("link", { name: /overview/i });
    const label = overviewLink.querySelector("span:last-child");

    expect(label).not.toBeNull();
    // `hidden` == display:none == removed from the accessibility tree.
    expect(label).not.toHaveClass("hidden");
    // `sr-only` keeps it in the accessibility tree; `lg:not-sr-only lg:inline`
    // restores the visual label at the `lg` breakpoint.
    expect(label).toHaveClass("sr-only");
    expect(label).toHaveClass("lg:not-sr-only");
    expect(label).toHaveClass("lg:inline");
  });

  it("gives every module link a non-empty accessible name", () => {
    // Routed through a variable: eslint-plugin-jsx-a11y's aria-role rule
    // flags a literal role="rcm" as an invalid ARIA role, unable to tell this
    // is Rail's business "role" prop, not a DOM ARIA attribute.
    const testRole = "rcm";
    render(<Rail role={testRole} />);

    // navModules(role) drives which links render; assert generically over
    // whatever the rail actually renders for this role rather than hardcoding
    // the full module list (keeps the test robust to RBAC changes).
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAccessibleName();
    }
  });
});
