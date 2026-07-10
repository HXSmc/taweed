import { describe, it, expect } from "vitest";
import {
  detectFieldMapping,
  applyMappingOverrides,
  CANONICAL_FIELDS,
} from "@taweed/ingest";

// EXECUTE B6 — field-mapping panel (design-brief §8.1): detected column -> model
// field with a confidence, and a manual override. The detection is pure so the UI
// can show suggestions the human confirms or corrects.

describe("detectFieldMapping", () => {
  it("maps obvious headers with high confidence", () => {
    const m = detectFieldMapping([
      "Claim ID",
      "Payer Name",
      "SBS Code",
      "Denied Amount",
      "Denial Reason",
    ]);
    const by = Object.fromEntries(m.map((s) => [s.field, s]));
    expect(by.claimId!.sourceColumn).toBe("Claim ID");
    expect(by.claimId!.confidence).toBeGreaterThan(0.9);
    expect(by.payerName!.sourceColumn).toBe("Payer Name");
    expect(by.sbsCode!.sourceColumn).toBe("SBS Code");
    expect(by.deniedAmount!.sourceColumn).toBe("Denied Amount");
    expect(by.reasonCode!.sourceColumn).toBe("Denial Reason");
  });

  it("returns a suggestion for every canonical field", () => {
    const m = detectFieldMapping(["Claim ID"]);
    expect(m).toHaveLength(CANONICAL_FIELDS.length);
  });

  it("leaves an unmatched field null with zero confidence", () => {
    const m = detectFieldMapping(["totally unrelated column"]);
    const claim = m.find((s) => s.field === "claimId")!;
    expect(claim.sourceColumn).toBeNull();
    expect(claim.confidence).toBe(0);
  });

  it("matches on synonyms and is case/spacing insensitive", () => {
    const m = detectFieldMapping(["rejection_reason", "member id", "amount"]);
    const by = Object.fromEntries(m.map((s) => [s.field, s]));
    expect(by.reasonCode!.sourceColumn).toBe("rejection_reason");
    expect(by.patientRef!.sourceColumn).toBe("member id");
    expect(by.totalAmount!.sourceColumn).toBe("amount");
  });

  it("does not map two fields to the same column", () => {
    const m = detectFieldMapping(["amount"]);
    const claimed = m.filter((s) => s.sourceColumn === "amount");
    expect(claimed).toHaveLength(1);
  });
});

describe("applyMappingOverrides", () => {
  it("forces a manual override to confidence 1 and clears any other field on that column", () => {
    const base = detectFieldMapping(["Claim ID", "col2"]);
    const overridden = applyMappingOverrides(base, { deniedAmount: "col2" });
    const denied = overridden.find((s) => s.field === "deniedAmount")!;
    expect(denied.sourceColumn).toBe("col2");
    expect(denied.confidence).toBe(1);
  });

  it("forces a field to no column when the override is explicitly null, ignoring its auto-detected suggestion", () => {
    // "Claim ID" auto-detects strongly for claimId — an explicit null
    // override must NOT silently fall back to that detected column. This is
    // the regression case: omitting a field means "keep auto-detected",
    // while an explicit null means "the reviewer deliberately cleared this".
    const base = detectFieldMapping(["Claim ID", "col2"]);
    expect(base.find((s) => s.field === "claimId")!.sourceColumn).toBe("Claim ID");

    const overridden = applyMappingOverrides(base, { claimId: null });
    const claim = overridden.find((s) => s.field === "claimId")!;
    expect(claim.sourceColumn).toBeNull();
    expect(claim.confidence).toBe(0);
  });

  it("does not treat a null override's column as claimed/unavailable to other fields", () => {
    const base = detectFieldMapping(["Claim ID", "col2"]);
    const overridden = applyMappingOverrides(base, { claimId: null, deniedAmount: "Claim ID" });
    const denied = overridden.find((s) => s.field === "deniedAmount")!;
    expect(denied.sourceColumn).toBe("Claim ID");
    expect(denied.confidence).toBe(1);
  });

  it("leaves a field unchanged (keeps its auto-detected suggestion) when it is absent from overrides", () => {
    const base = detectFieldMapping(["Claim ID", "col2"]);
    const overridden = applyMappingOverrides(base, { deniedAmount: "col2" });
    const claim = overridden.find((s) => s.field === "claimId")!;
    expect(claim.sourceColumn).toBe("Claim ID");
    expect(claim.confidence).toBeGreaterThan(0.9);
  });
});
