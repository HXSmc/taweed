// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression tests for two CONFIRMED WCAG AA findings on the landing page:
//
// 1. [axe:color-contrast] The 'illustrative figure' disclaimer caption under
//    the hero number used `text-faint` (3.3:1 light / 3.92:1 dark), below the
//    4.5:1 normal-text minimum. Fixed by switching to the `text-muted` token
//    (6.5:1 light / 7.7:1 dark) — same token already used one line above for
//    `heroSub`, so no new token was introduced.
//
// 2. [manual-visual / axe:page-has-heading-one] The landing page had no <h1>
//    anywhere in the DOM: the wordmark was a plain <span> and the hero copy
//    (heroLead / MoneyFigure / heroTrail) was three <p>/<div> siblings, so the
//    first heading in the outline was the <h2> for the "Interest" section.
//    Fixed by wrapping the hero headline (heroLead + money figure + heroTrail)
//    in a single <h1>, which is the page's actual primary heading per the
//    AIDA "Attention" design brief (the number is the hero).

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

describe("Landing — hero heading structure and disclaimer caption contrast", () => {
  it("renders one <h1> hero headline and an AA-contrast illustrative-figure caption", async () => {
    // Arrange + Act: server component — render its resolved element tree once
    // (a second render() in a sibling `it` would double up the DOM here, since
    // this suite's setup does not register RTL's afterEach auto-cleanup).
    render(await Landing());

    // Assert (finding 2): the page has a single top-level heading, and it is
    // the hero headline, not the "Interest" section's <h2>(interestTitle).
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("heroLead");
    expect(h1s[0]).toHaveTextContent("heroTrail");
    expect(h1s[0].querySelector('[data-testid="money-figure"]')).not.toBeNull();

    // Assert (finding 1): `illustrative` caption uses `text-muted` (>=4.5:1 in
    // both themes) and never regresses back onto `text-faint` (<4.5:1).
    const caption = screen.getByText("illustrative");
    expect(caption).toHaveClass("text-muted");
    expect(caption).not.toHaveClass("text-faint");
  });
});
