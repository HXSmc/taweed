import { describe, it, expect } from "vitest";
import {
  extractEobFromPdf,
  type EobExtractionAdapter,
  type EobExtractionResult,
} from "@taweed/ingest";

// AI-4 — EOB vision-extraction seam. packages/ingest must not depend on
// packages/ai, so this adapter returns `data: unknown`; the caller (which has
// both packages as deps) validates/casts it against @taweed/ai's
// EobExtractionSchema. Mirrors the ocrEob adapter-injection shape exactly.

describe("extractEobFromPdf", () => {
  it("throws a clear wiring error when no adapter is injected", async () => {
    const pdfBytes = new Uint8Array([1, 2, 3]);

    await expect(extractEobFromPdf(pdfBytes)).rejects.toThrow(
      /EOB vision extraction not wired/,
    );
  });

  it("delegates to the injected adapter and passes its result through unchanged", async () => {
    const pdfBytes = new Uint8Array([1, 2, 3]);
    const expected: EobExtractionResult = {
      data: { claimNumber: "CLM-1" },
      modelTier: "sonnet",
      escalated: false,
      confidence: 0.92,
    };
    const stubAdapter: EobExtractionAdapter = {
      extract: async () => expected,
    };

    const result = await extractEobFromPdf(pdfBytes, stubAdapter);

    expect(result).toBe(expected);
  });

  it("forwards opts (hiRes/textLayer) through to the adapter's extract call", async () => {
    const pdfBytes = new Uint8Array([1, 2, 3]);
    let received: { hiRes?: boolean; textLayer?: string } | undefined;
    const stubAdapter: EobExtractionAdapter = {
      extract: async (_bytes, opts) => {
        received = opts;
        return {
          data: null,
          modelTier: "sonnet",
          escalated: false,
          confidence: 1,
        };
      },
    };

    await extractEobFromPdf(pdfBytes, stubAdapter, {
      hiRes: true,
      textLayer: "some text",
    });

    expect(received).toEqual({ hiRes: true, textLayer: "some text" });
  });
});
