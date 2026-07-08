import "server-only";
import type { Pool } from "@taweed/db";
import { newId } from "@taweed/shared";
import type {
  EobExtractionAdapter,
  EobExtractionResult,
} from "@taweed/ingest";
import type { LlmProvider } from "../provider.js";
import { isFeatureEnabled } from "../config.js";
import { extractEob } from "../features/extractEob.js";
import {
  validateEobExtraction,
  validateEobExtractionArithmetic,
  type ValidatorReport,
} from "../eob-validators.js";
import type { EobExtraction } from "../schemas/eobExtraction.js";

// AI-4 — the REAL EobExtractionAdapter (plan 04 §9) behind packages/ingest's
// eob-extraction-adapter.ts seam. This file is the first place the three
// AI-4 pieces meet: extractEob.ts (Sonnet-first generation, no accept/reject
// decision of its own), eob-validators.ts (the deterministic gate, also no
// accept/reject decision of its own), and packages/ingest's
// EobExtractionAdapter interface (the seam's `data: unknown` + modelTier /
// escalated / confidence contract). Composing them is this file's entire
// job — it makes exactly one policy decision (retry-once-at-opus-on-failure)
// and otherwise just wires the two together.
//
// Routing policy: Sonnet first, always. If Sonnet FAILS OUTRIGHT (extractEob
// rejects — a schema-parse failure or provider/network error) OR resolves but
// eob-validators reports a failure, retry EXACTLY ONCE at Opus with a
// "hi-res" escalation hint (see ExtractEobInput.hiRes in extractEob.ts — this
// codebase has no separate high-DPI PDF rendering path, so "hi-res" means
// "read more carefully", threaded as an extra instruction in the retry's user
// prompt). If the Opus retry ALSO fails outright, this function still never
// throws: it returns a review-required result (`escalated: true`,
// `confidence: 0`, `data` falling back to Sonnet's own extraction if Sonnet at
// least resolved, otherwise `null`). If the Opus retry resolves, the result is
// returned with `escalated: true` and a confidence capped by how much of the
// deterministic report actually passed. Silently auto-accepting a failing
// extraction would be worse than surfacing it; the actual human gate lives
// downstream (the review-queue UI/wiring) and reads `confidence`/`escalated`
// off the returned result to decide what needs a human look. This adapter's
// only job is to never hide a failure — by resolving with a falsely high
// confidence, OR by throwing and losing the document entirely.
//
// Kill switches (isFeatureEnabled/isTenantAiEnabled/missingProviderConfig)
// live in extractEob.ts and fire before this file ever runs — an
// AiDisabledError/AiConfigError from a call still propagates out of
// `.extract(...)` unchanged (the caller falls back to manual entry/OCR, same
// posture as every other AI-* feature gate). Only a VALIDATOR failure is
// absorbed into `escalated`/`confidence`; a kill-switch/config failure is not
// a validator failure and is not swallowed here.
//
// Not a Batches-API seam, same reasoning as extractEob.ts's header comment:
// both the Sonnet and the Opus call are synchronous runStructured requests;
// no Batches call path is introduced by retrying.

export interface ClaudeVisionOcrAdapterOptions {
  actor: string;
  tenantId: string;
  pool: Pool;
  /** Test/dev injection; defaults to the anthropic-1p provider on the live path (passed through to extractEob). */
  provider?: LlmProvider;
  env?: NodeJS.ProcessEnv;
  /** Test/dev injection so tests never reach the network — defaults to the real extractEob feature fn. */
  extractFn?: typeof extractEob;
}

// eob-validators' text-layer-match findings compare every extracted field
// against a verbatim source text layer. When the caller has no text layer at
// all (e.g. a scanned/non-born-digital PDF with no embedded text), scoring
// against an empty string would make EVERY text-layer-match finding fail
// spuriously — a false signal, not a real one, so this delegates to
// eob-validators.ts's validateEobExtractionArithmetic (shared with
// eob-review.ts's re-check-on-approve path, which also has no text layer on
// hand). When a textLayer IS provided, the full report — including
// text-layer-match — is used unmodified.
function runValidation(
  extraction: EobExtraction,
  textLayer: string | undefined,
): ValidatorReport {
  if (textLayer === undefined) return validateEobExtractionArithmetic(extraction);
  return validateEobExtraction(extraction, textLayer);
}

// extractEob can REJECT outright (runStructured throws when the model's
// output fails Zod validation, or on a provider/network error) rather than
// resolving with a bad report — the most common real failure mode. The
// retry-once-at-opus policy applies identically whether Sonnet failed by
// throwing or by resolving with a validator-failing report: either way the
// caller gets exactly one Opus retry, never a thrown error out of
// `.extract()`. This wraps a single extractFn call and turns a thrown error
// into a tagged outcome instead of letting it propagate.
type ExtractOutcome =
  | { ok: true; result: Awaited<ReturnType<typeof extractEob>> }
  | { ok: false; error: unknown };

async function tryExtract(
  extractFn: typeof extractEob,
  params: Parameters<typeof extractEob>[0],
): Promise<ExtractOutcome> {
  try {
    const result = await extractFn(params);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error };
  }
}

