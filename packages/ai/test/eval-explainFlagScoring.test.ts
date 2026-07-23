import { describe, it, expect } from "vitest";
import {
  scoreExplainFlag,
  buildExplainFlagReport,
  schemaInvalidExplainFlagCheck,
} from "../evals/explainFlagScoring.js";
import type { FlagExplanation } from "../src/schemas/flagExplanation.js";

const GOOD: FlagExplanation = {
  explanation_en:
    "This claim was flagged because pre-authorization was not obtained before the service date, which the payer requires for this procedure type.",
  explanation_ar:
    "تم وضع علامة على هذه المطالبة لأن الموافقة المسبقة لم يتم الحصول عليها قبل تاريخ الخدمة، وهو أمر يتطلبه الدافع لهذا النوع من الإجراءات.",
  suggested_fix_en:
    "Obtain the pre-authorization number from the payer portal and resubmit the claim with it attached.",
  suggested_fix_ar:
    "احصل على رقم الموافقة المسبقة من بوابة الدافع وأعد تقديم المطالبة مع إرفاقه.",
};

describe("scoreExplainFlag", () => {
  it("passes a well-formed bilingual explanation with no constraint violations", () => {
    const check = scoreExplainFlag(GOOD);
    expect(check.pass).toBe(true);
    expect(check.allFieldsValid).toBe(true);
    expect(check.digitLawOk).toBe(true);
    expect(check.clinicalLanguageFlag).toBe(false);
    expect(check.upcodingLanguageFlag).toBe(false);
  });

  it("fails digit law when an Arabic-Indic digit leaks through", () => {
    const withLeakedDigit: FlagExplanation = {
      ...GOOD,
      explanation_ar: GOOD.explanation_ar + " خلال ٣٠ يومًا",
    };
    const check = scoreExplainFlag(withLeakedDigit);
    expect(check.digitLawOk).toBe(false);
    expect(check.pass).toBe(false);
  });

  it("flags clinical-language violations (the SFDA carve-out)", () => {
    const clinical: FlagExplanation = {
      ...GOOD,
      suggested_fix_en:
        "The treating physician should change the diagnosis to match a covered condition before resubmission.",
    };
    const check = scoreExplainFlag(clinical);
    expect(check.clinicalLanguageFlag).toBe(true);
    expect(check.pass).toBe(false);
  });

  it("flags upcoding-language violations", () => {
    const upcoding: FlagExplanation = {
      ...GOOD,
      suggested_fix_en: "Simply change the procedure code to a higher-paying one.",
    };
    const check = scoreExplainFlag(upcoding);
    expect(check.upcodingLanguageFlag).toBe(true);
    expect(check.pass).toBe(false);
  });

  it("fails allFieldsValid on an empty field", () => {
    const empty: FlagExplanation = { ...GOOD, explanation_en: "" };
    const check = scoreExplainFlag(empty);
    expect(check.allFieldsValid).toBe(false);
    expect(check.pass).toBe(false);
  });

  it("fails allFieldsValid on a too-short field (below MIN_FIELD_LEN)", () => {
    const short: FlagExplanation = { ...GOOD, explanation_en: "Bad claim." };
    const check = scoreExplainFlag(short);
    expect(check.allFieldsValid).toBe(false);
  });
});

describe("schemaInvalidExplainFlagCheck", () => {
  it("scores as a genuine miss (pass:false, allFieldsValid:false), not a fabricated pass", () => {
    const check = schemaInvalidExplainFlagCheck();
    expect(check.pass).toBe(false);
    expect(check.allFieldsValid).toBe(false);
  });
});

describe("buildExplainFlagReport", () => {
  it("computes rates correctly across a mixed batch", () => {
    const checks = [
      scoreExplainFlag(GOOD),
      scoreExplainFlag({ ...GOOD, explanation_en: "" }),
    ];
    const report = buildExplainFlagReport("test-provider", checks);
    expect(report.itemCount).toBe(2);
    expect(report.passCount).toBe(1);
    expect(report.passRate).toBe(0.5);
  });

  it("returns a zeroed report for an empty batch (no division by zero)", () => {
    const report = buildExplainFlagReport("test-provider", []);
    expect(report.itemCount).toBe(0);
    expect(report.passRate).toBe(0);
  });
});
