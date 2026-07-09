// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ScrubRow } from "@/lib/data";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";

// Accessibility regression test (WCAG 1.3.1 finding): the table rows used to
// carry `role="button"` + `tabIndex={0}`, which overrode the native
// table-row semantics and stripped the row/cell relationship assistive tech
// relies on for table navigation (NVDA/JAWS "next row"/"next cell", rotor
// table view). Keyboard operability was never broken (Tab still reached the
// row, Enter/Space still opened the detail sheet) — the row just stopped
// exposing itself as a row with cells.
//
// The fix restores native <tr>/<td> semantics (no role/tabIndex override) and
// moves the interactive affordance to a real <button> nested in the Claim
// cell, matching the pattern already used elsewhere in this codebase
// (EobReviewQueue's per-row "Review" button).
//
// Follow-up regression test (WCAG 2.1.1 finding: manual-visual, all
// locales/themes): the <tr> itself still carried a mouse-only
// `onClick={() => setSelected(r)}` plus `className="cursor-pointer"`, with no
// `tabIndex`, `role="button"`, or `onKeyDown` — a keyboard/screen-reader user
// had no way to activate the row directly (they had to find the nested
// claim-ID button instead). Making the row itself keyboard-operable would
// require either duplicating a second focusable control for the same action
// (re-introducing the extra-tab-stop problem the roving-tabindex fix in
// appeals-composer.tsx was written to avoid) or `role="button"` on the <tr>,
// which destroys the row/cell semantics this very suite exists to protect.
// Fixed instead by deleting the row-level `onClick`/`cursor-pointer` — the
// nested claim-ID button (already `.focus-ring`, already aria-labeled) is the
// row's one and only control, so the visual affordance now matches what's
// actually operable by every input method.

// FlagExplainer (rendered inside the detail sheet) pulls in a server action
// that transitively imports next-auth session/RBAC wiring — irrelevant to
// this row/cell semantics test and heavy to load under vitest. Stub it the
// same way eob-review-queue.test.tsx stubs its own server actions.
vi.mock("@/lib/actions/explain-flag", () => ({
  explainFlagAction: vi.fn(),
}));

import { ScrubberTable } from "@/components/modules/scrubber-table";

function makeRow(claimId: string, riskScore: number): ScrubRow {
  return {
    claimId,
    nphiesClaimId: claimId,
    patientLabel: `Patient for ${claimId}`,
    payerName: "Tawuniya",
    sbsCodes: ["SBS-0001"],
    amount: "1000.00",
    result: {
      claimId,
      riskScore,
      flags: [
        {
          ruleId: "R-TEST-01",
          ruleName: "Test rule",
          field: "hasPreAuth",
          severity: "high",
          message_en: "Missing prior authorization.",
          message_ar: "لا يوجد تفويض مسبق.",
        },
      ],
      unevaluable: [],
    },
    ruleVersions: { "R-TEST-01": 1 },
  };
}

function renderTable(rows: ScrubRow[], locale = "en", messages = enMessages) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ scrubber: messages.scrubber, common: messages.common }}
    >
      <ScrubberTable rows={rows} />
    </NextIntlClientProvider>,
  );
}

