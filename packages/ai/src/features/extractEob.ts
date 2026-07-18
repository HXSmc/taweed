import "server-only";
import type { Pool } from "@taweed/db";
import { normalizeArabicOutput } from "../postprocess-ar.js";
import { sha256Hex } from "../sha256.js";
import { runStructured, resolveAiGate } from "../run.js";
import type { LlmProvider } from "../provider.js";
import type { TaweedModel } from "../models.js";
import {
  EobExtractionSchema,
  type EobExtraction,
} from "../schemas/eobExtraction.js";

// AI-4 — payer EOB/remittance PDF -> structured extraction (plan 04 §4.1, §9).
// GENERATION ONLY, same posture as authorRule.ts's draft and eob-validators.ts's
// comment: this function transcribes a candidate EobExtraction from a payer
// remittance PDF. It does not persist anything, does not cross-check a single
// number, and decides nothing. The caller MUST run the returned extraction
// through eob-validators.ts's validateEobExtraction (cross-total identities,
// verbatim text-layer match after digit/bidi normalization, enum membership)
// before any human or downstream system trusts a field — exactly the
// deterministic gate authorRule.ts uses for rules and assistAppeal.ts uses for
// appeal paragraphs. Nothing here is a substitute for that gate.
//
// Money on the wire is INTEGER HALALAS (see schemas/eobExtraction.ts's header
// comment) so the model does exact integer arithmetic. @taweed/shared's
// ClaimRow/ClaimLineRow (and friends) store money as SAR STRINGS (Postgres
// numeric), NOT halalas — any caller persisting this extraction into that
// shape MUST convert at the boundary via @taweed/analytics's
// moneyToHalalas(value: string): number / toSar(halalas: number): string.
// This function performs no such conversion; it only returns the model's wire
// contract.
//
// This call path is SYNCHRONOUS ONLY: runStructured -> provider.client.
// parseStructured (a single request/response). There is no Batches call path
// anywhere in this codebase (run.ts/provider.ts never construct one), and
// Batches is explicitly NOT ZDR-eligible (plan 04 §3.3) — a PHI-adjacent
// extraction call must never take that path, so none is introduced here.
//
// Model routing is Sonnet-first, Opus-escalation (plan 04 §4.1 cost digest:
// even all-Opus pilot volume is cheap, but Sonnet-first is the sweet spot) —
// opts.model defaults to "sonnet"; a caller/confidence-routing adapter can
// pass "opus" to retry a low-confidence extraction with the stronger model.
//
// anthropic-1p.ts's client-level default timeout (30s) is sized for the
// explainer's tiny payload — a PDF attachment (up to 15 MiB) plus a large
// max_tokens response is a materially heavier vision workload, so this call
// overrides the timeout per-request rather than sharing that default.
const EXTRACT_EOB_TIMEOUT_MS = 90_000;

// maxTokens headroom (bumped 8192 -> 32768, 2026-07-18): Claude Sonnet 5 runs
// ADAPTIVE THINKING ON BY DEFAULT (no `thinking` field needed to trigger it,
// unlike the prior Sonnet 4.6 generation) and that thinking budget is drawn
// from the SAME max_tokens ceiling as the actual response — confirmed via a
// live repro against the docs/test-fixtures/eob-4-dense-large-remittance.pdf
// fixture (8 claims x 6 lines = 48 lines): a real call hit
// `stop_reason: "max_tokens"` after only 3148 of the 8192-token budget went
// to thinking, truncating the structured-output JSON mid-string and throwing
// a hard parse error — extraction failed OUTRIGHT on a document only
// moderately larger than every other scenario in the corpus, not just scored
// lower. Re-run at 32768 completed naturally (`stop_reason: "end_turn"`,
// 11022 total tokens used, ~3x headroom) with a byte-valid extraction. This
// is a real production robustness gap, not an eval-only concern: a genuine
// design-partner remittance bundling many claims would hit the same wall.
const EXTRACT_EOB_MAX_TOKENS = 32_768;

export interface ExtractEobInput {
  /** the remittance PDF, base64-encoded — no `data:` URI prefix, no embedded newlines (claude-api skill's documented PDF content-block shape). */
  pdfBase64: string;
  /**
   * caller-assigned identifier for this document — a correlation id for the
   * caller's own logs/UI. NOTE this IS embedded in the user prompt sent to the
   * model (buildUserPrompt below) and IS therefore part of `promptSha256`
   * (system+user) — despite being named/positioned like a pure log
   * correlation id, it is model-visible content. The one caller in this
   * codebase (claude-vision-ocr.ts) always passes a random `newId()`, never
   * anything patient-correlated; any future caller MUST do the same — never
   * pass a real document/claim/patient identifier here.
   */
  docId: string;
  /**
   * Escalation hint for a RE-extraction after a prior pass failed
   * eob-validators.ts's deterministic gate. This codebase has no separate
   * high-DPI PDF-rendering path (the same PDF bytes are sent both times), so
   * "hi-res" here means "read more carefully" — it appends an instruction to
   * the user prompt asking the model to re-check every digit rather than
   * skim. Optional and additive; omitted/false is the default first-pass
   * behavior (identical to before this field existed).
   */
  hiRes?: boolean;
}

