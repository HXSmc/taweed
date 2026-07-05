import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { newId } from "@taweed/shared";
import { getPool, withTenant, schema, type Pool } from "@taweed/db";
import { migrate, appConnectionString } from "../../db/test/migrate.js";
import { explainFlag, type ExplainableFlag } from "../src/features/explainFlag.js";
import { AiDisabledError } from "../src/errors.js";
import type { LlmProvider } from "../src/provider.js";
import type { FlagExplanation } from "../src/schemas/flagExplanation.js";

const adminUrl = process.env.DATABASE_URL ?? "";
const adminPool: Pool = getPool(adminUrl);
const pool: Pool = getPool(appConnectionString(adminUrl));

const tenantA = newId();
const tenantB = newId();

const ENABLED = {
  TAWEED_AI_ENABLED: "true",
  TAWEED_AI_EXPLAIN_ENABLED: "true",
} as const;

const FLAG: ExplainableFlag = {
  ruleId: "preauth-required",
  ruleVersion: 2,
  ruleName: "Pre-authorization required",
  field: "hasPreAuth",
  severity: "high",
  message_en: "This service requires pre-authorization.",
  message_ar: "هذه الخدمة تتطلب موافقة مسبقة.",
};

// Raw model output with Arabic-Indic digits + a Latin code, to prove the AR
// post-processor runs before persist (design-brief §4.3).
const RAW_OUTPUT: FlagExplanation = {
  explanation_en: "Payer requires pre-auth for this service.",
  explanation_ar: "يتطلب الدافع موافقة مسبقة رقم ٤٢ للرمز SBS-0002.",
  suggested_fix_en: "Attach the approval number and resubmit.",
  suggested_fix_ar: "أرفق رقم الموافقة ٤٢ وأعد الإرسال.",
};

type StubBehavior =
  | { kind: "ok"; output: FlagExplanation }
  | { kind: "parsedNull" }
  | { kind: "throws" };

function makeStubProvider(behavior: StubBehavior): {
  provider: LlmProvider;
  calls: () => number;
} {
  let calls = 0;
  const provider: LlmProvider = {
    name: "stub",
    mapModelId: (m) => `stub-${m}`,
    capabilities: { batches: false, files: false },
    client: {
      async parseStructured<T>() {
        calls += 1;
        if (behavior.kind === "throws") throw new Error("stub provider boom");
        if (behavior.kind === "parsedNull") {
          return {
            parsed: null,
            model: "stub-haiku",
            requestId: "stub-req",
            usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 },
            latencyMs: 1,
            rawOutput: "",
          };
        }
        return {
          parsed: behavior.output as unknown as T,
          model: "stub-haiku",
          requestId: "stub-req-1",
          usage: { inputTokens: 5, outputTokens: 8, cacheReadTokens: 0 },
          latencyMs: 1,
          rawOutput: JSON.stringify(behavior.output),
        };
      },
    },
  };
  return { provider, calls: () => calls };
}

async function seedTenant(id: string, name: string): Promise<void> {
  const client = await adminPool.connect();
  try {
    await client.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
      id,
      name,
    ]);
  } finally {
    client.release();
  }
}

async function llmCallCount(tenantId: string): Promise<number> {
  return withTenant(pool, tenantId, async (db) => {
    const rows = await db.select().from(schema.llmCalls);
    return rows.length;
  });
}

beforeAll(async () => {
  await migrate(adminPool);
  await seedTenant(tenantA, "Clinic A");
  await seedTenant(tenantB, "Clinic B");
}, 60_000);

afterAll(async () => {
  await pool.end();
  await adminPool.end();
});

