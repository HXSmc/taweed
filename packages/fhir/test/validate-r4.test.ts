import { describe, it, expect } from "vitest";
import { validateR4 } from "@taweed/fhir";

const validClaim = {
  resourceType: "Claim",
  status: "active",
  type: { coding: [{ code: "institutional" }] },
  use: "claim",
  patient: { reference: "Patient/p1" },
  created: "2026-01-01",
  provider: { reference: "Organization/o1" },
  priority: { coding: [{ code: "normal" }] },
};

const validClaimResponse = {
  resourceType: "ClaimResponse",
  status: "active",
  type: { coding: [{ code: "institutional" }] },
  use: "claim",
  patient: { reference: "Patient/p1" },
  created: "2026-01-02",
  insurer: { reference: "Organization/payer1" },
  outcome: "complete",
  request: { reference: "Claim/c1" },
};

const cases: Array<{
  name: string;
  input: unknown;
  ok: boolean;
  issueIncludes?: string;
}> = [
  { name: "valid Claim", input: validClaim, ok: true },
  { name: "valid ClaimResponse", input: validClaimResponse, ok: true },
  {
    name: "unknown resourceType",
    input: { ...validClaim, resourceType: "Patient" },
    ok: false,
    issueIncludes: "resourceType",
  },
  {
    name: "Claim missing status",
    input: { ...validClaim, status: undefined },
    ok: false,
    issueIncludes: "status",
  },
  {
    name: "ClaimResponse missing outcome",
    input: { ...validClaimResponse, outcome: undefined },
    ok: false,
    issueIncludes: "outcome",
  },
  { name: "null", input: null, ok: false, issueIncludes: "object" },
  { name: "string", input: "nope", ok: false, issueIncludes: "object" },
];

describe("validateR4", () => {
  for (const c of cases) {
    it(c.name, () => {
      const result = validateR4(c.input);
      expect(result.ok).toBe(c.ok);
      if (!result.ok && c.issueIncludes) {
        expect(result.issues.join(" ")).toContain(c.issueIncludes);
      }
    });
  }
});
