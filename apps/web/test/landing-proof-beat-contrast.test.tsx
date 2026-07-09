// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test (axe:color-contrast finding): the '01'/'02'/'03' step numbers
// in the three-beat "Interest" section used `text-hairline-strong` (the
// `--hairline-strong` divider token, meant for subtle borders) as real text
// color — 1.5:1 in light theme / 1.57:1 in dark theme, both far under the
// WCAG AA 3:1 minimum for large text. This asserts the step numbers render
// with a text-appropriate token (`text-muted`, >=3.4:1 against `--surface-1`
// in both themes) and never regress back onto a divider/border token.

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

describe("Landing — three-beat proof section step-number contrast", () => {
  it("renders '01'/'02'/'03' with a text color token, not the hairline divider token", async () => {
    // Arrange + Act: server component — render its resolved element tree.
    render(await Landing());

    // Assert: each step number uses a real text-color utility class and never
    // the divider/border token that caused the axe contrast failure.
    for (const n of ["01", "02", "03"]) {
      const el = screen.getByText(n);
      expect(el).toHaveClass("text-muted");
      expect(el).not.toHaveClass("text-hairline-strong");
    }
  });
});
