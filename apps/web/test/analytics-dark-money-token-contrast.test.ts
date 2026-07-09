import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Regression test (axe:color-contrast finding, /en/analytics and /ar/analytics,
// dark theme): `--at-risk-text` and `--recovered-text` were defined in `:root`
// (light theme, AA-passing) but never retuned inside the `.dark` override
// block in app/globals.css. Dark mode therefore inherited the light hex
// values against dark surfaces:
//   --at-risk-text  #9a3208 vs --surface-1 #131316  => ~2.5:1  (needs 4.5:1)
//   --recovered-text #07734f vs --surface-1 #131316 => ~3.15:1 (needs 4.5:1)
// This hit the analytics hero "At risk" money figure, the top-denial-reasons
// counts, the leak-by-payer amounts, the at-risk "SAR" badge, and the
// command-bar "Recovered" figure (money-indicator.tsx) — a systemic token
// gap, not a one-off, reproduced identically in EN-dark and AR-dark (RTL).
//
// This test parses the real app/globals.css (not a copy) so it fails again
// if the `.dark` override for either token is ever removed or weakened.

const CSS_PATH = path.resolve(__dirname, "../app/globals.css");

function readCssBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`selector ${selector} not found in globals.css`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

function readVar(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`${name} not found in block`);
  return match[1];
}

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL_TEXT_MIN = 4.5;

describe("Analytics dark-theme money tokens — WCAG AA contrast", () => {
  const css = readFileSync(CSS_PATH, "utf-8");
  const root = readCssBlock(css, ":root");
  const dark = readCssBlock(css, ".dark");

  it("defines dark-mode overrides for --at-risk-text and --recovered-text (not just :root)", () => {
    // Regression guard: these must exist *inside* `.dark`, not merely be
    // inherited from `:root` — that inheritance is exactly the original bug.
    expect(dark).toMatch(/--at-risk-text:\s*#[0-9a-fA-F]{6}/);
    expect(dark).toMatch(/--recovered-text:\s*#[0-9a-fA-F]{6}/);

    const lightAtRiskText = readVar(root, "--at-risk-text");
    const darkAtRiskText = readVar(dark, "--at-risk-text");
    const lightRecoveredText = readVar(root, "--recovered-text");
    const darkRecoveredText = readVar(dark, "--recovered-text");

    // The dark override must actually differ from light — an override that
    // just repeats the light (AA-failing-on-dark-surfaces) hex would pass
    // the regex above while still reproducing the finding.
    expect(darkAtRiskText.toLowerCase()).not.toBe(lightAtRiskText.toLowerCase());
    expect(darkRecoveredText.toLowerCase()).not.toBe(lightRecoveredText.toLowerCase());
  });

  it("meets 4.5:1 against --surface-1 and its own --*-bg token in dark theme", () => {
    const darkSurface1 = readVar(dark, "--surface-1");
    const darkAtRiskBg = readVar(dark, "--at-risk-bg");
    const darkRecoveredBg = readVar(dark, "--recovered-bg");
    const darkAtRiskText = readVar(dark, "--at-risk-text");
    const darkRecoveredText = readVar(dark, "--recovered-text");

    // Hero figure / reason counts / payer amounts render on --surface-1.
    expect(contrastRatio(darkAtRiskText, darkSurface1)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT_MIN,
    );
    expect(contrastRatio(darkRecoveredText, darkSurface1)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT_MIN,
    );

    // The "SAR" at-risk badge and recovered badge render on their own -bg tint.
    expect(contrastRatio(darkAtRiskText, darkAtRiskBg)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT_MIN,
    );
    expect(contrastRatio(darkRecoveredText, darkRecoveredBg)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT_MIN,
    );
  });
});
