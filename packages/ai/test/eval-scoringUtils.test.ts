import { describe, it, expect } from "vitest";
import { ARABIC_INDIC_DIGITS, rate, average } from "../evals/scoringUtils.js";

describe("ARABIC_INDIC_DIGITS", () => {
  it("matches Arabic-Indic and Extended Arabic-Indic digits, not Western ones", () => {
    expect(ARABIC_INDIC_DIGITS.test("٣٠")).toBe(true);
    expect(ARABIC_INDIC_DIGITS.test("۳۰")).toBe(true);
    expect(ARABIC_INDIC_DIGITS.test("30")).toBe(false);
    expect(ARABIC_INDIC_DIGITS.test("no digits here")).toBe(false);
  });
});

describe("rate", () => {
  it("computes the fraction matching the predicate", () => {
    expect(rate([1, 2, 3, 4], (n) => n % 2 === 0)).toBe(0.5);
  });

  it("returns 0 (not NaN) for an empty array", () => {
    expect(rate([], (n: number) => n > 0)).toBe(0);
  });
});

describe("average", () => {
  it("computes the arithmetic mean", () => {
    expect(average([1, 2, 3], (n) => n)).toBe(2);
  });

  it("returns 0 (not NaN) for an empty array", () => {
    expect(average([], (n: number) => n)).toBe(0);
  });
});
