import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@taweed/shared";
import { getPool, withTenant, schema, type Pool } from "@taweed/db";
import { migrate, appConnectionString } from "../../db/test/migrate.js";
import { authorRule } from "../src/features/authorRule.js";
import { AiDisabledError } from "../src/errors.js";
import type { LlmProvider } from "../src/provider.js";
import type { ScrubRuleDraft } from "../src/schemas/scrubRuleDraft.js";

const adminUrl = process.env.DATABASE_URL ?? "";
const adminPool: Pool = getPool(adminUrl);
const pool: Pool = getPool(appConnectionString(adminUrl));

const tenantA = newId();
const tenantB = newId();

const ENABLED = {
  TAWEED_AI_ENABLED: "true",
  TAWEED_AI_AUTHOR_RULE_ENABLED: "true",
} as const;

// A draft the model would return — carries an Arabic-Indic digit in the AR message
// to prove the digit-law post-processor runs before the draft is returned.
const RAW_DRAFT: ScrubRuleDraft = {
  name: "High-value claim without pre-auth",
  severity: "high",
  field: "hasPreAuth",
  message_en: "High-value claim over 1000 submitted without prior authorization.",
  message_ar: "مطالبة تتجاوز ١٠٠٠ ريال دون موافقة مسبقة.",
  weight: 45,
  conditions: {
    all: [
      { fact: "hasPreAuth", operator: "equal", value: false },
      { fact: "totalAmount", operator: "greaterThanInclusive", value: 1000 },
    ],
  },
  rationale: "High-value claims usually require prior authorization.",
};

function stubProvider(behavior: "ok" | "throws"): {
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
        if (behavior === "throws") throw new Error("stub author boom");
        return {
          parsed: RAW_DRAFT as unknown as T,
          model: "stub-opus",
          requestId: "stub-req-1",
          usage: { inputTokens: 20, outputTokens: 60, cacheReadTokens: 0 },
          latencyMs: 1,
          rawOutput: JSON.stringify(RAW_DRAFT),
        };
      },
    },
  };
  return { provider, calls: () => calls };
}

async function seedTenant(id: string, name: string): Promise<void> {
  const client = await adminPool.connect();
  try {
    await client.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [id, name]);
  } finally {
    client.release();
  }
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

describe("authorRule — audited NL->draft over Postgres (RLS active)", () => {
  it("returns a digit-normalized draft and writes one author_rule llm_calls row", async () => {
    const stub = stubProvider("ok");
    const result = await authorRule({
      actor: "rcm-a",
      tenantId: tenantA,
      pool,
      input: {
        smeText: "Flag any claim over SAR 1000 with no prior authorization.",
        scope: { scope: "global" },
      },
      provider: stub.provider,
      env: ENABLED,
    });

    expect(stub.calls()).toBe(1);
    // Digit law applied to the AR message (Arabic-Indic -> Western).
    expect(result.draft.message_ar).toContain("1000");
    expect(result.draft.message_ar).not.toContain("١٠٠٠");
    // Condition tree passes through untouched.
    expect(result.draft.conditions).toEqual(RAW_DRAFT.conditions);
    // Provenance surfaced for the rules-table row + linked to the audit hash.
    expect(result.model).toBe("stub-opus");
    expect(result.promptSha256).toMatch(/^[0-9a-f]{64}$/);

    await withTenant(pool, tenantA, async (db) => {
      const calls = await db.select().from(schema.llmCalls);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.purpose).toBe("author_rule");
      expect(calls[0]!.provider).toBe("stub");
      expect(calls[0]!.model).toBe("stub-opus");
      expect(calls[0]!.prompt_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(calls[0]!.output_sha256).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  it("honors the per-tenant kill switch without any model call", async () => {
    const stub = stubProvider("ok");
    await withTenant(pool, tenantB, async (db) => {
      await db.insert(schema.tenantAiSettings).values({
        tenant_id: tenantB,
        ai_enabled: false,
      });
    });
    await expect(
      authorRule({
        actor: "rcm-b",
        tenantId: tenantB,
        pool,
        input: { smeText: "anything", scope: { scope: "global" } },
        provider: stub.provider,
        env: ENABLED,
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
    expect(stub.calls()).toBe(0);
    await withTenant(pool, tenantB, async (db) => {
      const calls = await db.select().from(schema.llmCalls);
      expect(calls).toHaveLength(0);
    });
  });

  it("audits a provider exception then rethrows", async () => {
    const stub = stubProvider("throws");
    await expect(
      authorRule({
        actor: "rcm-a",
        tenantId: tenantA,
        pool,
        input: { smeText: "x", scope: { scope: "global" } },
        provider: stub.provider,
        env: ENABLED,
      }),
    ).rejects.toThrow(/boom/);
    await withTenant(pool, tenantA, async (db) => {
      const errRows = await db.select().from(schema.llmCalls);
      // the earlier ok-call plus this error attempt.
      expect(errRows.length).toBeGreaterThanOrEqual(2);
    });
  });
});
