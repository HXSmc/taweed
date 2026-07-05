import { describe, it, expect } from "vitest";
import type { Database } from "@taweed/db";
import {
  explainFlag,
  assertPhiFreeFlag,
  type ExplainableFlag,
} from "../src/features/explainFlag.js";
import { AiDisabledError } from "../src/errors.js";

const FLAG: ExplainableFlag = {
  ruleId: "preauth-required",
  ruleVersion: 1,
  ruleName: "Pre-authorization required",
  field: "hasPreAuth",
  severity: "high",
  message_en: "This service requires pre-authorization.",
  message_ar: "هذه الخدمة تتطلب موافقة مسبقة.",
};

// A DB stub that fails loudly if ever touched — the kill switch must short-circuit
// before any DB access when the feature is off.
const UNREACHABLE_DB = new Proxy(
  {},
  {
    get() {
      throw new Error("DB must not be accessed when AI is disabled");
    },
  },
) as unknown as Database;

describe("assertPhiFreeFlag", () => {
  it("accepts a well-formed PHI-free flag", () => {
    expect(() =>
      assertPhiFreeFlag({ ...(FLAG as unknown as Record<string, unknown>) }),
    ).not.toThrow();
  });

  it("rejects a claim/patient field leaking into the prompt", () => {
    expect(() =>
      assertPhiFreeFlag({ ...FLAG, patientName: "John Doe", claimId: "c-1" }),
    ).toThrow(/unexpected key "patientName"/);
  });
});

describe("explainFlag kill switch (fails closed, no DB touched)", () => {
  it("throws AiDisabledError when the global switch is off", async () => {
    await expect(
      explainFlag({ actor: "u1", db: UNREACHABLE_DB, flag: FLAG, env: {} }),
    ).rejects.toBeInstanceOf(AiDisabledError);
  });

  it("throws AiDisabledError when the feature flag is off (global on)", async () => {
    await expect(
      explainFlag({
        actor: "u1",
        db: UNREACHABLE_DB,
        flag: FLAG,
        env: { TAWEED_AI_ENABLED: "true" },
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
  });
});