function errorReport(error: unknown): ValidatorReport {
  const detail = error instanceof Error ? error.message : String(error);
  return {
    passed: false,
    findings: [{ check: "extraction-error", passed: false, detail }],
  };
}

// A passing report means the deterministic gate agrees with the model, so
// the model's own self-reported overallConfidence is trustworthy as-is. A
// failing report means the gate found something wrong that the model didn't
// flag — its self-report can no longer be trusted at face value, so the
// returned confidence is capped at the fraction of findings that DID pass.
// This makes "confidence reflects the failure" literal: a near-miss (one bad
// finding among many) still reads as moderately confident, while a mostly-
// broken extraction reads as low-confidence, and neither case can ever
// exceed what the model itself claimed.
function deriveConfidence(
  extraction: EobExtraction,
  report: ValidatorReport,
): number {
  if (report.passed) return extraction.overallConfidence;
  const total = report.findings.length;
  const passedCount = report.findings.filter((f) => f.passed).length;
  const validatorRatio = total === 0 ? 0 : passedCount / total;
  return Math.min(extraction.overallConfidence, validatorRatio);
}

/**
 * The real EobExtractionAdapter: Sonnet-first extraction, gated by
 * eob-validators' deterministic report, with exactly one Opus retry on
 * failure. See the file header for the full retry/never-throw contract.
 */
export function createClaudeVisionOcrAdapter(
  opts: ClaudeVisionOcrAdapterOptions,
): EobExtractionAdapter {
  const extractFn = opts.extractFn ?? extractEob;

  return {
    async extract(pdfBytes, extractOpts): Promise<EobExtractionResult> {
      const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
      const docId = newId();
      const textLayer = extractOpts?.textLayer;

      const sonnetOutcome = await tryExtract(extractFn, {
        actor: opts.actor,
        tenantId: opts.tenantId,
        pool: opts.pool,
        provider: opts.provider,
        env: opts.env,
        model: "sonnet",
        input: { pdfBase64, docId },
      });

      if (sonnetOutcome.ok) {
        const sonnetReport = runValidation(sonnetOutcome.result.extraction, textLayer);
        if (sonnetReport.passed) {
          return {
            data: sonnetOutcome.result.extraction,
            modelTier: "sonnet",
            escalated: false,
            confidence: deriveConfidence(sonnetOutcome.result.extraction, sonnetReport),
            model: sonnetOutcome.result.model,
            promptSha256: sonnetOutcome.result.promptSha256,
            validatorReport: sonnetReport,
          };
        }
      }

      // Exactly ONE re-run at the stronger tier, hi-res — whether Sonnet threw
      // outright or resolved with a validator-failing report.
      const opusOutcome = await tryExtract(extractFn, {
        actor: opts.actor,
        tenantId: opts.tenantId,
        pool: opts.pool,
        provider: opts.provider,
        env: opts.env,
        model: "opus",
        input: { pdfBase64, docId, hiRes: true },
      });

      if (!opusOutcome.ok) {
        // Both tiers failed outright. Never throw: fall back to Sonnet's own
        // extraction if it at least resolved (better than nothing for a human
        // reviewer), otherwise there is no data at all. Either way this is
        // routed for review at the lowest confidence.
        return {
          data: sonnetOutcome.ok ? sonnetOutcome.result.extraction : null,
          modelTier: "opus",
          escalated: true,
          confidence: 0,
          model: sonnetOutcome.ok ? sonnetOutcome.result.model : undefined,
          promptSha256: sonnetOutcome.ok ? sonnetOutcome.result.promptSha256 : undefined,
          validatorReport: errorReport(opusOutcome.error),
        };
      }

      const opusReport = runValidation(opusOutcome.result.extraction, textLayer);

      // Never throws here even if opusReport still fails: the caller always
      // gets a result routed for review via escalated/confidence, per the
      // file header's never-auto-accept contract.
      return {
        data: opusOutcome.result.extraction,
        modelTier: "opus",
        escalated: true,
        confidence: deriveConfidence(opusOutcome.result.extraction, opusReport),
        model: opusOutcome.result.model,
        promptSha256: opusOutcome.result.promptSha256,
        validatorReport: opusReport,
      };
    },
  };
}

/**
 * Feature-gated resolution for the PDF-drop ingest flow (plan 04 §9): returns
 * `undefined` when `isFeatureEnabled("extractEob", env)` is false, and a real
 * `createClaudeVisionOcrAdapter` otherwise. This is deliberately the ONLY new
 * branch the flag-off path adds — a caller that does
 * `extractEobFromPdf(bytes, resolveEobExtractionAdapter(opts))` gets EXACTLY
 * packages/ingest's pre-existing "not wired" throw when the flag is off
 * (`extractEobFromPdf(bytes, undefined)` is untouched, unmodified code), and
 * the real Claude adapter when it is on. No other code path changes shape
 * based on the flag.
 */
export function resolveEobExtractionAdapter(
  opts: ClaudeVisionOcrAdapterOptions,
): EobExtractionAdapter | undefined {
  const env = opts.env ?? process.env;
  if (!isFeatureEnabled("extractEob", env)) return undefined;
  return createClaudeVisionOcrAdapter(opts);
}
