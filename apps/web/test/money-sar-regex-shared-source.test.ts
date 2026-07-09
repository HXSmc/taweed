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
});
