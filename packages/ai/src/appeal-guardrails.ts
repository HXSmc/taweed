// AI-2 appeal-assist guardrails (plan 04 §4.2). The documented Arabic-LLM risk is
// FACTUAL/VALUE/NAMED-ENTITY error — exactly claim numbers, dates, and codes
// (AraHalluEval, VERIFIED H). The structural defence: the model NEVER sees or
// writes a real number. Every amount/date/code is a DIGIT-FREE slot token; the
// deterministic layer substitutes the real value only after every check. So any
// literal digit in the model's output is, by construction, an invented number —
// and the suggestion is suppressed (fail closed to the template-only path).
//
// Pure + exhaustively unit-tested. No PHI, no I/O.

/** token (e.g. "[AMOUNT_DENIED]") -> the real value substituted in at the end. */
export type SlotMap = Record<string, string>;

/** Bilingual suggestion shape (structurally identical to @taweed/appeals'
 *  AppealSuggestion — kept here so @taweed/ai needs no dependency on @taweed/appeals;
 *  the web layer bridges the two). */
export interface AppealSuggestion {
  paragraphs_en: string[];
  paragraphs_ar: string[];
}

/** The immutable claim facts an appeal argues over — none is written by the model. */
export interface AppealFacts {
  /** payer-facing claim reference (NPHIES id, fallback internal id). */
  claimRef: string;
  sbsCode: string | null;
  denialCode: string;
  /** money string (numeric), e.g. "1500.00". */
  atRiskSar: string;
  serviceDate: string;
}

// DIGIT-FREE tokens. They must contain NO digit, or the no-invented-number check
// (which strips known tokens then scans for digits) could not tell a token's own
// digit from an invented one. Uppercase + underscore only.
const SLOT_TOKENS = {
  claimRef: "[CLAIM_REF]",
  sbsCode: "[CODE_SBS]",
  denialCode: "[CODE_DENIAL]",
  atRiskSar: "[AMOUNT_DENIED]",
  serviceDate: "[DATE_SERVICE]",
} as const;

/**
 * Map the non-PHI facts to digit-free slot tokens. Values are the real
 * amounts/dates/codes (safe — not identifiers); they are substituted back only by
 * detokenizeSlots AFTER all checks. PHI identifiers (member id) are pseudonymized
 * separately (pseudonymize.ts) and merged into the known-token set by the caller.
 */
export function buildFactSlots(facts: AppealFacts): SlotMap {
  const slots: SlotMap = {
    [SLOT_TOKENS.claimRef]: facts.claimRef,
    [SLOT_TOKENS.denialCode]: facts.denialCode,
    [SLOT_TOKENS.atRiskSar]: facts.atRiskSar,
  };
  if (facts.sbsCode) slots[SLOT_TOKENS.sbsCode] = facts.sbsCode;
  if (facts.serviceDate) slots[SLOT_TOKENS.serviceDate] = facts.serviceDate;
  return slots;
}

/** Human-readable slot legend for the prompt (token -> what it means). */
export function slotLegend(facts: AppealFacts): string {
  const lines = [
    `${SLOT_TOKENS.claimRef} = the claim reference`,
    `${SLOT_TOKENS.denialCode} = the denial reason code`,
    `${SLOT_TOKENS.atRiskSar} = the amount at risk (SAR)`,
  ];
  if (facts.sbsCode) lines.push(`${SLOT_TOKENS.sbsCode} = the service (SBS) code`);
  if (facts.serviceDate) lines.push(`${SLOT_TOKENS.serviceDate} = the service date`);
  return lines.map((l) => `- ${l}`).join("\n");
}

// Western (0-9), Arabic-Indic (٠-٩ U+0660–0669), Extended Arabic-Indic (۰-۹ U+06F0–06F9).
const DIGIT_RUN = /[0-9٠-٩۰-۹]+/g;
// Case-INSENSITIVE on purpose: real slot tokens are uppercase, so a case-variant
// like [amount_denied] is NOT in the known set — matching it here lets unknownSlots
// flag it (→ suppress) instead of leaking a literal placeholder past detokenize.
const TOKEN = /\[[A-Za-z0-9_]+\]/g;

/** Remove every known token from the text (so its own chars don't trip the checks). */
function stripKnownTokens(text: string, slots: SlotMap): string {
  let out = text;
  for (const token of Object.keys(slots)) out = out.split(token).join(" ");
  return out;
}

export interface NumberCheck {
  ok: boolean;
  /** the invented digit runs found (empty when ok). */
  offenders: string[];
}

/**
 * The load-bearing check for DIGIT-form numbers: after removing known slot tokens,
 * the output must contain no digit (Western, Arabic-Indic, or Extended Arabic-Indic).
 * A leftover digit run is a number the model wrote literally instead of via a slot —
 * the suggestion is suppressed. This is a STRUCTURAL guarantee only for digit-form
 * figures. A number spelled out in WORDS ("five thousand riyals", "خمسة آلاف ريال")
 * carries no digit and is NOT caught here — the second-model verify pass and the
 * human reviewer are the backstop for word-form invented values.
 */
export function assertNoInventedNumbers(
  text: string,
  slots: SlotMap,
): NumberCheck {
  const stripped = stripKnownTokens(text, slots);
  const offenders = stripped.match(DIGIT_RUN) ?? [];
  return { ok: offenders.length === 0, offenders };
}

/**
 * Every bracket token the model emitted must be a KNOWN slot. An unknown token
 * (e.g. the model hallucinated "[AMOUNT_PAID]") means it referenced a fact it was
 * not given — suppress rather than substitute nothing.
 */
export function unknownSlots(text: string, slots: SlotMap): string[] {
  const known = new Set(Object.keys(slots));
  const found = text.match(TOKEN) ?? [];
  return Array.from(new Set(found)).filter((t) => !known.has(t));
}

/**
 * Substitute real values for slot tokens — runs LAST, after every safety check, so
 * the reviewer sees real numbers that came from the deterministic layer, never from
 * the model. Longest-token-first avoids any prefix collision.
 */
export function detokenizeSlots(text: string, slots: SlotMap): string {
  let out = text;
  const tokens = Object.keys(slots).sort((a, b) => b.length - a.length);
  for (const token of tokens) out = out.split(token).join(slots[token] as string);
  return out;
}

export interface ParagraphCheck {
  ok: boolean;
  reason?: "invented-number" | "unknown-slot" | "empty";
  detail?: string[];
}

/**
 * Run the deterministic paragraph gate over one language's paragraphs: non-empty,
 * no invented numbers, no unknown slots. A single failing paragraph fails the whole
 * set (fail closed — the reviewer keeps the deterministic letter).
 */
export function checkParagraphs(
  paragraphs: string[],
  slots: SlotMap,
): ParagraphCheck {
  if (paragraphs.length === 0 || paragraphs.every((p) => p.trim() === "")) {
    return { ok: false, reason: "empty" };
  }
  for (const p of paragraphs) {
    const unknown = unknownSlots(p, slots);
    if (unknown.length > 0) {
      return { ok: false, reason: "unknown-slot", detail: unknown };
    }
    const num = assertNoInventedNumbers(p, slots);
    if (!num.ok) {
      return { ok: false, reason: "invented-number", detail: num.offenders };
    }
  }
  return { ok: true };
}