describe("ScrubberTable — row/cell semantics (WCAG 1.3.1)", () => {
  // This suite's setup does not enable Vitest's `globals`, so RTL's automatic
  // afterEach cleanup isn't wired up — without it, each render() leaves its
  // tree mounted and later tests see duplicate elements from earlier tests.
  afterEach(cleanup);

  it("exposes each claim as a native table row with its column cells, not a generic button", () => {
    const rows = [makeRow("claim-1", 100), makeRow("claim-2", 45)];
    renderTable(rows);

    // Header row + one row per claim — native "row" role must survive, which
    // it only does if nothing overrides it with role="button".
    const tableRows = screen.getAllByRole("row");
    expect(tableRows).toHaveLength(rows.length + 1);

    const dataRows = tableRows.slice(1);
    dataRows.forEach((row) => {
      expect(row.tagName).toBe("TR");
      expect(row).not.toHaveAttribute("role");
      expect(row).not.toHaveAttribute("tabindex");
      // Risk / Claim / Patient / Payer / Codes / Amount.
      expect(within(row).getAllByRole("cell")).toHaveLength(6);
    });
  });

  it("carries keyboard/AT operability on a real nested button, not the row", () => {
    const rows = [makeRow("claim-1", 100)];
    renderTable(rows);

    const button = screen.getByRole("button", {
      name: "Claim claim-1, risk 100",
    });
    expect(button.tagName).toBe("BUTTON");

    // The row itself must not double as the interactive control.
    const row = button.closest("tr");
    expect(row).not.toHaveAttribute("role");
    expect(row).not.toHaveAttribute("tabindex");
  });

  it("does not treat the row itself as clickable — only the nested claim-ID button opens the detail sheet", async () => {
    const user = userEvent.setup();
    const rows = [makeRow("claim-1", 100)];
    renderTable(rows);

    const button = screen.getByRole("button", {
      name: "Claim claim-1, risk 100",
    });
    const row = button.closest("tr")!;

    expect(row.className).not.toMatch(/cursor-pointer/);

    // Clicking a cell that is not the button (e.g. the Patient cell) must not
    // open the sheet — the row carries no click handler of its own, so a
    // mouse-only affordance can no longer imply the whole row is a control.
    const patientCell = within(row).getByText("Patient for claim-1");
    await user.click(patientCell);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // The nested button remains the single, fully accessible control.
    await user.click(button);
    expect(
      await screen.findByRole("dialog", { name: enMessages.scrubber.detailTitle }),
    ).toBeInTheDocument();
  });

  it("opens the detail sheet when the row's button is activated via keyboard", async () => {
    const user = userEvent.setup();
    const rows = [makeRow("claim-1", 100)];
    renderTable(rows);

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Claim claim-1, risk 100" }),
    ).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("dialog", { name: enMessages.scrubber.detailTitle }),
    ).toBeInTheDocument();
  });

  // Accessibility regression test (WCAG 4.1.2 finding: manual-visual/button-name).
  // SheetContent's close control (apps/web/components/ui/sheet.tsx) wraps a
  // bare lucide <X> icon with no aria-label and no visually-hidden text, so a
  // screen-reader user tabbing to it heard only "button" with no indication
  // of what it does. axe's closed-sheet scans never caught this because
  // Radix portals SheetContent and it only mounts once the sheet is opened.
  it("gives the detail sheet's icon-only close button an accessible name", async () => {
    const user = userEvent.setup();
    const rows = [makeRow("claim-1", 100)];
    renderTable(rows);

    await user.click(
      screen.getByRole("button", { name: "Claim claim-1, risk 100" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: enMessages.scrubber.detailTitle,
    });

    expect(
      within(dialog).getByRole("button", { name: enMessages.common.close }),
    ).toBeInTheDocument();
  });
});

// Accessibility regression test (WCAG 3.1.2 finding: manual-visual, /ar/scrubber).
// The row button's aria-label used to be a hardcoded English template
// (`Claim ${id}, risk ${score}`), so every row in the Arabic UI announced an
// abrupt English fragment even though every other string on the page (and
// even the sibling "risk"/"claimId" column-header keys) was translated. The
// fix routes the label through next-intl's `scrubber.rowAriaLabel`, which has
// an Arabic translation, so the announced name matches the active locale.
describe("ScrubberTable — row button aria-label locale (WCAG 3.1.2)", () => {
  afterEach(cleanup);

  it("announces the claim row in Arabic when the UI locale is Arabic", () => {
    const rows = [makeRow("claim-1", 100)];
    renderTable(rows, "ar", arMessages);

    expect(
      screen.getByRole("button", { name: "المطالبة claim-1، الخطورة 100" }),
    ).toBeInTheDocument();

    // No leftover English template fragments should be announced.
    expect(
      screen.queryByRole("button", { name: /^Claim /i }),
    ).not.toBeInTheDocument();
  });

  it("still announces the claim row in English when the UI locale is English", () => {
    const rows = [makeRow("claim-1", 100)];
    renderTable(rows, "en", enMessages);

    expect(
      screen.getByRole("button", { name: "Claim claim-1, risk 100" }),
    ).toBeInTheDocument();
  });
});
