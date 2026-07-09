// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test for a CONFIRMED design-system-composition finding:
//
// landing.tsx imported MoneyFigure and the shell toggles but never imported
// `Button`. Its three CTA/sign-in links (header sign-in, hero CTA, action-
// section CTA) each hand-rolled the same `bg-accent ... hover:bg-accent-hover
// focus-visible:ring-2 ring-accent` class string — a third copy of Button's
// `primary` variant — plus the older ad-hoc `focus-visible:ring-2
// focus-visible:ring-accent(-offset-2)` idiom instead of the shared
// `.focus-ring` utility (button.tsx's cva base, design-brief §4.1/§4.5:
// 2px cobalt ring, no offset halo, 0.98 press-scale).
//
// Fixed by rendering all three as `<Button asChild><Link .../></Button>`, so
// they inherit the design system's variant, focus-ring, and press-scale
// treatment from one place instead of a third hand-rolled string.

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ((key: string) => key) as unknown),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: React.ComponentProps<"a">) => <a {...rest}>{children}</a>,
}));
vi.mock("@/components/shell/locale-toggle", () => ({
  LocaleToggle: () => null,
}));
vi.mock("@/components/shell/theme-toggle", () => ({
  ThemeToggle: () => null,
}));
vi.mock("@/components/money/money-figure", () => ({
  MoneyFigure: () => <div data-testid="money-figure" />,
}));

import { Landing } from "@/components/marketing/landing";

describe("Landing — CTA/sign-in links use the shared Button component", () => {
  it("renders the sign-in link and both CTA links via Button's design-system treatment", async () => {
    render(await Landing());

    const signIn = screen.getByRole("link", { name: "signIn" });
    const ctaLinks = screen.getAllByRole("link", { name: /^cta/ });
    expect(ctaLinks).toHaveLength(2);

    for (const link of [signIn, ...ctaLinks]) {
      // Button's cva base (`focus-ring`, `active:scale-[0.98]`) — proves the
      // element is rendered through Button's asChild Slot, not a hand-rolled
      // <Link> with its own duplicated class string.
      expect(link).toHaveClass("focus-ring");
      expect(link).toHaveClass("active:scale-[0.98]");

      // The pre-fix ad-hoc focus-ring idiom must not reappear alongside it.
      expect(link.className).not.toMatch(/focus-visible:ring-2/);
      expect(link.className).not.toMatch(/focus-visible:ring-offset-2/);
    }

    // The two primary CTAs additionally carry Button's `primary` variant
    // (bg-accent / hover:bg-accent-hover / text-accent-fg) from one shared
    // source instead of three copies.
    for (const link of ctaLinks) {
      expect(link).toHaveClass("bg-accent");
      expect(link).toHaveClass("hover:bg-accent-hover");
      expect(link).toHaveClass("text-accent-fg");
    }

    // The sign-in link uses the `ghost` variant, not a duplicated accent CTA.
    expect(signIn).not.toHaveClass("bg-accent");
  });
});
