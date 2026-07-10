import { chromium } from "@playwright/test";
import type { GeneratedEobItem } from "./generate.js";

// Rasterizes synthetic-EOB HTML (generate.ts's buildHtmlTemplate output) into
// real PDF bytes via headless Chromium. This is what lets the AI-4 vision
// extraction eval harness (packages/ai/evals/extractEob.eval.ts) feed genuine
// PDF documents to a model instead of throwing on a not-yet-built rasterizer
// seam. WHY Playwright/Chromium instead of a PDF-generation library: the
// corpus's ground truth is defined as HTML (bilingual, RTL-aware for Arabic
// scenarios) — a real browser engine is the only reliable way to lay out and
// paginate that HTML exactly as a human/PDF viewer would, including RTL
// shaping and mixed Western/Arabic-Indic digit runs, before capturing it as a
// PDF. This module is eval-harness-only tooling: it must never be imported
// from apps/web's live server-action runtime path.
//
// @playwright/test is already a devDependency of apps/web (test:e2e); this
// package adds the SAME already-locked version as its own devDependency
// rather than introducing a new package.

/**
 * Renders an HTML document to a base64-encoded PDF using headless Chromium.
 * Launches a fresh browser per call (this is eval-harness batch tooling, not
 * a hot request path — simplicity over pooling) and always tears it down,
 * even on error.
 */
export async function renderHtmlToPdfBase64(html: string): Promise<string> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({ format: "A4" });
    return pdfBuffer.toString("base64");
  } finally {
    await browser.close();
  }
}

/**
 * Thin wrapper matching packages/ai/evals/extractEob.eval.ts's PdfRenderer
 * shape: takes a generated corpus item, rasterizes its `htmlTemplate`.
 */
export async function renderEobItemToPdfBase64(item: GeneratedEobItem): Promise<string> {
  return renderHtmlToPdfBase64(item.htmlTemplate);
}
