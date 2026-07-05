// EXECUTE B6 — PDF-EOB OCR is a typed adapter stub. Tesseract OCR (build-plan
// §12.1 D) is heavy and environment-bound; we define the seam and inject a real
// adapter at DEPLOY. OCR output is low-confidence by nature, so the review-fields
// step in the ingest UI (design-brief §8.1) is mandatory before these rows persist.
//
// TODO(deploy): wire a real OcrAdapter (Tesseract) behind this and drop the throw.

export interface OcrTextResult {
  /** Extracted plain text, page by page. */
  pages: string[];
  /** Mean OCR confidence 0..1 across recognized words (low => force review). */
  confidence: number;
}

export interface OcrAdapter {
  recognize(pdfBytes: Uint8Array): Promise<OcrTextResult>;
}

export async function ocrEob(
  pdfBytes: Uint8Array,
  adapter?: OcrAdapter,
): Promise<OcrTextResult> {
  if (!adapter) {
    throw new Error(
      "PDF-EOB OCR not wired: inject an OcrAdapter (Tesseract) at DEPLOY. TODO(deploy).",
    );
  }
  return adapter.recognize(pdfBytes);
}
