// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

// Regression test for docs/a11y.md #20 follow-up (Low): finding #20 swept the
// app-shell call sites (CommandBar, ForwardCard, login demo buttons, Button,
// Rail, AccountMenu) onto the shared `.focus-ring` utility, but left several
// shared UI primitives and module-level interactive elements still hand-
// rolling `focus-visible:outline-none focus-visible:ring-2
// focus-visible:ring-accent` (plus, for bordered fields,
// `focus-visible:border-accent`) — a visually different keyboard-focus
// indicator from the rest of the app. Fixed by pointing every remaining
// call site at `.focus-ring` (non-bordered controls) or the new
// `.focus-ring-field` (bordered inputs/textareas/selects that also swap
// border-color on focus — app/globals.css), so keyboard focus renders
// identically everywhere, not just at the already-migrated call sites.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/actions/author-rule", () => ({
  approveRuleAction: vi.fn(),
  rejectRuleAction: vi.fn(),
}));

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { RuleAuthoring } from "@/components/modules/rule-authoring";

function expectNoHandRolledRing(el: HTMLElement) {
  expect(el.className).not.toMatch(/focus-visible:ring-2/);
  expect(el.className).not.toMatch(/focus-visible:ring-accent/);
  expect(el.className).not.toMatch(/focus-visible:outline-none/);
  expect(el.className).not.toMatch(/focus-visible:border-accent/);
}

afterEach(cleanup);

describe("Input — shared .focus-ring-field utility", () => {
  it("applies focus-ring-field instead of a hand-rolled ring + border-accent", () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveClass("focus-ring-field");
    expectNoHandRolledRing(input);
  });
});

describe("Tabs — shared .focus-ring utility", () => {
  it("TabsTrigger and TabsContent apply focus-ring instead of a hand-rolled ring", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Tab A</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Panel A</TabsContent>
        </Tabs>
      </NextIntlClientProvider>,
    );

    const trigger = screen.getByRole("tab", { name: "Tab A" });
    expect(trigger).toHaveClass("focus-ring");
    expectNoHandRolledRing(trigger);

    const panel = screen.getByRole("tabpanel", { name: "Tab A" });
    expect(panel).toHaveClass("focus-ring");
    expectNoHandRolledRing(panel);
  });
});

describe("SheetContent close button — shared .focus-ring utility", () => {
  it("applies focus-ring instead of a hand-rolled ring", () => {
    render(
      <Sheet open>
        <SheetContent title="Claim #1234">Detail content</SheetContent>
      </Sheet>,
    );
    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toHaveClass("focus-ring");
    expectNoHandRolledRing(closeButton);
  });
});

describe("RuleAuthoring — shared .focus-ring / .focus-ring-field utilities", () => {
  it("gives the SME textarea, scope toggle, and payer select the shared utilities", async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={{ settings: enMessages.settings }}>
        <RuleAuthoring
          payers={[{ id: "p1", name: "MedGulf" }]}
          authoredRules={[]}
        />
      </NextIntlClientProvider>,
    );

    const textarea = screen.getByPlaceholderText(enMessages.settings.authorPlaceholder);
    expect(textarea).toHaveClass("focus-ring-field");
    expectNoHandRolledRing(textarea);

    const scopeToggle = screen.getByRole("button", {
      name: enMessages.settings.scopeGlobal,
    });
    expect(scopeToggle).toHaveClass("focus-ring");
    expectNoHandRolledRing(scopeToggle);

    await user.click(
      screen.getByRole("button", { name: enMessages.settings.scopePayer }),
    );

    const payerSelect = await screen.findByDisplayValue("MedGulf");
    expect(payerSelect).toHaveClass("focus-ring-field");
    expectNoHandRolledRing(payerSelect);
  });
});
