import { describe, expect, it } from "vitest";
import { DENIAL_REASON_CODES } from "@taweed/shared";
import { generateAppeal } from "../src/index.js";
import type { AppealContext } from "../src/index.js";

// Latin ids/codes are merged verbatim; Arabic body must carry real script.
const AR_SCRIPT = /[؀-ۿ]/;
const CLAIM_ID = "550e8400-e29b-41d4-a716-446655440000";
const PAYER = "Tawuniya";
const AT_RISK = "1500.00";

function ctxFor(denialCode: string): AppealContext {
  return {
    claimId: CLAIM_ID,
    nphiesClaimId: "NPHIES-CLM-77",
    sbsCode: "83000-00",
    denialCode,
    denialCategory: "CARC",
    payerName: PAYER,
    providerName: "Al Salama Medical Center",
    memberId: "MBR-100200",
    atRiskSar: AT_RISK,
    serviceDate: "2026-03-14",
  };
}

describe("generateAppeal", () => {
  const codes = DENIAL_REASON_CODES.map((c) => c.code);

  it.each(codes)("produces a bilingual appeal for %s", (code) => {
    const draft = generateAppeal(ctxFor(code));

    // Non-empty EN + AR subject/body.
    expect(draft.subject_en.trim().length).toBeGreaterThan(0);
    expect(draft.body_en.trim().length).toBeGreaterThan(0);
    expect(draft.subject_ar.trim().length).toBeGreaterThan(0);
    expect(draft.body_ar.trim().length).toBeGreaterThan(0);

    // Merged fields present verbatim in BOTH bodies (Latin ids stay literal).
    for (const body of [draft.body_en, draft.body_ar]) {
      expect(body).toContain(CLAIM_ID);
      expect(body).toContain(PAYER);
      expect(body).toContain(AT_RISK);
    }

    // AR is genuine Arabic and not a copy of the EN text.
    expect(AR_SCRIPT.test(draft.body_ar)).toBe(true);
    expect(AR_SCRIPT.test(draft.subject_ar)).toBe(true);
    expect(draft.body_ar).not.toBe(draft.body_en);
    expect(draft.subject_ar).not.toBe(draft.subject_en);

    // Reason-appropriate, bilingual checklist.
    expect(draft.docChecklist.length).toBeGreaterThan(0);
    for (const item of draft.docChecklist) {
      expect(item.key.length).toBeGreaterThan(0);
      expect(item.label_en.trim().length).toBeGreaterThan(0);
      expect(AR_SCRIPT.test(item.label_ar)).toBe(true);
    }
  });

  it("selects a reason-appropriate checklist per code", () => {
    const d02 = generateAppeal(ctxFor("TWD-D02")); // prior authorization missing
    const d05 = generateAppeal(ctxFor("TWD-D05")); // duplicate claim/service
    expect(d02.docChecklist.map((i) => i.key).join(",")).toMatch(/auth/);
    // Distinct reasons yield distinct checklists.
    expect(d02.docChecklist.map((i) => i.key)).not.toEqual(
      d05.docChecklist.map((i) => i.key),
    );
  });

  it("DoD: emits at least one full appeal in BOTH en and ar", () => {
    const d = generateAppeal(ctxFor("TWD-D01"));
    const enComplete = [d.subject_en, d.body_en].every(
      (s) => s.trim().length > 0,
    );
    const arComplete = [d.subject_ar, d.body_ar].every(
      (s) => s.trim().length > 0 && AR_SCRIPT.test(s),
    );
    expect(enComplete).toBe(true);
    expect(arComplete).toBe(true);
  });

  it("unknown code falls back to a neutral base template (payerSpecific=false)", () => {
    const d = generateAppeal(ctxFor("TWD-D99-UNKNOWN"));
    expect(d.payerSpecific).toBe(false);
    expect(d.body_en.trim().length).toBeGreaterThan(0);
    expect(AR_SCRIPT.test(d.body_ar)).toBe(true);
    expect(d.docChecklist.length).toBeGreaterThan(0);
  });

  it("payer override flips payerSpecific to true; other payers stay neutral", () => {
    // Placeholder payer-specific override exists for Tawuniya + TWD-D02.
    const overridden = generateAppeal(ctxFor("TWD-D02"));
    expect(overridden.payerSpecific).toBe(true);

    const neutral = generateAppeal({
      ...ctxFor("TWD-D02"),
      payerName: "Some Other Insurer",
    });
    expect(neutral.payerSpecific).toBe(false);
  });
});
