import type { EobExtractionAdapter, EobExtractionResult } from "@taweed/ingest";

// AI-4 fallback-ladder seam (plan 04 §9 step 6) — a self-hosted vision-
// language model as an alternative EobExtractionAdapter, alongside this same
// package's createClaudeVisionOcrAdapter (the current real implementation;
// see adapters/claude-vision-ocr.ts for its type-only import of
// EobExtractionAdapter from @taweed/ingest, mirrored here). This class is a
// pure typed stub: no request is ever made, no model is loaded. It exists so
// the eventual production-route decision (self-host VLM vs Claude-ZDR vs
// in-Kingdom Claude vs Azure Doc Intel, gated on BLK-AI-1/3/4 per the plan) is
// a swap of which adapter gets injected at DEPLOY, not a rewrite of the seam.
//
// Mirrors packages/ingest/src/pdf-ocr.ts's ocrEob throw-stub tone/pattern
// exactly (see that file).
//
// TODO(ai-route): wire a real SelfHostedVlmAdapter (an in-Kingdom or
// self-hosted vision-language model deployment) behind this and drop the
// throw.

export class SelfHostedVlmAdapter implements EobExtractionAdapter {
  async extract(): Promise<EobExtractionResult> {
    throw new Error("TODO(ai-route): SelfHostedVlmAdapter not wired");
  }
}
