import { describe, it, expect } from "vitest";
import type { Pool } from "@taweed/db";
import { authorRule } from "../src/features/authorRule.js";
import { ScrubRuleDraftSchema } from "../src/schemas/scrubRuleDraft.js";
import { AiDisabledError } from "../src/errors.js";

// AI-3 — the kill switches must short-circuit BEFORE any DB or provider access
// when the feature is off, exactly like AI-1. The full audited path (provider +
// RLS + author gate) is covered in authorRule.int.test.ts against real Postgres.

const UNREACHABLE_POOL = new Proxy(
  {},
  {
    get() {
      throw new Error("pool must not be accessed when the feature is off");
    },
  },
) as unknown as Pool;

const INPUT = {
  smeText: "Flag any claim over SAR 1000 that has no prior authorization.",
  scope: { scope: "global" as const },
};

describe("authorRule feature kill switch (fails closed before any DB/provider access)", () => {
  it("throws AiDisabledError when the global switch is off", async () => {
    await expect(
      authorRule({
        actor: "u1",
        tenantId: "t1",
        pool: UNREACHABLE_POOL,
        input: INPUT,
        env: {},
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
  });

  it("throws AiDisabledError when the feature flag is off (global on)", async () => {
    await expect(
      authorRule({
        actor: "u1",
        tenantId: "t1",
        pool: UNREACHABLE_POOL,
        input: INPUT,
        env: { TAWEED_AI_ENABLED: "true" },
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
  });
});

describe("ScrubRuleDraftSchema", () => {
  const wellFormed = {
    name: "High-value claim without pre-auth",
    severity: "high",
    field: "hasPreAuth",
    message_en: "High-value claim without prior authorization.",
    message_ar: "مطالبة عالية القيمة دون موافقة مسبقة.",
    weight: 45,
    conditions: {
      all: [
        { fact: "hasPreAuth", operator: "equal", value: false },
        { fact: "totalAmount", operator: "greaterThanInclusive", value: 1000 },
      ],
    },
    rationale: "High-value claims usually require pre-auth.",
  };

  it("accepts a well-formed flat draft", () => {
    expect(ScrubRuleDraftSchema.safeParse(wellFormed).success).toBe(true);
  });

  it("accepts a nested all/any tree within the depth bound", () => {
    const nested = {
      ...wellFormed,
      conditions: {
        any: [
          { fact: "isDuplicate", operator: "equal", value: true },
          {
            all: [
              { fact: "hasPreAuth", operator: "equal", value: false },
              { fact: "totalAmount", operator: "greaterThan", value: 500 },
            ],
          },
        ],
      },
    };
    expect(ScrubRuleDraftSchema.safeParse(nested).success).toBe(true);
  });

  it("rejects an unregistered fact (enum-constrained)", () => {
    const bad = {
      ...wellFormed,
      conditions: { all: [{ fact: "ssn", operator: "equal", value: "x" }] },
    };
    expect(ScrubRuleDraftSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unregistered operator (enum-constrained)", () => {
    const bad = {
      ...wellFormed,
      conditions: { all: [{ fact: "totalAmount", operator: "evalThis", value: 1 }] },
    };
    expect(ScrubRuleDraftSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown severity", () => {
    expect(
      ScrubRuleDraftSchema.safeParse({ ...wellFormed, severity: "critical" }).success,
    ).toBe(false);
  });
});
