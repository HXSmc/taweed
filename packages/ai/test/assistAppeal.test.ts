import { describe, it, expect } from "vitest";
import type { Pool } from "@taweed/db";
import { assistAppeal } from "../src/features/assistAppeal.js";
import { AiDisabledError } from "../src/errors.js";

// AI-2 — kill switches short-circuit before any DB or provider access, exactly like
// AI-1/AI-3. The full guarded pipeline (pseudonymize -> generate -> gate -> verify
// -> detokenize) is covered in assistAppeal.int.test.ts against real Postgres.

const UNREACHABLE_POOL = new Proxy(
  {},
  {
    get() {
      throw new Error("pool must not be accessed when the feature is off");
    },
  },
) as unknown as Pool;

const INPUT = {
  facts: {
    claimRef: "NPH-1",
    sbsCode: "SBS-0002",
    denialCode: "TWD-D02",
    atRiskSar: "1500.00",
    serviceDate: "2026-01-15",
  },
  memberId: "M-77777",
  payerName: "Tawuniya",
  denialReasonLabel: "Prior authorization missing",
};

describe("assistAppeal feature kill switch (fails closed before any DB/provider access)", () => {
  it("throws AiDisabledError when the global switch is off", async () => {
    await expect(
      assistAppeal({
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
      assistAppeal({
        actor: "u1",
        tenantId: "t1",
        pool: UNREACHABLE_POOL,
        input: INPUT,
        env: { TAWEED_AI_ENABLED: "true" },
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
  });
});
