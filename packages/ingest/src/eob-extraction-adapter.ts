// AI-4 — EOB vision-extraction is a typed adapter stub, mirroring the pdf-ocr.ts
// seam but for a distinct concern: structured-field extraction from an EOB PDF
// via a vision-capable LLM (Claude), not Tesseract OCR. The two seams stay in
// separate files because they solve different problems and will be wired to
// different adapters at DEPLOY (Tesseract vs. an Anthropic vision call built on
// packages/ai's runStructured/parseStructured — see packages/ai/src/features/
// authorRule.ts for that call shape). This file must NOT import from
// packages/ai: packages/ingest has no dependency on packages/ai, so the result
// payload is `unknown` and the caller (which depends on both packages) is
// responsible for validating/casting it against @taweed/ai's EobExtractionSchema.
//
// Not a Batches-API seam: runStructured/parseStructured are inherently
// synchronous request/response already, and the Batches API is never
// ZDR-eligible, so no real adapter built behind this should introduce a
// Batches call path.
//
// TODO(ai-route): wire a real EobExtractionAdapter (Claude vision extraction)
// behind this and drop the throw.

export interface EobExtractionResult {
  /** Raw extracted payload, unvalidated. Cast against @taweed/ai's EobExtractionSchema at the call site. */
  data: unknown;
  /** Which model tier actually produced this result. */
  modelTier: "sonnet" | "opus";
  /** True when a low-confidence sonnet pass triggered an opus re-run. */
  escalated: boolean;
  /** Model-reported confidence 0..1 for the extraction. */
  confidence: number;
  /**
   * Concrete provider model id that produced `data`, for audit/provenance
   * (e.g. the eob_extractions row's `model` column). OPTIONAL: this seam must
   * stay adapter-agnostic (packages/ingest has no dependency on packages/ai),
   * and a non-LLM adapter (e.g. Azure Document Intelligence) has no natural
   * "model id" in this sense. LLM-backed adapters (createClaudeVisionOcrAdapter)
   * populate it; a caller persisting to eob_extractions must supply its own
   * fallback when an adapter omits it.
   */
  model?: string;
  /**
   * sha256 of the exact prompt TEMPLATE used to produce `data` (see
   * @taweed/ai's ExtractEobResult.promptSha256 doc comment for the exact hash
   * formula). Same optionality reasoning as `model` above.
   */
  promptSha256?: string;
  /**
   * The deterministic validator report (@taweed/ai's ValidatorReport) that
   * `escalated`/`confidence` were actually derived from — untyped here
   * (`unknown`, stored as-is in jsonb) so this seam never imports
   * @taweed/ai's type. A caller MUST persist THIS report verbatim rather than
   * recomputing one independently: recomputing without the exact textLayer
   * the adapter used (and without its no-textLayer text-match filtering) can
   * disagree with the `escalated`/`confidence` already derived from it,
   * producing an internally inconsistent record.
   */
  validatorReport?: unknown;
}

export interface EobExtractionAdapter {
  extract(
    pdfBytes: Uint8Array,
    opts?: { hiRes?: boolean; textLayer?: string },
  ): Promise<EobExtractionResult>;
}

export async function extractEobFromPdf(
  pdfBytes: Uint8Array,
  adapter?: EobExtractionAdapter,
  opts?: { hiRes?: boolean; textLayer?: string },
): Promise<EobExtractionResult> {
  if (!adapter) {
    throw new Error(
      "EOB vision extraction not wired: inject an EobExtractionAdapter (Claude vision) at DEPLOY. TODO(ai-route).",
    );
  }
  return adapter.extract(pdfBytes, opts);
}
