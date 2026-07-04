import { describe, it, expect } from "vitest";
import {
  DENIAL_REASON_CODES,
  isDenialReasonCode,
  type DenialReasonCode,
} from "@taweed/shared";

describe("DENIAL_REASON_CODES (placeholder)", () => {
  it("exposes exactly 8 placeholder codes", () => {
    expect(DENIAL_REASON_CODES).toHaveLength(8);
  });

  it("every entry has code, kind (CARC|RARC) and a label", () => {
    for (const entry of DENIAL_REASON_CODES) {
      expect(entry.code).toMatch(/^TWD-/);
      expect(["CARC", "RARC"]).toContain(entry.kind);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it("codes are unique", () => {
    const codes = DENIAL_REASON_CODES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("includes both CARC and RARC kinds", () => {
    const kinds = new Set(DENIAL_REASON_CODES.map((c) => c.kind));
    expect(kinds.has("CARC")).toBe(true);
    expect(kinds.has("RARC")).toBe(true);
  });

  it("isDenialReasonCode narrows known codes and rejects unknown", () => {
    const known: DenialReasonCode = DENIAL_REASON_CODES[0]!.code;
    expect(isDenialReasonCode(known)).toBe(true);
    expect(isDenialReasonCode("NOT-A-CODE")).toBe(false);
    expect(isDenialReasonCode(undefined)).toBe(false);
  });
});
