// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import type { MappingSuggestion } from "@taweed/ingest";

// EXECUTE B6 — CsvMappingPanel: one row per detected canonical field, a
// confidence indicator that never encodes meaning by color alone, and an
// override Select per row with a real accessible label tied to that row.
// Changing a row's Select updates local state only; onConfirm fires ONLY on
// the explicit Confirm click (no auto-proceed on high confidence).

// Radix Select renders its listbox through a Portal and relies on pointer
// capture APIs jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture =
    Element.prototype.releasePointerCapture ?? (() => undefined);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => undefined);
});

const HEADERS = ["Claim ID", "Total Amount", "Denial Reason"];

const SUGGESTIONS: MappingSuggestion[] = [
  { field: "claimId", sourceColumn: "Claim ID", confidence: 1 },
  { field: "nphiesClaimId", sourceColumn: null, confidence: 0 },
  { field: "payerName", sourceColumn: null, confidence: 0 },
  { field: "branchName", sourceColumn: null, confidence: 0 },
  { field: "providerName", sourceColumn: null, confidence: 0 },
  { field: "patientRef", sourceColumn: null, confidence: 0 },
  { field: "sbsCode", sourceColumn: null, confidence: 0 },
  { field: "icd10amCode", sourceColumn: null, confidence: 0 },
  { field: "serviceDate", sourceColumn: null, confidence: 0 },
  { field: "totalAmount", sourceColumn: "Total Amount", confidence: 0.92 },
  { field: "deniedAmount", sourceColumn: null, confidence: 0 },
  { field: "reasonCode", sourceColumn: "Denial Reason", confidence: 0.55 },
  { field: "reasonText", sourceColumn: null, confidence: 0 },
];

vi.mock("@/components/modules/eob-review/confidence-badge", () => ({
  ConfidenceBadge: ({ value }: { value: number }) => (
    <span data-testid="confidence">{Math.round(value * 100)}%</span>
  ),
}));

import { CsvMappingPanel } from "@/components/modules/csv-mapping-panel";

function renderPanel(
  props: Partial<Pick<React.ComponentProps<typeof CsvMappingPanel>, "pending" | "rowCount">> = {},
  locale: "en" | "ar" = "en",
) {
  const messages = locale === "en" ? enMessages : arMessages;
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <NextIntlClientProvider locale={locale} messages={{ ingest: messages.ingest }}>
      <CsvMappingPanel
        headers={HEADERS}
        suggestions={SUGGESTIONS}
        rowCount={2}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { ...utils, onConfirm, onCancel };
}

describe("CsvMappingPanel — rendering", () => {
  afterEach(cleanup);

  it("renders one row per canonical field with its translated label", () => {
    renderPanel();
    expect(screen.getByTestId("field-label-claimId")).toHaveTextContent(
      enMessages.ingest.csvMapping.fields.claimId,
    );
    expect(screen.getByTestId("field-label-totalAmount")).toHaveTextContent(
      enMessages.ingest.csvMapping.fields.totalAmount,
    );
    expect(screen.getByTestId("field-label-reasonText")).toHaveTextContent(
      enMessages.ingest.csvMapping.fields.reasonText,
    );
    expect(screen.getAllByRole("row")).toHaveLength(SUGGESTIONS.length + 1); // + header row
  });

  it("shows the detected source column, or a no-match indicator when unmapped", () => {
    renderPanel();
    expect(screen.getByTestId("source-column-totalAmount")).toHaveTextContent("Total Amount");
    expect(screen.getByTestId("source-column-nphiesClaimId")).toHaveTextContent(
      enMessages.ingest.csvMapping.noMatch,
    );
  });

  it("pairs the confidence indicator with a number, not color alone", () => {
    renderPanel();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("55%")).toBeInTheDocument();
  });

  it("gives every override Select a real accessible label naming its canonical field", () => {
    renderPanel();
    const totalAmountLabel = enMessages.ingest.csvMapping.overrideLabel.replace(
      "{field}",
      enMessages.ingest.csvMapping.fields.totalAmount,
    );
    expect(screen.getByRole("combobox", { name: totalAmountLabel })).toBeInTheDocument();
  });

  it("renders in Arabic with real translated labels (RTL locale)", () => {
    renderPanel({}, "ar");
    expect(
      screen.getByText(arMessages.ingest.csvMapping.fields.claimId),
    ).toBeInTheDocument();
    expect(screen.getByText(arMessages.ingest.csvMapping.title)).toBeInTheDocument();
  });

  it("announces the row count via a status live region (wires the rowsDetected i18n key)", () => {
    renderPanel({ rowCount: 7 });
    const status = screen.getByText(
      enMessages.ingest.csvMapping.rowsDetected.replace("{n}", "7"),
    );
    expect(status).toHaveAttribute("role", "status");
  });

  it("moves focus to its own heading on mount, so a screen-reader/keyboard user is not left on the dropzone", () => {
    renderPanel();
    const heading = screen.getByRole("heading", { name: enMessages.ingest.csvMapping.title });
    expect(heading).toHaveFocus();
  });
});

