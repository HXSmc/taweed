import { describe, it, expect } from "vitest";
import { recoverabilityByPayerReason, type AppealOutcomeFact } from "@taweed/analytics";

// EXECUTE B7 — recovered-outcome feedback loop (design-brief §10 flywheel). As
// appeals resolve, learn which payer+reason combos actually recover, so the
// scrubber/appeals can prioritize them. Pure aggregation over resolved outcomes.

const OUTCOMES: AppealOutcomeFact[] = [
  { payerId: "P1", reasonCode: "TWD-D02", status: "won" },
  { payerId: "P1", reasonCode: "TWD-D02", status: "won" },
  { payerId: "P1", reasonCode: "TWD-D02", status: "lost" },
  { payerId: "P1", reasonCode: "TWD-D05", status: "lost" },
  { payerId: "P2", reasonCode: "TWD-D02", status: "won" },
  { payerId: "P1", reasonCode: "TWD-D02", status: "submitted" }, // in-flight, ignored
];

describe("recoverabilityByPayerReason", () => {
  it("computes win rate per payer+reason over RESOLVED appeals only", () => {
    const rows = recoverabilityByPayerReason(OUTCOMES);
    const p1d02 = rows.find((r) => r.payerId === "P1" && r.reasonCode === "TWD-D02");
    expect(p1d02).toBeDefined();
    // 2 won, 1 lost, 1 submitted(ignored) -> 2/3.
    expect(p1d02!.won).toBe(2);
    expect(p1d02!.resolved).toBe(3);
    expect(p1d02!.recoveryRate).toBeCloseTo(2 / 3, 5);
  });

  it("a combo that never recovers has rate 0", () => {
    const rows = recoverabilityByPayerReason(OUTCOMES);
    const p1d05 = rows.find((r) => r.payerId === "P1" && r.reasonCode === "TWD-D05");
    expect(p1d05!.recoveryRate).toBe(0);
  });

  it("orders combos by recovery rate descending then volume, so the best bets lead", () => {
    const rows = recoverabilityByPayerReason(OUTCOMES);
    // P2/D02 is 1/1 (rate 1) so it leads P1/D02 (2/3).
    expect(rows[0]!.payerId).toBe("P2");
    expect(rows[0]!.recoveryRate).toBe(1);
  });

  it("returns an empty list when there are no resolved outcomes", () => {
    expect(
      recoverabilityByPayerReason([
        { payerId: "P1", reasonCode: "X", status: "submitted" },
      ]),
    ).toEqual([]);
  });
});
