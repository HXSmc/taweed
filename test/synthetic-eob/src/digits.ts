import type { DigitSet } from "./scenarios.js";

const WESTERN_TO_ARABIC_INDIC: Record<string, string> = {
  "0": "٠",
  "1": "١",
  "2": "٢",
  "3": "٣",
  "4": "٤",
  "5": "٥",
  "6": "٦",
  "7": "٧",
  "8": "٨",
  "9": "٩",
};

/** Converts every ASCII digit in `s` to its Arabic-Indic (U+0660-U+0669) form. */
export function toArabicIndicDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => WESTERN_TO_ARABIC_INDIC[d]!);
}

/**
 * Renders a number as a digit string per the scenario's digit set. `slot` is a
 * deterministic (not RNG-based) position counter used only to alternate
 * scripts for "mixed" — even slots render Western, odd slots render
 * Arabic-Indic, guaranteeing both scripts appear in any textLayer that formats
 * more than one number, regardless of seed.
 */
export function formatDigits(
  value: number | string,
  digitSet: DigitSet,
  slot: number,
): string {
  const western = String(value);
  if (digitSet === "western") return western;
  if (digitSet === "arabicIndic") return toArabicIndicDigits(western);
  return slot % 2 === 0 ? western : toArabicIndicDigits(western);
}
