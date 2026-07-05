import { describe, it, expect } from "vitest";
import {
  normalizeArabicDigits,
  stripTashkeel,
  isolateLatinRuns,
  normalizeArabicOutput,
} from "../src/postprocess-ar.js";

const LRM = "‎";

describe("normalizeArabicDigits (design-brief §4.3 digit law)", () => {
  it.each([
    ["٣٤", "34"], // ٣٤ Arabic-Indic
    ["٠١٢٣٤٥٦٧٨٩", "0123456789"],
    ["۳۴", "34"], // ۳۴ Eastern-Arabic-Indic (Persian)
    ["1234", "1234"], // already Western — unchanged
  ])("maps %j to %j", (input, expected) => {
    expect(normalizeArabicDigits(input)).toBe(expected);
  });

  it("normalizes digits embedded in Arabic prose", () => {
    // "claim number ٤٢" -> "claim number 42"
    expect(normalizeArabicDigits("رقم ٤٢")).toBe(
      "رقم 42",
    );
  });
});

describe("stripTashkeel", () => {
  it("removes harakat but keeps the base letters", () => {
    // مَحمَد (with fatha) -> محمد
    expect(stripTashkeel("مَحمَد")).toBe(
      "محمد",
    );
  });

  it("is a no-op on text without tashkeel", () => {
    expect(stripTashkeel("محمد")).toBe("محمد");
  });
});

describe("isolateLatinRuns", () => {
  it("wraps a Latin code with LRM marks inside Arabic text", () => {
    // "code SBS-0002" in Arabic -> code isolated
    const input = "رمز SBS-0002";
    const out = isolateLatinRuns(input);
    expect(out).toContain(`${LRM}SBS-0002${LRM}`);
  });

  it("leaves Latin-only text untouched (no bidi hazard)", () => {
    expect(isolateLatinRuns("SBS-0002 total")).toBe("SBS-0002 total");
  });

  it("is idempotent — pre-existing bidi marks are re-normalized", () => {
    const input = "رمز SBS-0002";
    const once = isolateLatinRuns(input);
    expect(isolateLatinRuns(once)).toBe(once);
  });
});

describe("normalizeArabicOutput (full pipeline)", () => {
  it("normalizes digits, strips tashkeel, and isolates codes together", () => {
    // "مَبلغ ٤٢ رمز SBS-0002" -> western digit + stripped fatha + isolated code
    const input = "مَبلغ ٤٢ رمز SBS-0002";
    const out = normalizeArabicOutput(input);
    expect(out).toContain("42");
    expect(out).not.toContain("َ"); // fatha gone
    expect(out).toContain(`${LRM}SBS-0002${LRM}`);
  });

  it("is idempotent", () => {
    const input = "مبلغ ٤٢ SBS-0002";
    const once = normalizeArabicOutput(input);
    expect(normalizeArabicOutput(once)).toBe(once);
  });

  it("leaves an English string unchanged", () => {
    expect(normalizeArabicOutput("Total at risk: 1234 SAR")).toBe(
      "Total at risk: 1234 SAR",
    );
  });
});