describe("CsvMappingPanel — override + confirm/cancel", () => {
  afterEach(cleanup);

  it("does not call onConfirm when a row's Select changes — only local state updates", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPanel();

    const totalAmountLabel = enMessages.ingest.csvMapping.overrideLabel.replace(
      "{field}",
      enMessages.ingest.csvMapping.fields.totalAmount,
    );
    const trigger = screen.getByRole("combobox", { name: totalAmountLabel });
    await user.click(trigger);
    const option = await screen.findByRole("option", { name: "Claim ID" });
    await user.click(option);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm with the current mapping (auto-detected + overrides) on Confirm", async () => {
    const { onConfirm } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: enMessages.ingest.csvMapping.confirm }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: "Claim ID",
        totalAmount: "Total Amount",
        reasonCode: "Denial Reason",
      }),
    );
    const [overrides] = onConfirm.mock.calls[0] as [Record<string, string | null>];
    // An unmapped field is sent as an explicit null (never a bogus column,
    // and never simply omitted — omission would mean "keep whatever the
    // server auto-detects", which is a different thing from "unmapped").
    expect(overrides.nphiesClaimId).toBeNull();
  });

  it("sends an explicit null override — not an omission — when the operator manually clears a field that HAD an auto-detected mapping", async () => {
    // This is the commit-consistency regression: "claimId" auto-detects to
    // "Claim ID" with confidence 1. Clearing its Select to "— none —" must
    // produce an explicit null in the payload, never silently omit the
    // field (an omission would fall back to the wrong auto-detected column
    // being committed anyway — the exact bug this fixes).
    const user = userEvent.setup();
    const { onConfirm } = renderPanel();

    const claimIdLabel = enMessages.ingest.csvMapping.overrideLabel.replace(
      "{field}",
      enMessages.ingest.csvMapping.fields.claimId,
    );
    const trigger = screen.getByRole("combobox", { name: claimIdLabel });
    expect(trigger).toHaveTextContent("Claim ID");

    await user.click(trigger);
    const noneOption = await screen.findByRole("option", {
      name: enMessages.ingest.csvMapping.noneOption,
    });
    await user.click(noneOption);

    fireEvent.click(screen.getByRole("button", { name: enMessages.ingest.csvMapping.confirm }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [overrides] = onConfirm.mock.calls[0] as [Record<string, string | null>];
    expect(overrides.claimId).toBeNull();
    expect(overrides.claimId).not.toBe("Claim ID");
  });

  it("reflects a user override in the payload sent to onConfirm", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPanel();

    const denialLabel = enMessages.ingest.csvMapping.overrideLabel.replace(
      "{field}",
      enMessages.ingest.csvMapping.fields.deniedAmount,
    );
    const trigger = screen.getByRole("combobox", { name: denialLabel });
    await user.click(trigger);
    const option = await screen.findByRole("option", { name: "Total Amount" });
    await user.click(option);

    fireEvent.click(screen.getByRole("button", { name: enMessages.ingest.csvMapping.confirm }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ deniedAmount: "Total Amount" }),
    );
  });

  it("calls onCancel when Cancel is clicked, without calling onConfirm", () => {
    const { onCancel, onConfirm } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: enMessages.ingest.csvMapping.cancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables both buttons while pending", () => {
    renderPanel({ pending: true });
    expect(screen.getByRole("button", { name: enMessages.ingest.csvMapping.confirm })).toBeDisabled();
    expect(screen.getByRole("button", { name: enMessages.ingest.csvMapping.cancel })).toBeDisabled();
  });
});
