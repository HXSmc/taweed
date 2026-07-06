import { describe, it, expect } from "vitest";
import {
  AUTHORABLE_FACT_KEYS,
  SCRUB_OPERATORS,
  isAuthorableFact,
  isScrubOperator,
  SCRUBBER_RULES,
} from "@taweed/rules-engine";

// AI-3 registry — the authorable fact/operator allow-lists must stay a superset of
// what the shipped hand-written rules already use, or a legitimate rule shape would
// be un-authorable. This guards against a fact/operator drifting out of the list.

describe("authoring registry", () => {
  it("recognizes registered facts and operators", () => {
    expect(isAuthorableFact("hasPreAuth")).toBe(true);
    expect(isAuthorableFact("maxLineUnits")).toBe(true);
    expect(isAuthorableFact("ssn")).toBe(false);
    expect(isScrubOperator("greaterThanInclusive")).toBe(true);
    expect(isScrubOperator("drop table")).toBe(false);
  });

  // Review fix #4: in/notIn need an ARRAY constant but the draft value schema is
  // scalar-only, so they are excluded from the authorable operator set.
  it("excludes in/notIn (scalar-only value schema cannot express membership)", () => {
    expect(SCRUB_OPERATORS).not.toContain("in");
    expect(SCRUB_OPERATORS).not.toContain("notIn");
    expect(isScrubOperator("in")).toBe(false);
  });

  it("covers every fact/operator the shipped global+payer rules use", () => {
    // Derived + params-driven facts that scrub() injects but authoring excludes.
    const injected = new Set(["maxLineUnits", "sbsCount", "lineUnitsFor"]);
    const factsSeen = new Set<string>();
    const opsSeen = new Set<string>();
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const obj = node as Record<string, unknown>;
      for (const key of ["all", "any"] as const) {
        if (Array.isArray(obj[key])) {
          for (const child of obj[key] as unknown[]) walk(child);
          return;
        }
      }
      if (typeof obj["fact"] === "string") factsSeen.add(obj["fact"]);
      if (typeof obj["operator"] === "string") opsSeen.add(obj["operator"]);
    };
    for (const rule of SCRUBBER_RULES) walk(rule.conditions);

    for (const op of opsSeen) expect(SCRUB_OPERATORS).toContain(op);
    for (const fact of factsSeen) {
      if (injected.has(fact)) continue;
      expect(AUTHORABLE_FACT_KEYS).toContain(fact);
    }
  });
});
