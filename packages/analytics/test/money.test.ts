import { describe, expect, it } from "vitest";
import { cumulativePareto, sumMoney, toSar } from "../src/money.js";

// Money is a Postgres numeric carried as a string. All arithmetic here must be
// exact (integer halalas internally) — the canonical float-drift trap is
// 0.1 + 0.2 !== 0.3 in IEEE-754, which MUST NOT leak into money output.

describe("sumMoney", () => {
  const cases: ReadonlyArray<{ name: string; values: string[]; want: string }> =
    [
      { name: "empty sums to zero", values: [], want: "0.00" },
      { name: "single value is normalized", values: ["123.45"], want: "123.45" },
      {
        name: "0.1 + 0.2 has no float drift",
        values: ["0.1", "0.2"],
        want: "0.30",
      },
      {
        name: "many two-decimal values",
        values: ["10.00", "20.00", "30.00"],
        want: "60.00",
      },
      { name: "integer string (no decimals)", values: ["100"], want: "100.00" },
      { name: "one-decimal padded", values: ["1.5", "2.50"], want: "4.00" },
      {
        name: "sub-halala accumulation stays exact",
        values: ["0.01", "0.02", "0.03"],
        want: "0.06",
      },
      {
        name: "negatives (adjustments) net out",
        values: ["-5.00", "10.00"],
        want: "5.00",
      },
      {
        name: "large numeric(14,2) values do not overflow",
        values: ["999999999999.99", "0.01"],
        want: "1000000000000.00",
      },
    ];

  it.each(cases)("$name", ({ values, want }) => {
    expect(sumMoney(values)).toBe(want);
  });
});

describe("toSar", () => {
  const cases: ReadonlyArray<{ halalas: number; want: string }> = [
    { halalas: 0, want: "0.00" },
    { halalas: 12345, want: "123.45" },
    { halalas: 100, want: "1.00" },
    { halalas: 5, want: "0.05" },
    { halalas: 99, want: "0.99" },
    { halalas: -12345, want: "-123.45" },
    { halalas: -5, want: "-0.05" },
  ];

  it.each(cases)("$halalas -> $want", ({ halalas, want }) => {
    expect(toSar(halalas)).toBe(want);
  });
});

describe("cumulativePareto", () => {
  it("returns [] for no rows", () => {
    expect(cumulativePareto([])).toEqual([]);
  });

  it("returns [100] for a single row", () => {
    expect(cumulativePareto([{ sar: "50.00", count: 3 }])).toEqual([100]);
  });

  it("accumulates descending and reaches exactly 100", () => {
    const got = cumulativePareto([
      { sar: "60.00", count: 1 },
      { sar: "30.00", count: 1 },
      { sar: "10.00", count: 1 },
    ]);
    expect(got).toEqual([60, 90, 100]);
  });

  it("sorts by sar descending before accumulating", () => {
    const got = cumulativePareto([
      { sar: "10.00", count: 1 },
      { sar: "60.00", count: 1 },
      { sar: "30.00", count: 1 },
    ]);
    expect(got).toEqual([60, 90, 100]);
  });

  it("rounds to two decimals and still lands on 100", () => {
    const got = cumulativePareto([
      { sar: "1.00", count: 1 },
      { sar: "1.00", count: 1 },
      { sar: "1.00", count: 1 },
    ]);
    expect(got).toEqual([33.33, 66.67, 100]);
  });

  it("returns zeros instead of NaN when the total is zero", () => {
    const got = cumulativePareto([
      { sar: "0.00", count: 1 },
      { sar: "0.00", count: 1 },
    ]);
    expect(got).toEqual([0, 0]);
  });
});