describe("explainFlag — audited dedupe cache over Postgres (RLS active)", () => {
  const stub = makeStubProvider({ kind: "ok", output: RAW_OUTPUT });

  it("generates once, normalizes AR output, and writes one hashes-only llm_calls row", async () => {
    const result = await explainFlag({
      actor: "user-a",
      tenantId: tenantA,
      pool,
      flag: FLAG,
      provider: stub.provider,
      env: ENABLED,
    });

    // AR post-processing applied: Arabic-Indic digits normalized to Western.
    expect(result.explanation_ar).toContain("42");
    expect(result.explanation_ar).not.toContain("٤٢");
    expect(stub.calls()).toBe(1);

    await withTenant(pool, tenantA, async (db) => {
      const explanations = await db.select().from(schema.flagExplanations);
      const calls = await db.select().from(schema.llmCalls);

      expect(explanations).toHaveLength(1);
      expect(explanations[0]!.rule_id).toBe("preauth-required");
      expect(explanations[0]!.explanation_ar).toContain("42");

      expect(calls).toHaveLength(1);
      expect(calls[0]!.purpose).toBe("explain");
      expect(calls[0]!.provider).toBe("stub");
      expect(calls[0]!.model).toBe("stub-haiku");
      expect(calls[0]!.input_tokens).toBe(5);
      // hashes only — 64-hex, never raw prompt/output.
      expect(calls[0]!.prompt_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(calls[0]!.output_sha256).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  it("returns the cached explanation without a second model call or audit row", async () => {
    const result = await explainFlag({
      actor: "user-a",
      tenantId: tenantA,
      pool,
      flag: FLAG,
      provider: stub.provider,
      env: ENABLED,
    });

    expect(result.explanation_en).toBe(RAW_OUTPUT.explanation_en);
    expect(stub.calls()).toBe(1); // no new model call

    await withTenant(pool, tenantA, async (db) => {
      const explanations = await db.select().from(schema.flagExplanations);
      const calls = await db.select().from(schema.llmCalls);
      expect(explanations).toHaveLength(1); // still one
      expect(calls).toHaveLength(1); // still one — cache hit made no call
    });
  });

  it("fails closed with AiDisabledError when the feature env flag is off", async () => {
    const stub2 = makeStubProvider({ kind: "ok", output: RAW_OUTPUT });
    await expect(
      explainFlag({
        actor: "user-a",
        tenantId: tenantA,
        pool,
        flag: FLAG,
        provider: stub2.provider,
        env: {},
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
    expect(stub2.calls()).toBe(0);
  });

  it("honors the per-tenant kill switch and writes no call for that tenant", async () => {
    const stub3 = makeStubProvider({ kind: "ok", output: RAW_OUTPUT });
    await withTenant(pool, tenantB, async (db) => {
      await db.insert(schema.tenantAiSettings).values({
        tenant_id: tenantB,
        ai_enabled: false,
      });
    });

    await expect(
      explainFlag({
        actor: "user-b",
        tenantId: tenantB,
        pool,
        flag: FLAG,
        provider: stub3.provider,
        env: ENABLED,
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
    expect(stub3.calls()).toBe(0);

    await withTenant(pool, tenantB, async (db) => {
      // RLS isolation: tenant B never sees tenant A's cached explanation.
      const explanations = await db.select().from(schema.flagExplanations);
      const calls = await db.select().from(schema.llmCalls);
      expect(explanations).toHaveLength(0);
      expect(calls).toHaveLength(0);
    });
  });

  it("audits a schema-parse failure (call happened) and caches nothing", async () => {
    const before = await llmCallCount(tenantA);
    const stub4 = makeStubProvider({ kind: "parsedNull" });
    await expect(
      explainFlag({
        actor: "user-a",
        tenantId: tenantA,
        pool,
        flag: { ...FLAG, ruleVersion: 99 },
        provider: stub4.provider,
        env: ENABLED,
      }),
    ).rejects.toThrow(/schema validation/);
    expect(stub4.calls()).toBe(1);

    const after = await llmCallCount(tenantA);
    expect(after).toBe(before + 1); // audit row written despite the failure
    await withTenant(pool, tenantA, async (db) => {
      const rows = await db
        .select()
        .from(schema.flagExplanations)
        .where(eqVersion(99));
      expect(rows).toHaveLength(0); // nothing cached on a parse failure
    });
  });

  it("audits a provider exception (request left the boundary) then rethrows", async () => {
    const before = await llmCallCount(tenantA);
    const stub5 = makeStubProvider({ kind: "throws" });
    await expect(
      explainFlag({
        actor: "user-a",
        tenantId: tenantA,
        pool,
        flag: { ...FLAG, ruleVersion: 98 },
        provider: stub5.provider,
        env: ENABLED,
      }),
    ).rejects.toThrow(/boom/);

    const after = await llmCallCount(tenantA);
    expect(after).toBe(before + 1); // audit row written for the failed attempt
    await withTenant(pool, tenantA, async (db) => {
      const errRows = await db
        .select()
        .from(schema.llmCalls)
        .where(errorState());
      expect(errRows.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// Small local drizzle predicate helpers (kept below the suite for readability).
function eqVersion(v: number) {
  return and(
    eq(schema.flagExplanations.rule_id, "preauth-required"),
    eq(schema.flagExplanations.rule_version, v),
  );
}
function errorState() {
  return eq(schema.llmCalls.flags_state, "explain=error");
}
