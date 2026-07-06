import { describe, it, expect } from "vitest";
import {
  buildFactSlots,
  slotLegend,
  assertNoInventedNumbers,
  unknownSlots,
  detokenizeSlots,
  checkParagraphs,
  type AppealFacts,
} from "../src/appeal-guardrails.js";

const FACTS: AppealFacts = {
  claimRef: "NPH-2026-0042",
  sbsCode: "SBS-0002",
  denialCode: "TWD-D02",
  atRiskSar: "1500.00",
  serviceDate: "2026-01-15",
};

describe("buildFactSlots", () => {
  it("maps every fact to a DIGIT-FREE token", () => {
    const slots = buildFactSlots(FACTS);
    for (const token of Object.keys(slots)) {
      expect(token).toMatch(/^\[[A-Z_]+\]$/); // no digits in the token itself
    }
    expect(slots["[AMOUNT_DENIED]"]).toBe("1500.00");
    expect(slots["[CODE_SBS]"]).toBe("SBS-0002");
  });

  it("omits an absent optional fact", () => {
    const slots = buildFactSlots({ ...FACTS, sbsCode: null, serviceDate: "" });
    expect(slots["[CODE_SBS]"]).toBeUndefined();
    expect(slots["[DATE_SERVICE]"]).toBeUndefined();
  });
});

describe("assertNoInventedNumbers — the load-bearing check", () => {
  const slots = buildFactSlots(FACTS);

  it("passes prose that references facts only via slot tokens", () => {
    const text =
      "We appeal claim [CLAIM_REF]; the amount at risk is SAR [AMOUNT_DENIED] for service [CODE_SBS].";
    expect(assertNoInventedNumbers(text, slots).ok).toBe(true);
  });

  it("passes pure argumentative prose with no numbers at all", () => {
    expect(
      assertNoInventedNumbers(
        "The denied service is medically necessary and covered under the active policy.",
        slots,
      ).ok,
    ).toBe(true);
  });

  it("FAILS on a Western-digit number the model invented", () => {
    const r = assertNoInventedNumbers(
      "A valid authorization number 78910 was on file.",
      slots,
    );
    expect(r.ok).toBe(false);
    expect(r.offenders).toContain("78910");
  });

  it("FAILS on an Arabic-Indic digit the model invented", () => {
    const r = assertNoInventedNumbers("رقم الموافقة ٧٨٩ مرفق.", slots);
    expect(r.ok).toBe(false);
    expect(r.offenders.length).toBeGreaterThan(0);
  });

  it("does not false-positive on a pseudonym token's own digits (stripped first)", () => {
    // A merged slot set including a pseudonymize token like [MEMBER_ID_1].
    const merged = { ...slots, "[MEMBER_ID_1]": "M-99999" };
    const text = "On behalf of member [MEMBER_ID_1], we appeal claim [CLAIM_REF].";
    expect(assertNoInventedNumbers(text, merged).ok).toBe(true);
  });
});

describe("unknownSlots", () => {
  const slots = buildFactSlots(FACTS);
  it("flags a token the model made up", () => {
    const text = "The paid amount [AMOUNT_PAID] differs from [AMOUNT_DENIED].";
    expect(unknownSlots(text, slots)).toEqual(["[AMOUNT_PAID]"]);
  });
  it("accepts only known tokens", () => {
    expect(unknownSlots("[CLAIM_REF] and [CODE_DENIAL]", slots)).toEqual([]);
  });

  // Review fix #7: a case-variant token must be flagged as unknown (real tokens are
  // uppercase), so it is suppressed rather than leaked as a literal placeholder.
  it("flags a lowercase case-variant token as unknown (fail closed)", () => {
    expect(unknownSlots("member [amount_denied] appeal", slots)).toEqual([
      "[amount_denied]",
    ]);
  });
});

describe("detokenizeSlots (runs last)", () => {
  it("substitutes real values for every token", () => {
    const slots = buildFactSlots(FACTS);
    const out = detokenizeSlots(
      "Claim [CLAIM_REF], SAR [AMOUNT_DENIED], service [CODE_SBS] on [DATE_SERVICE].",
      slots,
    );
    expect(out).toBe("Claim NPH-2026-0042, SAR 1500.00, service SBS-0002 on 2026-01-15.");
    expect(out).not.toContain("[");
  });
});

describe("checkParagraphs — the paragraph gate", () => {
  const slots = buildFactSlots(FACTS);

  it("passes clean bilingual-safe paragraphs", () => {
    expect(
      checkParagraphs(
        [
          "The denied service is covered under the member's active policy.",
          "A valid authorization applies to claim [CLAIM_REF].",
        ],
        slots,
      ),
    ).toEqual({ ok: true });
  });

  it("fails closed on any invented number", () => {
    const r = checkParagraphs(
      ["The service costs SAR 9999 and is necessary."],
      slots,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invented-number");
  });

  it("fails closed on an unknown slot", () => {
    const r = checkParagraphs(["Refer to [PATIENT_DOB] for eligibility."], slots);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unknown-slot");
  });

  it("fails closed on empty paragraphs", () => {
    expect(checkParagraphs([], slots).reason).toBe("empty");
    expect(checkParagraphs(["", "  "], slots).reason).toBe("empty");
  });
});

describe("slotLegend", () => {
  it("lists only the present facts", () => {
    const legend = slotLegend({ ...FACTS, sbsCode: null });
    expect(legend).toContain("[CLAIM_REF]");
    expect(legend).not.toContain("[CODE_SBS]");
  });
});
