import { describe, it, expect } from "vitest";
import { selectRulesForClaim, type ScrubRule } from "@taweed/rules-engine";

// EXECUTE B7 — rules tunable + versioned per payer. selectRulesForClaim resolves
// which rules apply to a given claim: global always; a payer rule only when its
// payerId matches (or it is unbound); a tenant rule only for its tenant.

function rule(over: Partial<ScrubRule>): ScrubRule {
  return {
    id: "R",
    name: "r",
    scope: "global",
    version: 1,
    severity: "warn",
    weight: 10,
    field: "f",
    message_en: "en",
    message_ar: "ع",
    conditions: { all: [] },
    ...over,
  };
}

describe("selectRulesForClaim", () => {
  const global = rule({ id: "G", scope: "global" });
  const payerA = rule({ id: "PA", scope: "payer", payerId: "PAYER-A" });
  const payerB = rule({ id: "PB", scope: "payer", payerId: "PAYER-B" });
  const payerAny = rule({ id: "PANY", scope: "payer", payerId: null });
  const tenantT = rule({ id: "TT", scope: "tenant", tenantId: "TEN-1" });
  const all = [global, payerA, payerB, payerAny, tenantT];

  it("always includes global rules", () => {
    const ids = selectRulesForClaim(all, { payerId: "PAYER-A" }).map((r) => r.id);
    expect(ids).toContain("G");
  });

  it("includes a payer rule only for its own payer", () => {
    const ids = selectRulesForClaim(all, { payerId: "PAYER-A" }).map((r) => r.id);
    expect(ids).toContain("PA");
    expect(ids).not.toContain("PB");
  });

  it("includes an unbound (payerId null) payer rule for every payer", () => {
    expect(
      selectRulesForClaim(all, { payerId: "PAYER-A" }).map((r) => r.id),
    ).toContain("PANY");
    expect(
      selectRulesForClaim(all, { payerId: "PAYER-Z" }).map((r) => r.id),
    ).toContain("PANY");
  });

  it("includes a tenant rule only for its own tenant", () => {
    expect(
      selectRulesForClaim(all, { payerId: "PAYER-A", tenantId: "TEN-1" }).map(
        (r) => r.id,
      ),
    ).toContain("TT");
    expect(
      selectRulesForClaim(all, { payerId: "PAYER-A", tenantId: "TEN-2" }).map(
        (r) => r.id,
      ),
    ).not.toContain("TT");
  });

  it("resolves versions: with two active versions of a rule key, keeps the highest", () => {
    const v1 = rule({ id: "K", scope: "payer", payerId: "PAYER-A", version: 1, weight: 40 });
    const v2 = rule({ id: "K", scope: "payer", payerId: "PAYER-A", version: 2, weight: 55 });
    const picked = selectRulesForClaim([v1, v2], { payerId: "PAYER-A" });
    expect(picked).toHaveLength(1);
    expect(picked[0]!.version).toBe(2);
    expect(picked[0]!.weight).toBe(55);
  });
});
