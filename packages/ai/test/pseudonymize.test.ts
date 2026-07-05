import { describe, it, expect } from "vitest";
import {
  pseudonymize,
  detokenize,
  ageBand,
  type PseudonymizeConfig,
} from "../src/pseudonymize.js";

const NOW = new Date("2026-07-05T00:00:00Z");

const CONFIG: PseudonymizeConfig = {
  identifiers: { patient_name: "PATIENT", member_id: "MEMBER_ID" },
  dob: ["dob"],
  freeTextAllow: [],
};

describe("pseudonymize — structured identifiers", () => {
  it("replaces identifier columns with opaque numbered tokens", () => {
    const { record, detokenMap } = pseudonymize(
      { patient_name: "محمد الأحمد", member_id: "MEM-9" },
      CONFIG,
      NOW,
    );
    expect(record.patient_name).toBe("[PATIENT_1]");
    expect(record.member_id).toBe("[MEMBER_ID_1]");
    expect(detokenMap["[PATIENT_1]"]).toBe("محمد الأحمد");
  });

  it("round-trips an Arabic name byte-identically via detokenize", () => {
    const { detokenMap } = pseudonymize(
      { patient_name: "محمد الأحمد" },
      CONFIG,
      NOW,
    );
    const restored = detokenize(
      "Appeal filed for [PATIENT_1] on behalf of the clinic.",
      detokenMap,
    );
    expect(restored).toBe(
      "Appeal filed for محمد الأحمد on behalf of the clinic.",
    );
  });

  it("gives equal values under the same prefix a single shared token", () => {
    const { record, detokenMap } = pseudonymize(
      { patient_name: "SAME", member_id: "SAME" },
      { identifiers: { patient_name: "P", member_id: "P" } },
      NOW,
    );
    expect(record.patient_name).toBe("[P_1]");
    expect(record.member_id).toBe("[P_1]");
    expect(Object.keys(detokenMap)).toEqual(["[P_1]"]);
  });

  it("skips absent, null, and empty identifier values", () => {
    const { record } = pseudonymize(
      { patient_name: "", member_id: null },
      CONFIG,
      NOW,
    );
    expect(record.patient_name).toBeUndefined();
    expect(record.member_id).toBeUndefined();
  });
});

describe("pseudonymize — DOB to age band", () => {
  it("collapses a birth date into a decade band", () => {
    const { record } = pseudonymize({ dob: "1990-06-01" }, CONFIG, NOW);
    expect(record.dob).toBe("30-39"); // age 36 on 2026-07-05
  });

  it("labels an unparseable date as unknown", () => {
    expect(ageBand("not-a-date", NOW)).toBe("unknown");
  });
});

describe("pseudonymize — free-text exclusion", () => {
  it("drops free-text columns by default", () => {
    const { record } = pseudonymize(
      { clinical_note: "patient has diabetes" },
      CONFIG,
      NOW,
    );
    expect(record.clinical_note).toBeUndefined();
  });

  it("passes an allowlisted free-text column through verbatim", () => {
    const { record } = pseudonymize(
      { clinical_note: "billing note" },
      { identifiers: {}, freeTextAllow: ["clinical_note"] },
      NOW,
    );
    expect(record.clinical_note).toBe("billing note");
  });
});

describe("detokenize — token prefix safety", () => {
  it("replaces the longer token first so [P_1] does not clobber [P_10]", () => {
    const map = { "[P_1]": "one", "[P_10]": "ten" };
    expect(detokenize("[P_10] and [P_1]", map)).toBe("ten and one");
  });
});