export interface ExtractEobOptions {
  actor: string;
  tenantId: string;
  pool: Pool;
  input: ExtractEobInput;
  /** Sonnet-first (default); pass "opus" to escalate a low-confidence retry. */
  model?: Extract<TaweedModel, "sonnet" | "opus">;
  /** Test/dev injection; defaults to the anthropic-1p provider on the live path. */
  provider?: LlmProvider;
  env?: NodeJS.ProcessEnv;
}

export interface ExtractEobResult {
  /** the normalized, UNVALIDATED extraction — caller MUST run eob-validators.ts's validateEobExtraction before trusting any field. */
  extraction: EobExtraction;
  /** concrete provider model id, for provenance alongside the extraction. */
  model: string;
  /**
   * sha256 of the exact system+user INSTRUCTION prompt (matching the llm_calls
   * audit hash formula in run.ts) — it identifies the prompt TEMPLATE, not the
   * attached document (the document's bytes are never hashed into this value;
   * see StructuredRequest.documents' doc comment in provider.ts). Per-call /
   * per-document identity is the pair (this hash, the caller's own docId) —
   * the provider's requestId is also available via the llm_calls audit row.
   */
  promptSha256: string;
}

const SYSTEM_PROMPT = [
  "You extract structured data from a payer explanation-of-benefits (EOB) / remittance-advice PDF for Saudi Arabian medical claims (NPHIES).",
  "You output ONLY the structured extraction defined by the schema — payer identity, remittance totals, and each claim's service lines with billed/paid/rejected amounts and any denial code.",
  "",
  "HARD CONSTRAINTS (safety-critical):",
  "- This is a MECHANICAL transcription task, not a clinical or adjudication judgment. Never infer, correct, or second-guess the payer's decision — report exactly what the document states.",
  "- Every amount, code, date, and identifier MUST be read verbatim from the document. Never estimate, round, interpolate, or invent a value that is not legible in the source.",
  "- Money amounts are INTEGER HALALAS (1 SAR = 100 halalas), computed from the document's stated SAR amounts — never a decimal SAR string.",
  "- denialCode must be one of the recognized denial reason codes; use null when the document shows no denial or a code outside that registry — never guess a nearby code.",
  "- If a field is not present or not legible in the document, use null rather than guessing.",
  "- confidence / overallConfidence (0-1) reflect how legible and unambiguous the source text is for that field — lower it whenever the document is blurry, cropped, low-contrast, or ambiguous.",
].join("\n");

function buildUserPrompt(docId: string, hiRes?: boolean): string {
  const lines = [
    `Document reference (for your awareness only — not part of the document): ${docId}`,
    "",
    "The attached PDF is a payer EOB/remittance advice. Extract every claim and",
    "its service lines into the structured extraction per the hard constraints",
    "above.",
  ];
  if (hiRes) {
    lines.push(
      "",
      "This is a RE-EXTRACTION: an earlier automated pass on this same document",
      "failed a deterministic consistency check. Read every amount, code, and",
      "identifier again with extra care — verify each digit individually rather",
      "than skimming, and do not repeat a value you are not confident about.",
    );
  }
  return lines.join("\n");
}

// AR post-processing (design-brief §4.3 digit law) on the one genuinely
// free-text field the model can emit (payerName). Everything else on the wire
// is either a code/id (must stay byte-exact — normalizing could corrupt an
// SBS/ICD/denial code) or an enum/number already constrained by the schema.
function normalizeExtraction(extraction: EobExtraction): EobExtraction {
  return {
    ...extraction,
    payerName:
      extraction.payerName === null
        ? null
        : normalizeArabicOutput(extraction.payerName),
  };
}

/**
 * Extract a candidate EobExtraction from a payer remittance PDF. Throws
 * AiDisabledError when any kill switch is off (the caller falls back to manual
 * entry / OCR) and AiConfigError when the feature is on but no provider is
 * configured. The returned extraction is UNVALIDATED — the caller MUST run it
 * through eob-validators.ts's validateEobExtraction gate before any field is
 * trusted or persisted.
 */
export async function extractEob(
  opts: ExtractEobOptions,
): Promise<ExtractEobResult> {
  const env = opts.env ?? process.env;

  const provider = await resolveAiGate({
    feature: "extractEob",
    env,
    pool: opts.pool,
    tenantId: opts.tenantId,
    provider: opts.provider,
  });

  const model = opts.model ?? "sonnet";
  const system = SYSTEM_PROMPT;
  const user = buildUserPrompt(opts.input.docId, opts.input.hiRes);
  // Same hash formula as the audited runner (run.ts) — identifies the prompt
  // TEMPLATE (see ExtractEobResult.promptSha256 doc comment above), not the
  // attached PDF bytes.
  const promptSha256 = sha256Hex(`${system}\n${user}`);

  const parsed = await runStructured<EobExtraction>({
    actor: opts.actor,
    feature: "extractEob",
    pool: opts.pool,
    tenantId: opts.tenantId,
    provider,
    env,
    req: {
      model,
      system,
      user,
      documents: [{ base64: opts.input.pdfBase64 }],
      schema: EobExtractionSchema,
      schemaName: "EobExtraction",
      maxTokens: EXTRACT_EOB_MAX_TOKENS,
      cacheSystem: true,
      timeoutMs: EXTRACT_EOB_TIMEOUT_MS,
    },
  });

  return {
    extraction: normalizeExtraction(parsed),
    model: provider.mapModelId(model),
    promptSha256,
  };
}
