import type { EobExtractionAdapter, EobExtractionResult } from "../eob-extraction-adapter.js";

// AI-4 fallback-ladder seam (plan 04 §9 step 6) — Azure Document Intelligence
// as an alternative EobExtractionAdapter, alongside packages/ai's
// createClaudeVisionOcrAdapter (the current real implementation). This class
// is a pure typed stub: no request is ever made, no config is read. It exists
// so the eventual production-route decision (self-host VLM vs Claude-ZDR vs
// in-Kingdom Claude vs Azure Doc Intel, gated on BLK-AI-1/3/4 per the plan) is
// a swap of which adapter gets injected at DEPLOY, not a rewrite of the seam.
//
// Mirrors pdf-ocr.ts's ocrEob throw-stub tone/pattern exactly (see that file).
//
// TODO(ai-route): wire a real AzureDocIntelOcrAdapter (Azure Document
// Intelligence's prebuilt or custom model) behind this and drop the throw.

export class AzureDocIntelOcrAdapter implements EobExtractionAdapter {
  async extract(): Promise<EobExtractionResult> {
    throw new Error("TODO(ai-route): AzureDocIntelOcrAdapter not wired");
  }
}
