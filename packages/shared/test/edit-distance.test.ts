import { describe, it, expect } from "vitest";
import { levenshtein } from "@taweed/shared";

describe("levenshtein", () => {
  it("is zero for identical strings", () => {
    expect(levenshtein("appeal", "appeal")).toBe(0);
  });
  it("equals the other length when one side is empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
  it("counts single-character edits", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("flaw", "lawn")).toBe(2);
  });
  it("is symmetric", () => {
    expect(levenshtein("draft", "drift")).toBe(levenshtein("drift", "draft"));
  });
  it("handles Arabic text (single appended character)", () => {
    expect(levenshtein("نعم", "نعمة")).toBe(1);
  });
});
