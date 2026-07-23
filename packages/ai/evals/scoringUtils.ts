// Shared primitives across the eval-suite scoring modules (extracted
// 2026-07-24 — hub-verification review found the digit-law regex and the
// division-by-zero-guarded rate calculation independently copy-pasted across
// explainFlagScoring.ts/assistAppealScoring.ts/authorRuleScoring.ts). Pure,
// no dependencies.

// Western (0-9) is fine; Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹)
// must never survive AR post-processing — same digit-law regex production
// code's postprocess-ar.ts normalizer targets.
export const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/;

/** Fraction of `checks` matching `pred`; 0 (not NaN) for an empty batch. */
export function rate<T>(checks: readonly T[], pred: (c: T) => boolean): number {
  return checks.length === 0 ? 0 : checks.filter(pred).length / checks.length;
}

/** Arithmetic mean of `fn(check)` over `checks`; 0 for an empty batch. */
export function average<T>(checks: readonly T[], fn: (c: T) => number): number {
  return checks.length === 0
    ? 0
    : checks.reduce((sum, c) => sum + fn(c), 0) / checks.length;
}
