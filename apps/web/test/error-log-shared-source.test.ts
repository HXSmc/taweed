import { describe, it, expect } from "vitest";
import { describeErrorForLog } from "@/lib/error-log";

// Regression test for the finding: eob-review.ts's approveEobExtractionAction
// logged a caught error object VERBATIM (`console.error("...", err)`) on the
// same AI-4 human-edited-EOB data path where the sibling eob-extract.ts
// already reduces errors to a content-free signal via describeErrorForLog —
// specifically because this feature is not PHI-free-by-construction (a
// Postgres constraint-violation message here, or a model error there, can
// carry the offending claimId/patientRef/money value or PDF content). Both
// actions now import the SAME describeErrorForLog from lib/error-log.ts
// instead of eob-extract.ts owning a private copy; this test locks the
// shared export's content-free behavior for both consumers.
describe("describeErrorForLog", () => {
  it("reduces an Error to its name only, dropping message/stack content", () => {
    const err = new Error("duplicate key value violates unique constraint (claimId=abc123, patientRef=xyz, amount=1234.56)");
    const result = describeErrorForLog(err);
    expect(result).toBe("Error");
    expect(result).not.toContain("claimId");
    expect(result).not.toContain("1234.56");
  });

  it("reduces a subclassed Error to its own name", () => {
    class PostgresConstraintError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "PostgresConstraintError";
      }
    }
    const err = new PostgresConstraintError("patientRef=999 duplicate");
    const result = describeErrorForLog(err);
    expect(result).toBe("PostgresConstraintError");
    expect(result).not.toContain("patientRef");
  });

  it("falls back to typeof for non-Error thrown values, never echoing the value", () => {
    expect(describeErrorForLog("raw string with claimId=abc")).toBe("string");
    expect(describeErrorForLog({ claimId: "abc", amount: 42 })).toBe("object");
    expect(describeErrorForLog(undefined)).toBe("undefined");
  });
});
