import { describe, it, expect } from "vitest";
import type { ClaimResponse } from "@medplum/fhirtypes";
import { parseBundle } from "@taweed/fhir";
import {
  SCENARIOS,
  generateBundle,
  generateAll,
  type ScenarioName,
} from "@taweed/synthetic-fhir";

const SEED = 42;

/** Adjudication entries that carry a `reason` are denials (generator contract). */
function deniedAdjudications(response: ClaimResponse) {
  const out: { itemSequence?: number; code?: string }[] = [];
  for (const item of response.item ?? []) {
    for (const adj of item.adjudication ?? []) {
      if (adj.reason?.coding?.length) {
        out.push({
          itemSequence: item.itemSequence,
          code: adj.reason.coding[0]?.code,
        });
      }
    }
  }
  return out;
}

describe("generateBundle — every scenario parses cleanly", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario} → 1 clean pair`, () => {
      const bundle = generateBundle(scenario, SEED);
      const { pairs, issues } = parseBundle(bundle);
      expect(issues).toHaveLength(0);
      expect(pairs).toHaveLength(1);
    });
  }
});

describe("generateBundle — determinism", () => {
  it("same seed produces byte-identical bundles", () => {
    const a = generateBundle("partialDenial", SEED);
    const b = generateBundle("partialDenial", SEED);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("generateBundle — scenario semantics", () => {
  it("partialDenial denies some lines and accepts others", () => {
    const { pairs } = parseBundle(generateBundle("partialDenial", SEED));
    const response = pairs[0]!.claimResponse;
    const denied = deniedAdjudications(response);
    const lineCount = pairs[0]!.claim.item?.length ?? 0;
    expect(denied.length).toBeGreaterThan(0);
    expect(denied.length).toBeLessThan(lineCount);
    // FHIR R4 ClaimResponse.outcome "complete" = adjudication finished
    // without processing errors, regardless of denial outcome.
    expect(response.outcome).toBe("complete");
  });

  it("fullDenial denies every line with outcome complete", () => {
    const { pairs } = parseBundle(generateBundle("fullDenial", SEED));
    const response = pairs[0]!.claimResponse;
    const lineCount = pairs[0]!.claim.item?.length ?? 0;
    const deniedLines = new Set(
      deniedAdjudications(response).map((d) => d.itemSequence),
    );
    expect(deniedLines.size).toBe(lineCount);
    expect(response.outcome).toBe("complete");
  });

  it("missingPreAuth omits preAuthRef and denies with TWD-D02", () => {
    const { pairs } = parseBundle(generateBundle("missingPreAuth", SEED));
    const claim = pairs[0]!.claim;
    expect(claim.insurance?.[0]?.preAuthRef).toBeUndefined();
    const codes = deniedAdjudications(pairs[0]!.claimResponse).map((d) => d.code);
    expect(codes).toContain("TWD-D02");
  });

  it("multiReason explodes to >1 denial on a single line", () => {
    const { pairs } = parseBundle(generateBundle("multiReason", SEED));
    const denied = deniedAdjudications(pairs[0]!.claimResponse);
    const bySeq = new Map<number | undefined, number>();
    for (const d of denied)
      bySeq.set(d.itemSequence, (bySeq.get(d.itemSequence) ?? 0) + 1);
    expect(Math.max(...bySeq.values())).toBeGreaterThanOrEqual(2);
  });

  it("bundledLines denies a line with the bundled code TWD-D07", () => {
    const { pairs } = parseBundle(generateBundle("bundledLines", SEED));
    const codes = deniedAdjudications(pairs[0]!.claimResponse).map((d) => d.code);
    expect(codes).toContain("TWD-D07");
  });

  it("arabicText carries Arabic script in the Claim narrative", () => {
    const { pairs } = parseBundle(generateBundle("arabicText", SEED));
    const div = pairs[0]!.claim.text?.div ?? "";
    expect(/\p{Script=Arabic}/u.test(div)).toBe(true);
  });

  it("payer variants use different insurers", () => {
    const a = parseBundle(generateBundle("payerVariantA", SEED)).pairs[0]!;
    const b = parseBundle(generateBundle("payerVariantB", SEED)).pairs[0]!;
    expect(a.claimResponse.insurer?.reference).not.toBe(
      b.claimResponse.insurer?.reference,
    );
  });
});

describe("generateAll", () => {
  it("returns one entry per scenario", () => {
    const all = generateAll(SEED);
    expect(all.map((a) => a.scenario).sort()).toEqual(
      [...SCENARIOS].sort() as ScenarioName[],
    );
    for (const { bundle } of all) {
      expect(parseBundle(bundle).pairs).toHaveLength(1);
    }
  });
});
