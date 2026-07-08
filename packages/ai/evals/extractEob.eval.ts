import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { newId } from "@taweed/shared";
import { getPool, withTenant, schema, type Pool } from "@taweed/db";
import { appConnectionString } from "../../db/test/migrate.js";
import { extractEob } from "@taweed/ai";
import { generateAllEob, type GeneratedEobItem } from "@taweed/synthetic-eob";
import { EobExtractionSchema } from "../src/schemas/eobExtraction.js";
import {
  scoreEobExtraction,
  buildTierReport,
  tierReportRow,
  EVAL_TARGET_THRESHOLDS,
  type EvalModelTier,
  type TierReport,
} from "./scoring.js";

// LIVE production-gate eval for AI-4 EOB extraction (plan 04 §9, §6 step 6).
// Field-level exact-match scoring (amounts/codes/ids — see ./scoring.ts for
// the identifier-based matching policy) over the synthetic corpus, run per
// model tier. Same double gate as explainFlag.eval.ts: this file lives under
// packages/ai/evals/ (its own vitest project — CI runs --project unit and
// --project integration only, never `evals`), AND is additionally skipped
// unless AI_EVALS_LIVE=1 + ANTHROPIC_API_KEY + DATABASE_URL are all present.
//
// THIS FILE HAS NEVER RUN A LIVE SCORED PASS. It cannot: the synthetic corpus
// (test/synthetic-eob) only produces `htmlTemplate` strings, and rasterizing
// that HTML into PDF bytes is an explicit, not-yet-built TODO(ai-route) seam
// (see test/synthetic-eob/src/generate.ts's buildHtmlTemplate). The
// `renderEobToPdfBase64` hook below is injectable for exactly that reason —
// once a rasterizer lands, inject it here and this harness runs unchanged.
// Until then, the default renderer throws a clear, actionable error rather
// than fabricating PDF bytes from raw HTML (which a vision model would not
// treat as a real PDF) or silently skipping with a fake passing report.
//
// EVAL_TARGET_THRESHOLDS (>=98% amounts, >=95% overall — plan 04 §9 step 6,
// "suggest ... tune with the golden data") are printed in the report for
// comparison ONLY. Nothing in this file asserts a live run must clear them —
// this is a documented target for a human to evaluate against, not a CI gate
// on a model's actual accuracy (that would make routine model-quality drift
// look like a broken build). The `it.each` assertions below check the
// HARNESS's own plumbing (a report row exists per tier, per-document scores
// were recorded for the whole corpus) — never the model's accuracy number.
//
// Calls extractEob() directly per tier ("sonnet"/"opus"), NOT through
// createClaudeVisionOcrAdapter's escalation ladder — that adapter conflates
// tiers with a pass/fail retry policy; this eval wants each tier's raw
// accuracy scored independently, with no auto-escalation hiding a weak tier.

const LIVE = process.env.AI_EVALS_LIVE === "1";
const adminUrl = process.env.DATABASE_URL ?? "";
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

const CORPUS_SIZE = 40;
const MODEL_TIERS: readonly EvalModelTier[] = ["sonnet", "opus"];
const REPORT_DIR = new URL("./.output/", import.meta.url);

type PdfRenderer = (item: GeneratedEobItem) => Promise<string>;

// TODO(ai-route): inject a real HTML->PDF/PNG rasterizer once one exists; see
// the file header. Deliberately throws rather than faking PDF bytes.
const notWiredRenderer: PdfRenderer = async () => {
  throw new Error(
    "EOB corpus rasterization not wired: this eval needs a PdfRenderer " +
      "(HTML->PDF/PNG) injected to produce real PDF bytes from the synthetic " +
      "corpus's htmlTemplate before it can call extractEob(). TODO(ai-route) " +
      "— see test/synthetic-eob/src/generate.ts's buildHtmlTemplate.",
  );
};

function writeJsonReport(fileName: string, report: unknown): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(new URL(fileName, REPORT_DIR), JSON.stringify(report, null, 2));
}

describe.skipIf(!LIVE || !adminUrl || !hasKey)(
  "extractEob LIVE eval (AI_EVALS_LIVE=1 + ANTHROPIC_API_KEY + DATABASE_URL)",
  () => {
    let adminPool: Pool;
    let appPool: Pool;
    const tenant = newId();
    const renderer: PdfRenderer = notWiredRenderer;

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
        await client.query("DELETE FROM tenant_ai_settings WHERE tenant_id = $1", [tenant]);
        await client.query("DELETE FROM tenants WHERE id = $1", [tenant]);
      } finally {
        client.release();
      }
      await appPool.end();
      await adminPool.end();
    });

    it.each(MODEL_TIERS)(
      "scores the synthetic EOB corpus at the %s tier against documented targets",
      async (tier) => {
        const corpus = generateAllEob(CORPUS_SIZE);
        const scores = [];

        for (const item of corpus) {
          const expected = EobExtractionSchema.parse(item.extraction);
          // Throws today (see notWiredRenderer) — this is the intended,
          // honest failure mode until rasterization exists. It surfaces
          // immediately on the FIRST corpus item, before any model/network
          // call is attempted.
          const pdfBase64 = await renderer(item);

          const result = await extractEob({
            actor: "eval-runner",
            tenantId: tenant,
            pool: appPool,
            model: tier,
            input: { pdfBase64, docId: `${item.scenario}-${item.seed}` },
            env: {
              TAWEED_AI_ENABLED: "true",
              TAWEED_AI_EXTRACT_EOB_ENABLED: "true",
            },
          });

          scores.push(scoreEobExtraction(expected, result.extraction));
        }

        const report: TierReport = buildTierReport(tier, corpus.length, scores);
        console.table([tierReportRow(report)]);
        writeJsonReport(`extractEob-${tier}.json`, {
          ...report,
          documentedTargets: EVAL_TARGET_THRESHOLDS,
        });

        // Harness-plumbing assertions only — NOT a model-accuracy gate (see
        // file header). A live run that reaches this point has one report
        // row covering the whole corpus.
        expect(report.tier).toBe(tier);
        expect(report.scenarioCount).toBe(corpus.length);
        expect(scores.length).toBe(corpus.length);
      },
      120_000,
    );
  },
);
