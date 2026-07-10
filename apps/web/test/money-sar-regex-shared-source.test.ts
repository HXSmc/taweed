import { describe, it, expect } from "vitest";
import { z } from "zod";
import { SAR_MONEY_REGEX } from "@/lib/money";

// Regression test: recovery.ts and eob-review.ts each defined their own
// `/^\d+(\.\d{1,2})?$/` SAR-amount regex inline instead of sharing one
// definition, so a future precision-rule change (e.g. allowing 3 decimals)
// would require editing both action files in lockstep and risk drift. Both
// now import SAR_MONEY_REGEX from lib/money.ts; this test locks the shared
// export's accept/reject behavior so it can't silently regress for either
// consumer.
describe("SAR_MONEY_REGEX", () => {
  it("accepts whole SAR amounts", () => {
    expect(SAR_MONEY_REGEX.test("120")).toBe(true);
    expect(SAR_MONEY_REGEX.test("0")).toBe(true);
  });

  it("accepts amounts with one or two fractional digits", () => {
    expect(SAR_MONEY_REGEX.test("120.5")).toBe(true);
    expect(SAR_MONEY_REGEX.test("120.50")).toBe(true);
  });

  it("rejects more than two fractional digits", () => {
    expect(SAR_MONEY_REGEX.test("120.505")).toBe(false);
  });

  it("rejects negative amounts, empty strings, and non-numeric input", () => {
    expect(SAR_MONEY_REGEX.test("-120")).toBe(false);
    expect(SAR_MONEY_REGEX.test("")).toBe(false);
    expect(SAR_MONEY_REGEX.test("abc")).toBe(false);
    expect(SAR_MONEY_REGEX.test("120.")).toBe(false);
  });

  it("works as a zod .regex() primitive (recovery.ts / eob-review.ts usage)", () => {
    const MoneySar = z.string().regex(SAR_MONEY_REGEX, "invalid amount");
    expect(MoneySar.safeParse("1234.56").success).toBe(true);
    expect(MoneySar.safeParse("1234.567").success).toBe(false);
  });

  // MONEY-PATH EXTRA-SCRUTINY REGRESSION — adversarial finding
  // (apps/web/lib/actions/eob-review.ts): the regex previously had no upper
  // bound on digit count (`^\d+(\.\d{1,2})?$`), so a 16+ digit SAR string
  // like "9007199254740992.00" passed format validation, then
  // moneyToHalalas's plain `Number(intPart)` conversion silently lost
  // precision once the integer part exceeded Number.MAX_SAFE_INTEGER
  // (2^53), letting two genuinely different SAR amounts collapse to the
  // identical halalas integer and defeat the strict `===` cross-total
  // checks in eob-validators.ts. Bounding the integer part to 12 digits
  // matches numeric(14,2)'s actual storage capacity (precision 14, scale 2)
  // and rejects any string large enough to trigger the float64 collision.
  describe("magnitude bound (money-path fix — matches numeric(14,2) capacity)", () => {
    it("accepts the maximum numeric(14,2) integer-part width (12 digits)", () => {
      expect(SAR_MONEY_REGEX.test("999999999999.99")).toBe(true);
      expect(SAR_MONEY_REGEX.test("999999999999")).toBe(true);
    });

    it("rejects a 13+ digit integer part (would exceed numeric(14,2) and risk float64 collision at 16+ digits)", () => {
      expect(SAR_MONEY_REGEX.test("1000000000000.00")).toBe(false);
    });

    it("rejects the exact adversarial-finding amounts that collided at float64 precision", () => {
      expect(SAR_MONEY_REGEX.test("9007199254740992.00")).toBe(false);
      expect(SAR_MONEY_REGEX.test("9007199254740993.00")).toBe(false);
    });

    it("rejects via zod .regex() too, so MoneySar (eob-review.ts) can never accept an oversized amount", () => {
      const MoneySar = z.string().regex(SAR_MONEY_REGEX, "invalid amount");
      expect(MoneySar.safeParse("9007199254740992.00").success).toBe(false);
    });
  });
});
