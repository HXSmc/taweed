// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Regression test for a CONFIRMED WCAG AA finding (4.1.2 Name, Role, Value —
// axe rule button-name) on the claim-detail Sheet (opened by clicking any
// scrubber row, /en/scrubber and /ar/scrubber, all themes): the close button
// at apps/web/components/ui/sheet.tsx was `<DialogPrimitive.Close>` wrapping
// only a bare `<X>` icon (lucide's X renders as an SVG with no <title>) — no
// aria-label, no visually-hidden text. A screen-reader user tabbing to it
// heard only "button" with no indication it closes the panel. Not caught by
// automated axe scans because SheetContent is Radix-portal-rendered and only
// mounts when the sheet is open; scans ran against the closed-sheet state.
//
// Fixed by adding a `closeLabel` prop (default "Close") passed as
// `aria-label` on `DialogPrimitive.Close`, plus `aria-hidden="true"` on the
// decorative `<X>` icon so the label isn't duplicated/overridden. Callers
// (e.g. scrubber-table.tsx) pass the localized `common.close` string so the
// name is correct in both EN and AR.
import { Sheet, SheetContent } from "@/components/ui/sheet";

afterEach(() => {
  cleanup();
});

describe("SheetContent close button — accessible name", () => {
  it("exposes an accessible name via the default closeLabel", () => {
    render(
      <Sheet open>
        <SheetContent title="Claim #1234">Detail content</SheetContent>
      </Sheet>,
    );

    expect(
      screen.getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
  });

  it("uses a caller-supplied closeLabel (e.g. localized AR string)", () => {
    render(
      <Sheet open>
        <SheetContent title="مطالبة #1234" closeLabel="إغلاق">
          Detail content
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole("button", { name: "إغلاق" })).toBeInTheDocument();
  });

  it("hides the decorative X icon from assistive tech (no duplicate/blank name)", () => {
    render(
      <Sheet open>
        <SheetContent title="Claim #1234">Detail content</SheetContent>
      </Sheet>,
    );

    const closeButton = screen.getByRole("button", { name: "Close" });
    const icon = closeButton.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
