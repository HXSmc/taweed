import { describe, it, expect } from "vitest";
import { extractPdfTextLayer } from "@taweed/ingest";

// AI-4 — extractPdfTextLayer wraps pdf-parse (a real PDF text-layer reader,
// not a stub) so eob-validators' "text-layer-match" check has a genuine
// independent, non-LLM signal to compare the model's extraction against.

// A hand-built, minimal single-page PDF whose content stream draws the text
// "TAWEED TEST 1234" — small enough to inline, avoids depending on a second
// PDF-authoring library just to test a reader.
const MINIMAL_TEXT_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 200 100] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 58 >>
stream
BT /F1 12 Tf 10 50 Td (TAWEED TEST 1234) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f
trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`,
  "utf-8",
);

describe("extractPdfTextLayer", () => {
  it("extracts the embedded text layer from a born-digital PDF", async () => {
    const text = await extractPdfTextLayer(new Uint8Array(MINIMAL_TEXT_PDF));
    expect(text).toBeDefined();
    expect(text).toContain("TAWEED TEST 1234");
  });

  it("resolves to undefined (not a throw) for bytes with no readable text layer", async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    const text = await extractPdfTextLayer(garbage);
    expect(text).toBeUndefined();
  });
});
