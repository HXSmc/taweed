// Public types for @taweed/appeals (build-plan §1 module 4, §7; design-brief §8.4).
// Deterministic bilingual appeal letters — Arabic is first-class, human-reviewed,
// NEVER auto-submitted. Money is a string (Postgres numeric); ids are uuid strings.

/** Everything the generator needs to render one appeal, sourced from a DenialRow
 *  + its claim/line/payer context. Latin ids/codes are carried verbatim. */
export interface AppealContext {
  claimId: string;
  nphiesClaimId: string | null;
  sbsCode: string | null;
  denialCode: string; // TWD-D0x placeholder taxonomy
  denialCategory: string;
  payerName: string;
  providerName: string;
  memberId: string;
  atRiskSar: string; // money string
  serviceDate: string;
  clinicalNote?: string;
}

/** One row of the reason-specific "attach these documents" checklist. */
export interface DocChecklistItem {
  key: string;
  label_en: string;
  label_ar: string;
}

/** AI-2 — optional argumentative paragraphs suggested by the LLM assist layer.
 *  ADDITIVE: the deterministic template body above stays the primary output and
 *  is complete on its own; these are clearly-labelled DRAFT suggestions a reviewer
 *  may insert, edit, or discard. Facts (amounts/dates/codes) are deterministic —
 *  the model writes only prose around them (see @taweed/ai assistAppeal). */
export interface AppealSuggestion {
  paragraphs_en: string[];
  paragraphs_ar: string[];
}

/** A rendered, human-reviewable draft in both languages. */
export interface AppealDraft {
  subject_en: string;
  body_en: string;
  subject_ar: string;
  body_ar: string;
  docChecklist: DocChecklistItem[];
  payerSpecific: boolean;
  // AI-2 (additive, optional): never required for an appeal to work.
  suggestedParagraphs?: AppealSuggestion;
}

/** A directional run. Latin ids/codes stay ltr-isolated inside RTL Arabic so
 *  digits/codes render in the correct order. */
export interface PdfSegment {
  text: string;
  dir: "ltr" | "rtl";
}

/** A layout-ready document: title + paragraphs, each a list of directional runs. */
export interface PdfDoc {
  locale: "en" | "ar";
  title: string;
  blocks: PdfSegment[][];
}
