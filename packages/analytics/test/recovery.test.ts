import { describe, it, expect } from "vitest";
import { resolveRecovery } from "@taweed/analytics";

// EXECUTE B8 — recovery integrity. Recovered SAR is attributed conservatively and
// can NEVER exceed the appealed (denied) amount (design-brief §8.5). This is the
// pure guardrail the recovery server action wraps.

describe("resolveRecovery — outcome gating", () => {
  it("attributes no recovered money to a lost appeal", () => {
    const r = resolveRecovery({ outcome: "lost", appealedSar: "1000.00" });
    expect(r.recoveredSar).toBeNull();
    expect(r.corrected).toBe(false);
  });

  it("attributes no recovered money to a submitted (in-flight) appeal", () => {
    const r = resolveRecovery({ outcome: "submitted", appealedSar: "1000.00" });
    expect(r.recoveredSar).toBeNull();
  });
});

describe("resolveRecovery — conservative attribution on a win", () => {
  it("defaults a win with no stated amount to the full appealed amount (the ceiling)", () => {
    const r = resolveRecovery({ outcome: "won", appealedSar: "1234.56" });
    expect(r.recoveredSar).toBe("1234.56");
    expect(r.corrected).toBe(false);
  });

  it("accepts a partial recovery at or below the appealed amount unchanged", () => {
    const r = resolveRecovery({
      outcome: "won",
      appealedSar: "1000.00",
      requestedRecoveredSar: "600.00",
    });
    expect(r.recoveredSar).toBe("600.00");
    expect(r.corrected).toBe(false);
  });
});

describe("resolveRecovery — recovered-exceeds-appealed guardrail (§8.5)", () => {
  it("clamps a recovered amount above the appealed amount and flags the correction", () => {
    const r = resolveRecovery({
      outcome: "won",
      appealedSar: "1000.00",
      requestedRecoveredSar: "1500.00",
    });
    expect(r.recoveredSar).toBe("1000.00");
    expect(r.corrected).toBe(true);
    expect(r.reason).toBe("exceeds-appealed");
  });

  it("clamps a negative recovered amount to zero and flags it", () => {
    const r = resolveRecovery({
      outcome: "won",
      appealedSar: "1000.00",
      requestedRecoveredSar: "-50.00",
    });
    expect(r.recoveredSar).toBe("0.00");
    expect(r.corrected).toBe(true);
    expect(r.reason).toBe("negative");
  });

  it("does no float drift on the ledger halala", () => {
    const r = resolveRecovery({
      outcome: "won",
      appealedSar: "0.30",
      requestedRecoveredSar: "0.10",
    });
    expect(r.recoveredSar).toBe("0.10");
  });
});
