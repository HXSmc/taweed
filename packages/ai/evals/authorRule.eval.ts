import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { newId } from "@taweed/shared";
import { getPool, withTenant, schema, type Pool } from "@taweed/db";
import { appConnectionString } from "../../db/test/migrate.js";
import { seedTenant } from "../../db/test/helpers.js";
import { authorRule } from "@taweed/ai";
import { SCRUBBER_RULES } from "@taweed/rules-engine";
import { AUTHOR_RULE_CORPUS } from "./authorRuleCorpus.js";
import {
  scoreAuthorRule,
  buildAuthorRuleReport,
  schemaInvalidAuthorRuleCheck,
} from "./authorRuleScoring.js";
import { runEvalLoop, buildRunMeta } from "./resilience.js";

// LIVE scoring eval for AI-3 authorRule (part of the 4-feature eval suite,
// 2026-07-24). Every provider's draft is chained through the REAL
// deterministic gate (rules-engine's validateAuthoredRule — shape check ->
// engine dry-run -> golden-corpus regression, no model involved) as the
// PRIMARY metric: does the draft pass the exact gate a human approval flow
// depends on, not merely "did it parse". See authorRuleScoring.ts for the
// secondary structural comparison. Same double gate as every other eval
// here: packages/ai/evals/ (never run in CI), skipped unless
// AI_EVALS_LIVE=1 + ANTHROPIC_API_KEY + DATABASE_URL are all present.
//
// authorRule()'s runStructured call has no surrounding try/catch, so a
// schema-validation failure DOES propagate here exactly like every other
// feature — scored as a miss via runEvalLoop's schema-invalid handling
// (resilience.ts), not rethrown. (An earlier version of this file
// incorrectly assumed this case couldn't happen; corrected 2026-07-24 after
// review found the same mistaken assumption on explainFlag.eval.ts.)

const LIVE = process.env.AI_EVALS_LIVE === "1";
const adminUrl = process.env.DATABASE_URL ?? "";
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
const REPORT_DIR = new URL("./.output/", import.meta.url);
const IT_TIMEOUT_MS = 600_000;

function writeJsonReport(fileName: string, report: unknown): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(new URL(fileName, REPORT_DIR), JSON.stringify(report, null, 2));
}

describe.skipIf(!LIVE || !adminUrl || !hasKey)(
  "authorRule LIVE eval (AI_EVALS_LIVE=1 + ANTHROPIC_API_KEY + DATABASE_URL)",
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
      "scores the SME-text corpus against the real deterministic approval gate",
      async () => {
        const baseRules = [...SCRUBBER_RULES];

        const loop = await runEvalLoop(
          AUTHOR_RULE_CORPUS,
          (fixture) => fixture.id,
          (fixture) =>
            authorRule({
              actor: "eval-runner",
              tenantId: tenant,
              pool: appPool,
              input: { smeText: fixture.smeText, scope: fixture.scope },
              env: {
                ...process.env,
                TAWEED_AI_ENABLED: "true",
                TAWEED_AI_AUTHOR_RULE_ENABLED: "true",
              },
            }),
          // Scoring (validateAuthoredRule's real engine dry-run + golden
          // regression) is deliberately NOT part of the timed span — see
          // runEvalLoop's doc comment for why this matters specifically for
          // authorRule (real async local compute, unrelated to provider speed).
          (result, fixture) => scoreAuthorRule(result.draft, fixture, baseRules),
          (fixture) => schemaInvalidAuthorRuleCheck(fixture.id),
          "[authorRule-eval]",
        );

        const report = buildAuthorRuleReport("anthropic-1p", loop.checks);
        const meta = buildRunMeta({
          provider: "anthropic-1p",
          model: "claude-opus",
          fullCorpusSize: AUTHOR_RULE_CORPUS.length,
          scoredCount: loop.checks.length,
          skippedDocIds: loop.skipped,
          stopReason: loop.stopReason,
          latencies: loop.latencies,
        });

        console.table([report]);
        console.log("[authorRule-eval] meta:", meta);

        writeJsonReport("authorRule-anthropic.json", { ...report, ...meta });

        expect(report.itemCount).toBe(loop.checks.length);
        expect(meta.scoredCount).toBe(loop.checks.length);
      },
      IT_TIMEOUT_MS,
    );
  },
);
