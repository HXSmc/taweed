import { describe, it, expect } from "vitest";
import { validateAgainstNphiesProfile } from "@taweed/fhir";

describe("validateAgainstNphiesProfile (stub)", () => {
  it("returns the creds-gated stub result", () => {
    const r = validateAgainstNphiesProfile({ resourceType: "Claim" });
    expect(r).toEqual({ ok: true, todo: "nphies-creds" });
  });
});
