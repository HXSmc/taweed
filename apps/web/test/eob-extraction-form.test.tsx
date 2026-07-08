// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
        lines: [
          {
            claimLineRef: "1",
            sbsCode: null,
            icd10amCode: null,
            billedHalalas: 10_000,
            paidHalalas: 10_000,
            patientShareHalalas: 0,
            rejectedHalalas: 0,
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
