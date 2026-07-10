// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EobExtraction } from "@taweed/ai";
import { EobExtractionForm } from "@/components/modules/eob-review/eob-extraction-form";
import enMessages from "@/messages/en.json";

// AI-4 review form — regression test for the reseed-on-rerender bug
// (docs/review.md finding): the local edit state used to be re-seeded by a
// `useEffect` keyed on the `extraction` OBJECT REFERENCE
// (`useEffect(() => setEdited(toEditedInput(extraction)), [extraction])`).
// The parent (EobReviewQueue) mounts this form with `key={selected.id}`, so a
// genuinely new row selection remounts the component and the lazy
// `useState(() => toEditedInput(extraction))` initializer re-seeds correctly
// on its own — the effect was never needed for that case. But because the
// effect keyed on referential identity rather than a stable row id, ANY
// re-render that handed this still-mounted component a fresh (but logically
// identical) `extraction` object — e.g. a future `rows` revalidation while
// the reviewer's form stayed open — would silently wipe every in-progress
// edit, with no warning. This test rerenders the SAME mounted instance with a
// deep-equal-but-different-reference `extraction` and asserts an in-progress
// edit survives.

function makeExtraction(payerName: string): EobExtraction {
  return {
    payerName,
    payerNphiesId: "NPHIES-1",
    remittanceDate: "2026-07-01",
    remittanceTotalPaidHalalas: 10_000,
    overallConfidence: 0.9,
    claims: [
      {
        claimId: "claim-1",
        nphiesClaimId: null,
        patientRef: null,
        serviceDate: null,
        confidence: 0.9,
        totalBilledHalalas: 10_000,
        totalPaidHalalas: 10_000,
        totalRejectedHalalas: 0,
        totalAdjustmentHalalas: 0,
        lines: [
          {
            claimLineRef: "1",
            sbsCode: null,
            icd10amCode: null,
            billedHalalas: 10_000,
            paidHalalas: 10_000,
            patientShareHalalas: 0,
            rejectedHalalas: 0,
            adjustmentHalalas: 0,
            denialCode: null,
            confidence: 0.9,
          },
        ],
      },
    ],
  };
}

function renderForm(extraction: EobExtraction) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ reviewQueue: enMessages.reviewQueue }}>
      <EobExtractionForm
        extraction={extraction}
        sourceFilename="remit.pdf"
        escalated={false}
        validatorReport={null}
        onApprove={() => {}}
        onReject={() => {}}
        pending={false}
      />
    </NextIntlClientProvider>,
  );
}

// This suite's setup does not register RTL's afterEach auto-cleanup (see
// ingest-panel-contrast-and-i18n.test.tsx's note on the same convention), so
// each test's DOM must be torn down explicitly or the next render()'s
// queries see the previous test's leftover markup too.
afterEach(cleanup);

describe("EobExtractionForm — page-preview source filename contrast", () => {
  // Regression test for a CONFIRMED WCAG AA finding: the source-filename
  // caption in the page-preview placeholder card used `text-faint`
  // (3.42:1 light / 3.68:1 dark), below the 4.5:1 normal-text AA minimum.
  // Fixed by switching to `text-muted`, the same token swap already applied
  // for the identical finding type in ingest-panel.tsx and landing.tsx.
  it("renders the source filename with an AA-contrast token, never text-faint", () => {
    renderForm(makeExtraction("Original Payer"));

    const filename = screen.getByText("remit.pdf");
    expect(filename).toHaveClass("text-muted");
    expect(filename).not.toHaveClass("text-faint");
  });
});

function makeExtractionWithTwoLines(): EobExtraction {
  const base = makeExtraction("Original Payer");
  const line = base.claims[0].lines[0];
  return {
    ...base,
    claims: [
      {
        ...base.claims[0],
        lines: [
          { ...line, claimLineRef: "1", sbsCode: null },
          { ...line, claimLineRef: "2", sbsCode: "99213" },
        ],
      },
    ],
  };
}

