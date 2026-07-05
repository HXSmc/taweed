// Deterministic Arabic post-processor for any AR text an LLM returns (plan 04
// §4.2 guardrails; design-brief §4.3 "digit law"). Three passes, all pure:
//   1. digit normalization — Arabic-Indic (٠-٩) and Eastern-Arabic-Indic/Persian
//      (۰-۹) → Western 0-9, so money/codes/dates always render in Western digits.
//   2. stray-tashkeel strip — remove harakat the model sometimes over-vocalizes.
//   3. Latin-code isolation — wrap Latin-script codes (SBS-0002, ICD10AM, NPHIES
//      codes) in LRM marks inside RTL text so bidi doesn't scramble them.
// Idempotent: existing bidi marks are stripped before re-isolation.

const LRM = "‎"; // LEFT-TO-RIGHT MARK
const ARABIC_INDIC = /[٠-٩]/g; // ٠ ١ ٢ … ٩
const EASTERN_ARABIC_INDIC = /[۰-۹]/g; // ۰ ۱ ۲ … ۹ (Persian/Urdu)
// Harakat + tanwin + shadda + sukun + superscript alef.
const TASHKEEL = /[ً-ْٰ]/g;
const BIDI_MARKS = /[‎‏؜]/g; // LRM, RLM, ALM
const HAS_ARABIC = /[؀-ۿ]/;
// A Latin-script code run: starts with an ASCII letter, may carry digits and the
// separators codes use. Pure numbers (amounts) are left to natural bidi.
const LATIN_CODE_RUN = /[A-Za-z][A-Za-z0-9._/-]*/g;

export function normalizeArabicDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function stripTashkeel(input: string): string {
  return input.replace(TASHKEEL, "");
}

/**
 * Isolate Latin-script codes with LRM marks — only when the text actually
 * contains Arabic (mixed RTL/LTR is where bidi mis-orders codes). Strips any
 * pre-existing bidi marks first so repeated application is idempotent.
 */
export function isolateLatinRuns(input: string): string {
  const bare = input.replace(BIDI_MARKS, "");
  if (!HAS_ARABIC.test(bare)) return bare;
  return bare.replace(LATIN_CODE_RUN, (m) => `${LRM}${m}${LRM}`);
}

/** Full pipeline applied to any AR string before it reaches the UI. */
export function normalizeArabicOutput(input: string): string {
  return isolateLatinRuns(stripTashkeel(normalizeArabicDigits(input)));
}
