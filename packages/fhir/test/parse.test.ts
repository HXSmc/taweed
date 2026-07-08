import { describe, it, expect } from "vitest";
import { parseResource, parseBundle } from "@taweed/fhir";

const claim = {
  resourceType: "Claim",
  id: "c1",
  status: "active",
  type: { coding: [{ code: "institutional" }] },
  use: "claim",
  patient: { reference: "Patient/p1" },
  created: "2026-01-01",
  provider: { reference: "Organization/o1" },
  priority: { coding: [{ code: "normal" }] },
};

const claimResponse = {
  resourceType: "ClaimResponse",
  id: "r1",
  status: "active",
  type: { coding: [{ code: "institutional" }] },
  use: "claim",
  patient: { reference: "Patient/p1" },
  created: "2026-01-02",
  insurer: { reference: "Organization/payer1" },
  outcome: "complete",
  request: { reference: "Claim/c1" },
};

function bundle(entries: unknown[]) {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: entries.map((resource) => ({ resource })),
  };
}

describe("parseResource", () => {
  it("returns ok with a typed Claim", () => {
    const r = parseResource(claim);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resource.resourceType).toBe("Claim");
  });

  it("returns issues for a malformed resource", () => {
    const r = parseResource({ resourceType: "Claim" });
    expect(r.ok).toBe(false);
  });
});

describe("parseBundle", () => {
  it("pairs a ClaimResponse to its Claim by reference", () => {
    const { pairs, issues } = parseBundle(bundle([claim, claimResponse]));
    expect(issues).toHaveLength(0);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.claim.id).toBe("c1");
    expect(pairs[0]!.claimResponse.id).toBe("r1");
  });

  it("pairs by entry fullUrl (urn:uuid) as well as Claim/{id}", () => {
    const b = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        { fullUrl: "urn:uuid:abc", resource: { ...claim, id: undefined } },
        {
          resource: {
            ...claimResponse,
            request: { reference: "urn:uuid:abc" },
          },
        },
      ],
    };
    const { pairs, issues } = parseBundle(b);
    expect(issues).toHaveLength(0);
    expect(pairs).toHaveLength(1);
  });

  it("flags an unmatched ClaimResponse", () => {
    const orphan = { ...claimResponse, request: { reference: "Claim/missing" } };
    const { pairs, issues } = parseBundle(bundle([orphan]));
    expect(pairs).toHaveLength(0);
    expect(issues.join(" ")).toMatch(/unmatched|no matching claim/i);
  });

  it("flags a non-Bundle input", () => {
    const { pairs, issues } = parseBundle(claim);
    expect(pairs).toHaveLength(0);
    expect(issues.join(" ")).toContain("Bundle");
  });

  it("collects validation issues for malformed entries", () => {
    const bad = { resourceType: "ClaimResponse", id: "r2" };
    const { issues } = parseBundle(bundle([claim, bad]));
    expect(issues.length).toBeGreaterThan(0);
  });

  it("reports an issue and keeps the first claim when two entries share the same Claim.id", () => {
    const firstClaim = { ...claim, id: "CL1" };
    const duplicateClaim = {
      ...claim,
      id: "CL1",
      provider: { reference: "Organization/o-duplicate" },
    };
    const response = { ...claimResponse, request: { reference: "Claim/CL1" } };

    const { pairs, issues } = parseBundle(
      bundle([firstClaim, duplicateClaim, response]),
    );

    expect(issues.join(" ")).toMatch(/duplicate Claim/i);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.claim.provider?.reference).toBe("Organization/o1");
  });
});
