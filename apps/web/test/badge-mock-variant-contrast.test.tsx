// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test (axe:color-contrast finding, /en/appeals composer-open
// state, light theme): `Badge variant="mock"` — used for the "Template not
// payer-specific" disclaimer and each AI-suggestion paragraph's "AI draft"
// label — paired `bg-surface-2` with `text-money-neutral` (~4.33:1 light,
// ~3.61:1 dark), both under the WCAG AA 4.5:1 minimum for normal text. Fixed
// by swapping to `text-muted` (>=6.1:1 in both themes), the same
// general-purpose caption-text token already used elsewhere for this
// contrast finding (see ingest-panel-contrast-and-i18n.test.tsx).

import { Badge } from "@/components/ui/badge";

describe("Badge — mock variant contrast", () => {
  it("renders via the AA-contrast text-muted token, never text-money-neutral", () => {
    render(<Badge variant="mock">Template not payer-specific</Badge>);
    const el = screen.getByText("Template not payer-specific");

    expect(el).toHaveClass("text-muted");
    expect(el).not.toHaveClass("text-money-neutral");
    // Background is unchanged — only the failing foreground token moved.
    expect(el).toHaveClass("bg-surface-2");
  });
});
