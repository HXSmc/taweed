import { describe, expect, it } from "vitest";
import { appealToPdfModel, generateAppeal } from "../src/index.js";
import type { AppealContext, PdfSegment } from "../src/index.js";

const AR_SCRIPT = /[؀-ۿ]/;
const CLAIM_ID = "550e8400-e29b-41d4-a716-446655440000";
const SBS_CODE = "83000-00";

function makeCtx(): AppealContext {
  return {
    claimId: CLAIM_ID,
    nphiesClaimId: "NPHIES-CLM-77",
    sbsCode: SBS_CODE,
    denialCode: "TWD-D03",
    denialCategory: "CARC",
    payerName: "Bupa Arabia",
    providerName: "Al Salama Medical Center",
    memberId: "MBR-100200",
    atRiskSar: "980.50",
    serviceDate: "2026-03-14",
  };
}

function flatten(blocks: PdfSegment[][]): PdfSegment[] {
  return blocks.flat();
}

describe("appealToPdfModel", () => {
  it("isolates Latin claim id and SBS code as ltr segments inside AR", () => {
    const ctx = makeCtx();
    const doc = appealToPdfModel(generateAppeal(ctx), ctx, "ar");

    expect(doc.locale).toBe("ar");
    const segs = flatten(doc.blocks);

    const ltrTexts = segs.filter((s) => s.dir === "ltr").map((s) => s.text);
    // Ids/codes appear as whole ltr tokens, never split across segments. The claim
    // reference is the payer-facing NPHIES id, never the internal DB UUID.
    expect(ltrTexts).toContain("NPHIES-CLM-77");
    expect(ltrTexts).not.toContain(CLAIM_ID);
    expect(ltrTexts).toContain(SBS_CODE);

    // Real Arabic prose is carried as rtl segments around the isolated ids.
    expect(segs.some((s) => s.dir === "rtl" && AR_SCRIPT.test(s.text))).toBe(
      true,
    );
  });

  it("emits an all-ltr model for EN", () => {
    const ctx = makeCtx();
    const doc = appealToPdfModel(generateAppeal(ctx), ctx, "en");

    expect(doc.locale).toBe("en");
    const segs = flatten(doc.blocks);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.every((s) => s.dir === "ltr")).toBe(true);
  });
});
