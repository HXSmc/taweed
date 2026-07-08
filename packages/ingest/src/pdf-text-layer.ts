import {
  DOMMatrix as NapiDOMMatrix,
  ImageData as NapiImageData,
  Path2D as NapiPath2D,
} from "@napi-rs/canvas";

// pdf-parse's Node runtime (pdfjs-dist's "legacy" build) needs DOMMatrix /
// ImageData / Path2D for page-viewport transforms, even for plain text
// extraction — pdfjs-dist tries to polyfill these itself from `@napi-rs/canvas`
// via a `require()` relative to ITS OWN package location, but under pnpm's
// strict per-package dependency isolation that require fails silently
// (pdfjs-dist never declares @napi-rs/canvas as its own dependency — only
// pdf-parse does), leaving the globals unset and later code throwing
// "DOMMatrix is not defined". Setting these globals here — from a real
// dependency of THIS package — runs before `pdf-parse` is ever imported
// (dynamic import below, after this module's top-level code has already run),
// so pdfjs-dist's own `if (!globalThis.DOMMatrix)` check finds them already
// set and skips its broken self-polyfill entirely.
const g = globalThis as unknown as {
  DOMMatrix?: unknown;
  ImageData?: unknown;
  Path2D?: unknown;
};
g.DOMMatrix ??= NapiDOMMatrix;
g.ImageData ??= NapiImageData;
g.Path2D ??= NapiPath2D;

// AI-4 — born-digital text-layer extraction (plan 04 §9). eob-validators'
// "text-layer-match" check compares every extracted amount/claim-id against
// the PDF's own embedded text as an independent, non-LLM source-fidelity
// signal — but only when a text layer actually exists. A scanned PDF (image
// only, no embedded text) or a corrupt file has no such layer; that is an
// expected, common case, not an error, so this returns `undefined` rather
// than throwing — callers (see claude-vision-ocr.ts's runValidation) treat
// `undefined` as "skip text-layer-match, score on arithmetic/enum checks
// only" rather than scoring against an empty string, which would otherwise
// make every text-layer-match finding fail spuriously.
export async function extractPdfTextLayer(
  pdfBytes: Uint8Array,
): Promise<string | undefined> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: pdfBytes });
  try {
    const result = await parser.getText();
    const text = result.text.trim();
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  } finally {
    await parser.destroy();
  }
}
