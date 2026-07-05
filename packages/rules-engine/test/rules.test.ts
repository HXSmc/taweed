import { describe, expect, it } from "vitest";
import { SCRUBBER_RULES, type Severity } from "../src/index.js";

const SEVERITIES: ReadonlySet<Severity> = new Set<Severity>([
  "info",
  "warn",
  "high",
]);
const SCOPES: ReadonlySet<string> = new Set(["global", "tenant", "payer"]);
// Any Arabic-script codepoint — proves message_ar is real Arabic, not a stub.
const ARABIC = /[؀-ۿ]/;

describe("SCRUBBER_RULES", () => {
  it("has 12..16 high-value rules", () => {
    expect(SCRUBBER_RULES.length).toBeGreaterThanOrEqual(12);
    expect(SCRUBBER_RULES.length).toBeLessThanOrEqual(16);
  });

  it("every rule id is unique", () => {
    const ids = SCRUBBER_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SCRUBBER_RULES.map((r) => [r.id, r] as const))(
    "%s is well-formed",
    (_id, rule) => {
      expect(rule.name.trim().length).toBeGreaterThan(0);
      expect(rule.field.trim().length).toBeGreaterThan(0);
      expect(rule.weight).toBeGreaterThan(0);
      expect(SEVERITIES.has(rule.severity)).toBe(true);
      expect(SCOPES.has(rule.scope)).toBe(true);
      expect(rule.version).toBeGreaterThanOrEqual(1);
      expect(rule.conditions).toBeTypeOf("object");

      expect(rule.message_en.trim().length).toBeGreaterThan(0);
      expect(rule.message_ar.trim().length).toBeGreaterThan(0);
      // message_ar must actually contain Arabic script.
      expect(ARABIC.test(rule.message_ar)).toBe(true);
    },
  );

  it("covers every placeholder denial code the brief requires", () => {
    // Each rule id embeds its TWD denial code (R-<code>-...). Confirm the
    // full placeholder taxonomy in scope for the scrubber is represented.
    const codes = new Set(SCRUBBER_RULES.map((r) => r.id.split("-")[1]));
    for (const code of ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08"]) {
      expect(codes.has(code)).toBe(true);
    }
  });
});
