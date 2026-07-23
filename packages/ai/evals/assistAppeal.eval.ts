import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { newId } from "@taweed/shared";
import { getPool, withTenant, schema, type Pool } from "@taweed/db";
import { appConnectionString } from "../../db/test/migrate.js";
import { seedTenant } from "../../db/test/helpers.js";
import { assistAppeal } from "@taweed/ai";
import { ASSIST_APPEAL_CORPUS } from "./assistAppealCorpus.js";
import {
  scoreAssistAppeal,
  buildAssistAppealReport,
  schemaInvalidAssistAppealCheck,
} from "./assistAppealScoring.js";
import { runEvalLoop, buildRunMeta } from "./resilience.js";

// LIVE scoring eval for AI-2 assistAppeal (part of the 4-feature eval suite,
// 2026-07-24). Scores the REAL 3-stage pipeline (generate -> deterministic
// paragraph gate -> self-verify judge) via assistAppealScoring.ts's
// classification of the pipeline's own `reason` string — deliberately NOT
// using the internal self-judge verifyScore as the primary cross-provider
// metric (see that module's header: one provider generating AND grading its
// own output is not comparable to another provider doing the same to ITS OWN
// output). Same double gate as every other eval here: packages/ai/evals/
// (never run in CI), skipped unless AI_EVALS_LIVE=1 + ANTHROPIC_API_KEY +
// DATABASE_URL are all present.
//
// Neither of assistAppeal()'s two runStructured calls (generate, verify) has
// a surrounding try/catch, so a schema-validation failure on either one DOES
// propagate to this eval loop exactly like every other feature — scored as a
// miss via runEvalLoop's schema-invalid handling (resilience.ts), not
// rethrown. (An earlier version of this file incorrectly assumed this case
// couldn't happen here; corrected 2026-07-24 after review found the same
// mistaken assumption already flagged as a real bug on explainFlag.eval.ts.)

const LIVE = process.env.AI_EVALS_LIVE === "1";
const adminUrl = process.env.DATABASE_URL ?? "";
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
const REPORT_DIR = new URL("./.output/", import.meta.url);
const IT_TIMEOUT_MS = 900_000;

function writeJsonReport(fileName: string, report: unknown): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(new URL(fileName, REPORT_DIR), JSON.stringify(report, null, 2));
}

describe.skipIf(!LIVE || !adminUrl || !hasKey)(
  "assistAppeal LIVE eval (AI_EVALS_LIVE=1 + ANTHROPIC_API_KEY + DATABASE_URL)",
  () => {
    let adminPool: Pool;
    let appPool: Pool;
    const tenant = newId();

    beforeAll(async () => {
      adminPool = getPool(adminUrl);
      appPool = getPool(appConnectionString(adminUrl));
      await seedTenant(adminPool, tenant, "Eval Tenant");
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
        await client.query("DELETE FROM tenant_ai_settings WHERE tenant_id = $1", [tenant]);
        await client.query("DELETE FROM tenants WHERE id = $1", [tenant]);
      } finally {
        client.release();
      }
      await appPool.end();
      await adminPool.end();
    });

    it(
      "scores the appeal-facts corpus (objective paragraph-gate pass rate as the primary metric)",
      async () => {
        const loop = await runEvalLoop(
          ASSIST_APPEAL_CORPUS,
          (fixture) => fixture.id,
          (fixture) =>
            assistAppeal({
              actor: "eval-runner",
              tenantId: tenant,
              pool: appPool,
              input: fixture.input,
              env: {
                ...process.env,
                TAWEED_AI_ENABLED: "true",
                TAWEED_AI_APPEAL_ENABLED: "true",
              },
            }),
          (result) => scoreAssistAppeal(result),
          schemaInvalidAssistAppealCheck,
          "[assistAppeal-eval]",
        );

        const report = buildAssistAppealReport("anthropic-1p", loop.checks);
        const meta = buildRunMeta({
          provider: "anthropic-1p",
          model: "claude-opus",
          fullCorpusSize: ASSIST_APPEAL_CORPUS.length,
          scoredCount: loop.checks.length,
          skippedDocIds: loop.skipped,
          stopReason: loop.stopReason,
          latencies: loop.latencies,
        });

        console.table([report]);
        console.log("[assistAppeal-eval] meta:", meta);

        writeJsonReport("assistAppeal-anthropic.json", { ...report, ...meta });

        expect(report.itemCount).toBe(loop.checks.length);
        expect(meta.scoredCount).toBe(loop.checks.length);
      },
      IT_TIMEOUT_MS,
    );
  },
);