describe("EobExtractionForm — per-claim-line accessible names", () => {
  // Regression test for a CONFIRMED WCAG AA finding (4.1.2 Name, Role, Value):
  // every editable control in a claim-line row (claimLineRef, sbsCode,
  // icd10amCode, the four money fields, and the denial-code <select>) had no
  // accessible name — the column header text lived once in a <TH>, not
  // associated with any single row's controls, and the denial-code <select>'s
  // <label> was a DOM sibling rather than a wrapping parent (no real
  // label/control association). Fixed by giving TextField/MoneyField their
  // own wrapping <label> (visually hidden text, same string as the column
  // header) and wrapping the <select> in a real <label> too.
  it("gives every per-line text/money field and the denial-code select an accessible name", () => {
    renderForm(makeExtractionWithTwoLines());

    const lineRefInputs = screen.getAllByLabelText(enMessages.reviewQueue.lineRef);
    const sbsInputs = screen.getAllByLabelText(enMessages.reviewQueue.sbsCode);
    const icdInputs = screen.getAllByLabelText(enMessages.reviewQueue.icd10amCode);
    const billedInputs = screen.getAllByLabelText(enMessages.reviewQueue.billed);
    const paidInputs = screen.getAllByLabelText(enMessages.reviewQueue.paid);
    const patientShareInputs = screen.getAllByLabelText(
      enMessages.reviewQueue.patientShare,
    );
    const rejectedInputs = screen.getAllByLabelText(enMessages.reviewQueue.rejected);
    const adjustmentInputs = screen.getAllByLabelText(enMessages.reviewQueue.adjustment);
    const denialSelects = screen.getAllByLabelText(enMessages.reviewQueue.denialCode);

    // One labeled control per line (2 lines seeded above).
    for (const inputs of [
      lineRefInputs,
      sbsInputs,
      icdInputs,
      billedInputs,
      paidInputs,
      patientShareInputs,
      rejectedInputs,
      adjustmentInputs,
      denialSelects,
    ]) {
      expect(inputs).toHaveLength(2);
    }

    // Each labeled control is genuinely the per-row input, not a decoy —
    // editing the second row's SBS-code field only changes that field.
    const secondSbsInput = sbsInputs[1] as HTMLInputElement;
    expect(secondSbsInput.value).toBe("99213");
    fireEvent.change(secondSbsInput, { target: { value: "99214" } });
    expect(secondSbsInput.value).toBe("99214");
    expect((sbsInputs[0] as HTMLInputElement).value).toBe("");
  });
});

describe("EobExtractionForm — Review tab heading order", () => {
  // Regression test for a CONFIRMED best-practice/heading-order finding
  // (docs/review.md): the page's only h1/h2 come from PageHeader and
  // EobReviewQueue's own section headings (it has none), so this form's own
  // headings are the only ones inside the Review tab's content once a row is
  // selected. They used to jump straight to h3 (remittanceHeading) then h4
  // (claimHeading) with no h2 in between — a level skip a screen-reader
  // user navigating by heading level (NVDA/JAWS "H" key) would see as a
  // broken outline. Fixed by making remittanceHeading (and
  // validatorFindingsHeading, a same-level sibling section) h2, and
  // claimHeading — one level under the remittance section — h3.
  it("renders remittanceHeading as h2 and claimHeading as h3, with no skipped level", () => {
    renderForm(makeExtraction("Original Payer"));

    const remittanceHeading = screen.getByRole("heading", {
      level: 2,
      name: enMessages.reviewQueue.remittanceHeading,
    });
    expect(remittanceHeading).toBeInTheDocument();

    const claimHeading = screen.getByRole("heading", {
      level: 3,
      name: "Claim 1",
    });
    expect(claimHeading).toBeInTheDocument();

    // No h4 (or deeper) anywhere in the form now that claimHeading moved to h3.
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
  });

  it("renders validatorFindingsHeading as h2 too, so a findings-present row never puts an h3 before the form's first h2", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ reviewQueue: enMessages.reviewQueue }}>
        <EobExtractionForm
          extraction={makeExtraction("Original Payer")}
          sourceFilename="remit.pdf"
          escalated={false}
          validatorReport={{
            findings: [{ check: "totals_match", passed: false, detail: "Totals disagree" }],
          }}
          onApprove={() => {}}
          onReject={() => {}}
          pending={false}
        />
      </NextIntlClientProvider>,
    );

    const headings = screen.getAllByRole("heading");
    // The findings card renders before the remittance Card in this component's
    // JSX, so it must be the SAME level (h2) as remittanceHeading — otherwise it
    // would be the first heading after the page's h1 and reintroduce a skip.
    expect(headings[0]).toHaveProperty("tagName", "H2");
    expect(headings[0]).toHaveTextContent(enMessages.reviewQueue.validatorFindingsHeading);
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
  });
});

