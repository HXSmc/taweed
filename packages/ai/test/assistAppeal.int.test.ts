import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@taweed/shared";
import { getPool, withTenant, schema, type Pool } from "@taweed/db";
import { migrate, appConnectionString } from "../../db/test/migrate.js";
import { assistAppeal } from "../src/features/assistAppeal.js";
import { AiDisabledError } from "../src/errors.js";
import type { LlmProvider, StructuredRequest } from "../src/provider.js";
import type { AppealAssist, AppealVerify } from "../src/schemas/appealAssist.js";

const adminUrl = process.env.DATABASE_URL ?? "";
const adminPool: Pool = getPool(adminUrl);
const pool: Pool = getPool(appConnectionString(adminUrl));

const tenantA = newId();
const tenantB = newId();

const ENABLED = {
  TAWEED_AI_ENABLED: "true",
  TAWEED_AI_APPEAL_ENABLED: "true",
} as const;

const INPUT = {
  facts: {
    claimRef: "NPH-2026-0042",
    sbsCode: "SBS-0002",
    denialCode: "TWD-D02",
    atRiskSar: "1500.00",
    serviceDate: "2026-01-15",
  },
  memberId: "M-77777",
  payerName: "Tawuniya",
  denialReasonLabel: "Prior authorization missing",
};

// Clean assist: references facts ONLY via digit-free tokens + the pseudonym token.
const CLEAN_ASSIST: AppealAssist = {
  paragraphs_en: [
    "We appeal the denial of claim [CLAIM_REF] for member [MEMBER_ID_1]; a valid prior authorization applies to service [CODE_SBS].",
    "The amount at risk, SAR [AMOUNT_DENIED], is a covered benefit; we request re-adjudication.",
  ],
  paragraphs_ar: [
    "نعترض على رفض المطالبة [CLAIM_REF] للمشترك [MEMBER_ID_1]؛ تسري موافقة مسبقة على الخدمة [CODE_SBS].",
    "المبلغ المعرَّض للخطر [AMOUNT_DENIED] ريال منفعة مغطاة، ونطلب إعادة النظر.",
  ],
};

// Invented number in the prose — the deterministic gate must suppress it.
const DIRTY_ASSIST: AppealAssist = {
  paragraphs_en: ["A valid authorization number 90210 was on file for [CLAIM_REF]."],
  paragraphs_ar: ["رقم الموافقة مرفق للمطالبة [CLAIM_REF]."],
};

const VERIFY_OK: AppealVerify = {
  factual_consistency: 92,
  msa_register: 88,
  completeness: 90,
  overall: 90,
  issues: [],
};
const VERIFY_LOW: AppealVerify = {
  factual_consistency: 40,
  msa_register: 35,
  completeness: 45,
  overall: 42,
  issues: ["weak register"],
};

function stub(assist: AppealAssist, verify: AppealVerify): {
  provider: LlmProvider;
  calls: () => number;
} {
  let calls = 0;
  const provider: LlmProvider = {
    name: "stub",
    mapModelId: (m) => `stub-${m}`,
    client: {
      async parseStructured<T>(req: StructuredRequest<T>) {
        calls += 1;
        const out = req.model === "sonnet" ? verify : assist;
        return {
          parsed: out as unknown as T,
          model: `stub-${req.model}`,
          requestId: `stub-${calls}`,
          usage: { inputTokens: 10, outputTokens: 20, cacheReadTokens: 0 },
          latencyMs: 1,
          rawOutput: JSON.stringify(out),
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

describe("assistAppeal — guarded, audited, detokenized-last (RLS active)", () => {
  it("returns a detokenized bilingual suggestion and audits BOTH model calls", async () => {
    const s = stub(CLEAN_ASSIST, VERIFY_OK);
    const result = await assistAppeal({
      actor: "rcm-a",
      tenantId: tenantA,
      pool,
      input: INPUT,
      provider: s.provider,
      env: ENABLED,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Detokenized: real values present, no tokens leaked.
    const en = result.suggestion.paragraphs_en.join(" ");
    expect(en).toContain("NPH-2026-0042");
    expect(en).toContain("M-77777"); // pseudonym restored last
    expect(en).toContain("SAR 1500.00");
    expect(en).not.toContain("[");
    expect(result.suggestion.paragraphs_ar.join(" ")).not.toContain("[");
    expect(result.verifyScore).toBe(90);
    expect(s.calls()).toBe(2); // generate + verify

    await withTenant(pool, tenantA, async (db) => {
      const calls = await db.select().from(schema.llmCalls);
      expect(calls).toHaveLength(2);
      expect(calls.every((c) => c.purpose === "appeal")).toBe(true);
      // hashes only.
      expect(calls[0]!.prompt_sha256).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  it("suppresses (fail closed) when the model invents a number — verify never runs", async () => {
    const s = stub(DIRTY_ASSIST, VERIFY_OK);
    const result = await assistAppeal({
      actor: "rcm-a",
      tenantId: tenantA,
      pool,
      input: INPUT,
      provider: s.provider,
      env: ENABLED,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("invented-number");
    expect(s.calls()).toBe(1); // only the generate call; verify skipped
  });

  it("suppresses when the second-model verify scores below threshold", async () => {
    const s = stub(CLEAN_ASSIST, VERIFY_LOW);
    const result = await assistAppeal({
      actor: "rcm-a",
      tenantId: tenantA,
      pool,
      input: INPUT,
      provider: s.provider,
      env: ENABLED,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("verify:42");
    expect(s.calls()).toBe(2); // generate + verify both ran
  });

  it("honors the per-tenant kill switch without any model call", async () => {
    const s = stub(CLEAN_ASSIST, VERIFY_OK);
    await withTenant(pool, tenantB, async (db) => {
      await db.insert(schema.tenantAiSettings).values({
        tenant_id: tenantB,
        ai_enabled: false,
      });
    });
    await expect(
      assistAppeal({
        actor: "rcm-b",
        tenantId: tenantB,
        pool,
        input: INPUT,
        provider: s.provider,
        env: ENABLED,
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
    expect(s.calls()).toBe(0);
  });
});
