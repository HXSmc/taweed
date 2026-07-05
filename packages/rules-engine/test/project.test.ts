import { describe, it, expect } from "vitest";
import {
  projectClaimFacts,
  claimToFactsReal,
  claimToFactsSynthetic,
  scrub,
  SCRUBBER_RULES,
  type ProjectionClaim,
  type ProjectionLine,
  type ProjectionPatient,
} from "@taweed/rules-engine";

const YEAR = 2026;

// A production-tagged claim carrying REAL signal columns. Money high enough that
// the high-value pre-auth rule (R-D02-preauth-highcost) is in play.
function prodClaim(over: Partial<ProjectionClaim> = {}): ProjectionClaim {
  return {
    id: "claim-real-1",
    payer_id: "PAYER-X",
    total_amount: "5000.00",
    submitted_at: "2026-01-10",
    data_origin: "production",
    preauth_present: true,
    eligibility_verified: true,
    is_duplicate: false,
    has_documentation: true,
    ...over,
  };
}

const LINES: ProjectionLine[] = [
  { sbs_code: "SBS-0001", icd10am_code: "K02.1", qty: 2 },
];
const PATIENT: ProjectionPatient = { birth_year: 1990, gender: "female" };

describe("B5 production guard — synthetic projection is blocked on real data", () => {
  it("claimToFactsSynthetic throws on a production-tagged claim", () => {
    expect(() =>
      claimToFactsSynthetic(prodClaim(), LINES, PATIENT, YEAR),
    ).toThrow(/production/i);
  });

  it("projectClaimFacts routes a production claim to the real projection", () => {
    // Real projection carries the null-when-unknown behavior; the synthetic one
    // never returns a null hasPreAuth. A null preauth on a production claim proves
    // routing went to the real projection.
    const facts = projectClaimFacts(
      prodClaim({ preauth_present: null }),
      LINES,
      PATIENT,
      YEAR,
    );
    expect(facts.hasPreAuth).toBeNull();
  });

  it("projectClaimFacts routes a synthetic claim to the synthetic projection", () => {
    const facts = projectClaimFacts(
      prodClaim({ data_origin: "synthetic", preauth_present: null }),
      LINES,
      PATIENT,
      YEAR,
    );
    // Synthetic projection derives every signal (never null) so the demo shows
    // the full rule range.
    expect(facts.hasPreAuth === null).toBe(false);
  });

  it("fails CLOSED: an untagged/unknown data_origin uses the real projection, never fabricated", () => {
    // A value outside the union (untagged/corrupt) must NOT reach the fabricating
    // projection — it degrades to the real column mapping (null → unevaluable).
    const claim = {
      ...prodClaim({ preauth_present: null }),
      data_origin: "" as ProjectionClaim["data_origin"],
    };
    const facts = projectClaimFacts(claim, LINES, PATIENT, YEAR);
    expect(facts.hasPreAuth).toBeNull();
    expect(() => claimToFactsSynthetic(claim, LINES, PATIENT, YEAR)).toThrow();
  });
});

describe("B5 real projection — unknown signal drives 'unevaluable', not a false pass", () => {
  it("maps present real columns straight through", () => {
    const facts = claimToFactsReal(prodClaim(), LINES, PATIENT, YEAR);
    expect(facts.hasPreAuth).toBe(true);
    expect(facts.policyActive).toBe(true);
    expect(facts.isDuplicate).toBe(false);
    expect(facts.hasDocumentation).toBe(true);
    expect(facts.patientAgeYears).toBe(36); // 2026 - 1990
    expect(facts.patientGender).toBe("female");
    expect(facts.hasDiagnosis).toBe(true); // a line carries an icd10am_code
  });

  it("null preauth_present -> hasPreAuth null -> pre-auth rule is unevaluable", async () => {
    const facts = claimToFactsReal(
      prodClaim({ preauth_present: null }),
      LINES,
      PATIENT,
      YEAR,
    );
    expect(facts.hasPreAuth).toBeNull();
    const result = await scrub(facts, SCRUBBER_RULES);
    expect(result.unevaluable).toContain("R-D02-preauth-highcost");
    // A rule whose fact is absent must never appear as a fired flag.
    expect(result.flags.some((f) => f.ruleId === "R-D02-preauth-highcost")).toBe(
      false,
    );
  });

  it("null eligibility_verified -> policyActive null -> eligibility rule unevaluable", async () => {
    const facts = claimToFactsReal(
      prodClaim({ eligibility_verified: null }),
      LINES,
      PATIENT,
      YEAR,
    );
    expect(facts.policyActive).toBeNull();
    const result = await scrub(facts, SCRUBBER_RULES);
    expect(result.unevaluable).toContain("R-D04-eligibility-gap");
  });

  it("no diagnosis code on any line -> hasDiagnosis false (a real, evaluable signal)", () => {
    const facts = claimToFactsReal(
      prodClaim(),
      [{ sbs_code: "SBS-0001", icd10am_code: null, qty: 1 }],
      PATIENT,
      YEAR,
    );
    expect(facts.hasDiagnosis).toBe(false);
  });

  it("null birth_year -> patientAgeYears null (age rule cannot silently pass)", () => {
    const facts = claimToFactsReal(
      prodClaim(),
      LINES,
      { birth_year: null, gender: "male" },
      YEAR,
    );
    expect(facts.patientAgeYears).toBeNull();
  });
});
