import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@taweed/shared";
import { getPool, withTenant, schema, type Pool } from "@taweed/db";
import { appConnectionString } from "../../db/test/migrate.js";
import { explainFlag, type ExplainableFlag } from "@taweed/ai";

// LIVE smoke eval for the AI-1 explainer (plan 04 §6). Calls the REAL Anthropic
// API + a real Postgres, so it is double-gated: (1) it lives under packages/ai/
// evals/ which CI never runs (CI is --project unit / integration only), and
// (2) it is skipped unless AI_EVALS_LIVE=1. Requires ANTHROPIC_API_KEY (BLK-AI-2)
// and DATABASE_URL pointed at a migrated DB. It asserts the output contract and
// the design-brief §4.3 digit law (no Arabic-Indic digits survive post-processing).

const LIVE = process.env.AI_EVALS_LIVE === "1";
const adminUrl = process.env.DATABASE_URL ?? "";
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

const FLAG: ExplainableFlag = {
  ruleId: "preauth-required",
  ruleVersion: 1,
  ruleName: "Pre-authorization required",
  field: "hasPreAuth",
  severity: "high",
  message_en: "This service requires pre-authorization before submission.",
  message_ar: "هذه الخدمة تتطلب موافقة مسبقة قبل الإرسال.",
};

const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/;

describe.skipIf(!LIVE || !adminUrl || !hasKey)(
  "explainFlag LIVE eval (AI_EVALS_LIVE=1 + ANTHROPIC_API_KEY + DATABASE_URL)",
  () => {
    let adminPool: Pool;
    let appPool: Pool;
    const tenant = newId();

    beforeAll(async () => {
      adminPool = getPool(adminUrl);
      appPool = getPool(appConnectionString(adminUrl));
      const client = await adminPool.connect();
      try {
        await client.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
          tenant,
          "Eval Tenant",
        ]);
      } finally {
        client.release();
      }
      await withTenant(appPool, tenant, (db) =>
        db.insert(schema.tenantAiSettings).values({
          tenant_id: tenant,
          ai_enabled: true,
        }),
      );
    }, 60_000);

    afterAll(async () => {
      const client = await adminPool.connect();
      try {
        await client.query("DELETE FROM llm_calls WHERE tenant_id = $1", [tenant]);
        await client.query("DELETE FROM flag_explanations WHERE tenant_id = $1", [tenant]);
        await client.query("DELETE FROM tenant_ai_settings WHERE tenant_id = $1", [tenant]);
        await client.query("DELETE FROM tenants WHERE id = $1", [tenant]);
      } finally {
        client.release();
      }
      await appPool.end();
      await adminPool.end();
    });

    it("returns a non-empty bilingual explanation with Western digits", async () => {
      const result = await explainFlag({
        actor: "eval-runner",
        tenantId: tenant,
        pool: appPool,
        flag: FLAG,
        env: {
          TAWEED_AI_ENABLED: "true",
          TAWEED_AI_EXPLAIN_ENABLED: "true",
        },
      });

      for (const value of Object.values(result)) {
        expect(value.length).toBeGreaterThan(0);
      }
      // Digit law: post-processing normalized any Arabic-Indic digits to Western.
      expect(ARABIC_INDIC_DIGITS.test(result.explanation_ar)).toBe(false);
      expect(ARABIC_INDIC_DIGITS.test(result.suggested_fix_ar)).toBe(false);
    }, 60_000);
  },
);
