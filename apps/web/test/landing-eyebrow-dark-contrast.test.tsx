// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test (axe:color-contrast finding): the hero "eyebrow" line
// ("NPHIES-native denial recovery...") used `text-accent` unconditionally.
// `--accent` is locked to the same hex in both themes (design-brief §4.2), so
// it clears AA on the light `--bg` (~5.7:1) but drops to ~3.35:1 on the dark
// `--bg` (#0a0a0b) — below the 4.5:1 minimum for this 12.5px label. Confirmed
// reproducible via the real theme-toggle behavior (adding `.dark` to
// <html>), not just a scripted class add. Fixed by adding a `dark:`
// override to the existing `text-muted` token (~7.7:1 on dark `--bg`),
// already used elsewhere on this same page for supporting copy, instead of
// changing the locked `--accent` token globally (which remains correct for
// buttons/focus-ring/badges that composite it differently).

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
  MoneyFigure: () => null,
}));

import { Landing } from "@/components/marketing/landing";

describe("Landing — hero eyebrow dark-theme contrast", () => {
  it("pairs the locked accent color with a dark: override to an AA-safe token", async () => {
    // Arrange + Act: server component — render its resolved element tree.
    render(await Landing());

    // Assert: the eyebrow keeps its light-theme accent branding but carries a
    // `dark:text-muted` override so it never renders bare `--accent` text
    // directly on the dark `--bg` (the ~3.35:1 failure mode).
    const eyebrow = screen.getByText("eyebrow");
    expect(eyebrow).toHaveClass("text-accent");
    expect(eyebrow).toHaveClass("dark:text-muted");
  });
});
