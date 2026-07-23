import { describe, it, expect } from "vitest";
import { isAuthorableFact, isScrubOperator } from "@taweed/rules-engine";
import { EXPLAIN_FLAG_CORPUS } from "../evals/explainFlagCorpus.js";
import { ASSIST_APPEAL_CORPUS } from "../evals/assistAppealCorpus.js";
import { AUTHOR_RULE_CORPUS } from "../evals/authorRuleCorpus.js";
import { DENIAL_REASON_CODES } from "@taweed/shared";

describe("EXPLAIN_FLAG_CORPUS", () => {
  it("is non-empty and every ruleId is unique", () => {
    expect(EXPLAIN_FLAG_CORPUS.length).toBeGreaterThan(0);
    const ids = EXPLAIN_FLAG_CORPUS.map((f) => f.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("spans more than one severity (real rule set diversity)", () => {
    const severities = new Set(EXPLAIN_FLAG_CORPUS.map((f) => f.severity));
    expect(severities.size).toBeGreaterThan(1);
  });
});

describe("ASSIST_APPEAL_CORPUS", () => {
  it("covers every real denial reason code exactly once", () => {
    const codes = ASSIST_APPEAL_CORPUS.map((f) => f.input.facts.denialCode);
    expect(new Set(codes)).toEqual(new Set(DENIAL_REASON_CODES.map((d) => d.code)));
    expect(codes.length).toBe(DENIAL_REASON_CODES.length);
  });

  it("every fixture id is unique", () => {
    const ids = ASSIST_APPEAL_CORPUS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("AUTHOR_RULE_CORPUS", () => {
  it("every fixture id is unique", () => {
    const ids = AUTHOR_RULE_CORPUS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every expected leaf references a real registry fact and operator (would silently break the eval otherwise)", () => {
    for (const fixture of AUTHOR_RULE_CORPUS) {
      for (const leaf of fixture.expected.leaves) {
        expect(isAuthorableFact(leaf.fact)).toBe(true);
        expect(isScrubOperator(leaf.operator)).toBe(true);
      }
      expect(isAuthorableFact(fixture.expected.field)).toBe(true);
    }
  });

  it("spans more than one severity and includes at least 3 distinct operators", () => {
    const severities = new Set(AUTHOR_RULE_CORPUS.map((f) => f.expected.severity));
    expect(severities.size).toBeGreaterThan(1);
    const operators = new Set(
      AUTHOR_RULE_CORPUS.flatMap((f) => f.expected.leaves.map((l) => l.operator)),
    );
    expect(operators.size).toBeGreaterThanOrEqual(3);
  });

  it("includes at least one Arabic-authored smeText (bilingual coverage)", () => {
    const arabicRe = /[؀-ۿ]/;
    expect(AUTHOR_RULE_CORPUS.some((f) => arabicRe.test(f.smeText))).toBe(true);
  });
});
