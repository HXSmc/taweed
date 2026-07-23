import { describe, it, expect } from "vitest";
import {
  scoreAssistAppeal,
  buildAssistAppealReport,
  schemaInvalidAssistAppealCheck,
} from "../evals/assistAppealScoring.js";
import type { AssistAppealResult } from "../src/features/assistAppeal.js";

const OK_RESULT: AssistAppealResult = {
  ok: true,
  suggestion: {
    paragraphs_en: ["We request reconsideration of this claim.", "The service was medically appropriate and properly documented."],
    paragraphs_ar: ["نطلب إعادة النظر في هذه المطالبة.", "كانت الخدمة مناسبة طبياً وموثقة بشكل صحيح."],
  },
  verifyScore: 85,
  model: "claude-opus",
  charsEn: 120,
  charsAr: 100,
};

describe("scoreAssistAppeal", () => {
  it("classifies ok:true as outcome 'ok' with shape/digit checks", () => {
    const check = scoreAssistAppeal(OK_RESULT);
    expect(check.outcome).toBe("ok");
    expect(check.paragraphShapeOk).toBe(true);
    expect(check.digitLawOk).toBe(true);
    expect(check.selfVerifyScore).toBe(85);
  });

  it("flags a digit-law violation in an ok:true result", () => {
    const withDigit: AssistAppealResult = {
      ...OK_RESULT,
      suggestion: {
        ...OK_RESULT.suggestion,
        paragraphs_ar: ["نطلب إعادة النظر خلال ٣٠ يومًا."],
      },
    };
    const check = scoreAssistAppeal(withDigit);
    expect(check.digitLawOk).toBe(false);
  });

  it("classifies an en:/ar: suppression as objective-gate-failed", () => {
    const suppressed: AssistAppealResult = {
      ok: false,
      suppressed: true,
      reason: "en:invented-number",
    };
    const check = scoreAssistAppeal(suppressed);
    expect(check.outcome).toBe("objective-gate-failed");
  });

  it("classifies a verify: suppression as self-verify-suppressed, extracting the score", () => {
    const suppressed: AssistAppealResult = {
      ok: false,
      suppressed: true,
      reason: "verify:42",
    };
    const check = scoreAssistAppeal(suppressed);
    expect(check.outcome).toBe("self-verify-suppressed");
    expect(check.selfVerifyScore).toBe(42);
  });

  it("classifies an unexpected reason string as unrecognized-suppression, not silently mismatched", () => {
    const suppressed: AssistAppealResult = {
      ok: false,
      suppressed: true,
      reason: "something-new",
    };
    const check = scoreAssistAppeal(suppressed);
    expect(check.outcome).toBe("unrecognized-suppression");
  });
});

describe("schemaInvalidAssistAppealCheck", () => {
  it("does NOT count toward objectiveGatePassRate (a genuine miss, not a pass)", () => {
    const checks = [scoreAssistAppeal(OK_RESULT), schemaInvalidAssistAppealCheck()];
    const report = buildAssistAppealReport("test-provider", checks);
    expect(report.objectiveGatePassRate).toBeCloseTo(0.5);
    expect(report.schemaInvalidRate).toBeCloseTo(0.5);
  });
});

describe("buildAssistAppealReport", () => {
  it("computes objectiveGatePassRate as everything except en:/ar: failures", () => {
    const checks = [
      scoreAssistAppeal(OK_RESULT),
      scoreAssistAppeal({ ok: false, suppressed: true, reason: "verify:10" }),
      scoreAssistAppeal({ ok: false, suppressed: true, reason: "en:unknown-slot" }),
    ];
    const report = buildAssistAppealReport("test-provider", checks);
    expect(report.itemCount).toBe(3);
    // 2 of 3 passed the objective gate (ok + verify-suppressed); 1 failed it (en:).
    expect(report.objectiveGatePassRate).toBeCloseTo(2 / 3);
    expect(report.okRate).toBeCloseTo(1 / 3);
    expect(report.selfVerifySuppressedRate).toBeCloseTo(1 / 3);
  });

  it("does NOT count an unrecognized-suppression outcome as passing the objective gate", () => {
    const checks = [
      scoreAssistAppeal({ ok: false, suppressed: true, reason: "something-new" }),
    ];
    const report = buildAssistAppealReport("test-provider", checks);
    expect(report.objectiveGatePassRate).toBe(0);
  });

  it("returns a zeroed report for an empty batch", () => {
    const report = buildAssistAppealReport("test-provider", []);
    expect(report.itemCount).toBe(0);
    expect(report.objectiveGatePassRate).toBe(0);
  });
});