// MONEY-PATH EXTRA-SCRUTINY REGRESSION — adversarial finding
// (eob-extraction-form.tsx): halalasToSarDisplay used to
// `Math.max(0, ...)`-clamp any negative halalas to "0.00" for ALL nine SAR
// fields it renders, including adjustmentSar — which, unlike the other four
// buckets, can legitimately be extracted as negative by a hallucinating
// model (see eob-validators.ts's nonNegativeAdjustmentFinding, added in this
// same fix pass). Clamping silently discarded the real extracted value from
// the reviewer's view instead of surfacing the anomaly this review surface
// exists to catch. Fixed by making the display conversion sign-aware,
// mirroring @taweed/analytics's own toSar.
describe("EobExtractionForm — negative adjustment display (money-path fix)", () => {
  it("shows the true negative adjustment amount instead of silently clamping it to 0.00", () => {
    const extraction = makeExtraction("Original Payer");
    // -200.00 SAR — a hallucinated negative write-off, per the eob-validators
    // adversarial finding this same fix pass addresses.
    extraction.claims[0].lines[0].adjustmentHalalas = -20000;
    renderForm(extraction);

    const adjustmentInput = screen.getByLabelText(
      enMessages.reviewQueue.adjustment,
    ) as HTMLInputElement;
    expect(adjustmentInput.value).toBe("-200.00");
    expect(adjustmentInput.value).not.toBe("0.00");
  });

  it("still displays ordinary non-negative amounts unchanged", () => {
    const extraction = makeExtraction("Original Payer");
    extraction.claims[0].totalAdjustmentHalalas = 12345;
    renderForm(extraction);

    const totalAdjustmentInput = screen.getByLabelText(
      enMessages.reviewQueue.totalAdjustment,
    ) as HTMLInputElement;
    expect(totalAdjustmentInput.value).toBe("123.45");
  });
});

describe("EobExtractionForm — reseed on rerender", () => {
  it("keeps an in-progress edit when the same row's extraction object is a fresh reference (no key change)", () => {
    // Arrange: mount with extraction A, then edit the payer name field.
    const extractionA = makeExtraction("Original Payer");
    const { rerender } = renderForm(extractionA);

    const payerNameInput = screen.getByLabelText(
      enMessages.reviewQueue.payerName,
    ) as HTMLInputElement;
    fireEvent.change(payerNameInput, { target: { value: "Corrected Payer" } });
    expect(payerNameInput.value).toBe("Corrected Payer");

    // Act: rerender the SAME mounted instance (no `key` change, matching the
    // parent's remount contract) with a brand-new `extraction` object that is
    // deep-equal to A but a different reference — the same-row-revalidation
    // scenario the bug report describes.
    const extractionB = makeExtraction("Original Payer");
    expect(extractionB).not.toBe(extractionA);
    rerender(
      <NextIntlClientProvider locale="en" messages={{ reviewQueue: enMessages.reviewQueue }}>
        <EobExtractionForm
          extraction={extractionB}
          sourceFilename="remit.pdf"
          escalated={false}
          validatorReport={null}
          onApprove={() => {}}
          onReject={() => {}}
          pending={false}
        />
      </NextIntlClientProvider>,
    );

    // Assert: the reviewer's in-progress edit must survive — a reference
    // change alone must never clobber it.
    const payerNameInputAfter = screen.getByLabelText(
      enMessages.reviewQueue.payerName,
    ) as HTMLInputElement;
    expect(payerNameInputAfter.value).toBe("Corrected Payer");
  });
});
