import { describe, it, expect } from "vitest";
import { parseBundle } from "@taweed/fhir";
import { generateAll, generateBundle } from "@taweed/synthetic-fhir";
import { isDenialReasonCode } from "@taweed/shared";
import type { ClaimPair } from "@taweed/fhir";
import { normalize, type NormalizeContext } from "@taweed/normalizer";

const CTX: NormalizeContext = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  branchId: "22222222-2222-4222-8222-222222222222",
  providerId: "33333333-3333-4333-8333-333333333333",
  payerId: "44444444-4444-4444-8444-444444444444",
  patientId: "55555555-5555-4555-8555-555555555555",
};

const SEED = 7;

function normalizeScenario(name: Parameters<typeof generateBundle>[0]) {
  const { pairs } = parseBundle(generateBundle(name, SEED));
  return normalize(pairs[0]!, CTX);
}

describe("normalize — structural invariants across all scenarios", () => {
  for (const { scenario, bundle } of generateAll(SEED)) {
    it(`${scenario}: one line row per Claim.item, tenant stamped everywhere`, () => {
      const pair = parseBundle(bundle).pairs[0]!;
      const n = normalize(pair, CTX);

      expect(n.lines).toHaveLength(pair.claim.item?.length ?? 0);
      expect(n.claim.nphies_claim_id).toBe(pair.claim.id);
      expect(n.claim.tenant_id).toBe(CTX.tenantId);
      expect(n.response.tenant_id).toBe(CTX.tenantId);
      for (const line of n.lines) {
        expect(line.tenant_id).toBe(CTX.tenantId);
        expect(line.claim_id).toBe(n.claim.id);
      }
      for (const d of n.denials) {
        expect(d.tenant_id).toBe(CTX.tenantId);
        expect(n.lines.some((l) => l.id === d.claim_line_id)).toBe(true);
      }
    });
  }
});

describe("normalize — denial explosion", () => {
  it("clean scenario yields no denials", () => {
    const n = normalizeScenario("clean");
    expect(n.denials).toHaveLength(0);
    expect(n.response.outcome).toBe("complete");
  });

  it("fullDenial yields one denial per line across distinct lines", () => {
    const n = normalizeScenario("fullDenial");
    expect(n.denials).toHaveLength(2);
    expect(new Set(n.denials.map((d) => d.claim_line_id)).size).toBe(2);
    expect(n.response.outcome).toBe("error");
  });

  it("partialDenial denies fewer lines than exist", () => {
    const n = normalizeScenario("partialDenial");
    const deniedLines = new Set(n.denials.map((d) => d.claim_line_id));
    expect(n.denials.length).toBeGreaterThan(0);
    expect(deniedLines.size).toBeLessThan(n.lines.length);
  });

  it("multiReason explodes one line into multiple denial rows", () => {
    const n = normalizeScenario("multiReason");
    expect(n.denials).toHaveLength(2);
    expect(new Set(n.denials.map((d) => d.claim_line_id)).size).toBe(1);
  });
});

describe("normalize — field mapping", () => {
  it("denial rows carry a known code, category and numeric amount", () => {
    const n = normalizeScenario("fullDenial");
    for (const d of n.denials) {
      expect(isDenialReasonCode(d.reason_code)).toBe(true);
      expect(d.category).toBe("denied");
      expect(Number.isNaN(Number(d.denied_amount))).toBe(false);
    }
  });

  it("line amount equals qty * unit price and total equals the sum", () => {
    const n = normalizeScenario("clean");
    let sum = 0;
    for (const line of n.lines) {
      expect(Number(line.line_amount)).toBeCloseTo(
        line.qty * Number(line.unit_price),
      );
      sum += Number(line.line_amount);
    }
    expect(Number(n.claim.total_amount)).toBeCloseTo(sum);
  });

  it("throws when a denial references a missing claim line", () => {
    const { pairs } = parseBundle(generateBundle("partialDenial", SEED));
    const pair = pairs[0]!;
    const broken = {
      ...pair,
      claimResponse: {
        ...pair.claimResponse,
        item: [
          {
            itemSequence: 999,
            adjudication: [
              {
                category: { coding: [{ code: "denied" }] },
                reason: { coding: [{ code: "TWD-D01" }] },
                amount: { value: 10, currency: "SAR" },
              },
            ],
          },
        ],
      },
    } as unknown as ClaimPair;
    expect(() => normalize(broken, CTX)).toThrow(/line/i);
  });
});
