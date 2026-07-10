import { chromium } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { generateEobGroundTruth, renderHtmlToPdfBase64 } from "@taweed/synthetic-eob";

// This suite launches a real headless Chromium to rasterize synthetic-EOB HTML
// into PDF bytes. CI's "quality" job runs `pnpm test` (vitest --project unit,
// which globs this file) WITHOUT installing Playwright browsers — only the
// separate e2e job does that (see .github/workflows/ci.yml). Rather than add a
// whole new vitest project for one file, probe chromium launchability once at
// module load and skip the whole suite cleanly (not fail-red) when it can't
// launch, so this stays green in environments without the browser binary.
const chromiumAvailable = await (async (): Promise<boolean> => {
  try {
    const browser = await chromium.launch();
    await browser.close();
    return true;
  } catch {
    console.warn(
      "[rasterize.test.ts] chromium.launch() failed — skipping PDF rasterization tests " +
        "(Playwright browser binary not installed in this environment).",
    );
    return false;
  }
})();

const PDF_MAGIC_BYTES = "%PDF-";
const MIN_PDF_BYTE_LENGTH = 500;

describe.skipIf(!chromiumAvailable)("renderHtmlToPdfBase64", () => {
  it("rasterizes a clean-scenario synthetic EOB into a byte-valid PDF", async () => {
    const item = generateEobGroundTruth("clean", 1000);

    const result = await renderHtmlToPdfBase64(item.htmlTemplate);

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    const decoded = Buffer.from(result, "base64");
    expect(decoded.subarray(0, 5).toString("ascii")).toBe(PDF_MAGIC_BYTES);
    expect(decoded.length).toBeGreaterThan(MIN_PDF_BYTE_LENGTH);
  }, 30_000);

  it("rasterizes the arabicHeavy (RTL, Arabic text) scenario into a byte-valid PDF", async () => {
    // Most likely to break silently on encoding/RTL issues, so it gets its own
    // assertion of the same byte-validity invariants as the clean scenario.
    const item = generateEobGroundTruth("arabicHeavy", 1001);

    const result = await renderHtmlToPdfBase64(item.htmlTemplate);

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    const decoded = Buffer.from(result, "base64");
    expect(decoded.subarray(0, 5).toString("ascii")).toBe(PDF_MAGIC_BYTES);
    expect(decoded.length).toBeGreaterThan(MIN_PDF_BYTE_LENGTH);
  }, 30_000);
});
