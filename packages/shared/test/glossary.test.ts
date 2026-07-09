import { describe, it, expect } from "vitest";
import { APPEAL_GLOSSARY, glossaryPromptLines } from "@taweed/shared";

describe("APPEAL_GLOSSARY", () => {
  it("every entry has a non-empty en and ar rendering", () => {
    for (const entry of APPEAL_GLOSSARY) {
      expect(entry.en.length).toBeGreaterThan(0);
      expect(entry.ar.length).toBeGreaterThan(0);
    }
  });

  it("en terms are unique (case-insensitive)", () => {
    const enTerms = APPEAL_GLOSSARY.map((t) => t.en.toLowerCase());
    expect(new Set(enTerms).size).toBe(enTerms.length);
  });
});

describe("glossaryPromptLines", () => {
  it("renders one line per glossary term", () => {
    const lines = glossaryPromptLines().split("\n");
    expect(lines).toHaveLength(APPEAL_GLOSSARY.length);
  });

  it("each line matches '- <en> → <ar>' and preserves declared order", () => {
    const lines = glossaryPromptLines().split("\n");
    APPEAL_GLOSSARY.forEach((term, i) => {
      expect(lines[i]).toBe(`- ${term.en} → ${term.ar}`);
    });
  });
});
