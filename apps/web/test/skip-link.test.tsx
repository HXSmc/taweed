// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Regression test for a CONFIRMED WCAG AA finding (2.4.1 Bypass Blocks) on
// every (app) route (shared authenticated shell): a sighted keyboard-only
// user had no way to jump past the primary nav rail (7 module links) plus
// the command bar (search, locale toggle, theme toggle, role chip, account
// menu — ~12 stops) to reach page content. Fixed by rendering a "Skip to
// main content" link as the first focusable element in the shell
// (apps/web/app/[locale]/(app)/layout.tsx), pointing at the new
// `<main id="main-content" tabIndex={-1}>` landmark, visually hidden until
// it receives focus.

import { SkipLink } from "@/components/shell/skip-link";

afterEach(() => {
  cleanup();
});

describe("SkipLink", () => {
  it("renders an accessible link targeting #main-content", () => {
    // Arrange + Act
    render(<SkipLink label="Skip to main content" />);

    // Assert
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("is visually hidden by default and revealed on focus (bypass-blocks mechanism)", () => {
    // Arrange + Act
    render(<SkipLink label="Skip to main content" />);
    const link = screen.getByRole("link", { name: "Skip to main content" });

    // Assert: hidden off-screen until focused, so it doesn't shift layout
    // for users who don't need it, but is still in the tab order (not
    // display:none / removed).
    expect(link).toHaveClass("sr-only");
    expect(link).toHaveClass("focus:not-sr-only");
  });
});
