// AI-2 appeal-assist glossary (plan 04 §4.2). A curated EN↔AR term map for NPHIES
// billing/appeal language, injected into the assist prompt as a soft constraint
// and used for a post-hoc term-presence check (hard constrained decoding degrades
// Arabic fluency — VERIFIED H, plan §4.2). Terminology consistency is a documented
// Arabic-LLM risk; this pins the vocabulary a reviewer expects.
//
// TODO(nphies-creds): the Arabic renderings follow formal MSA billing usage but,
// like DENIAL_REASON_CODES, await KSA-RCM-SME sign-off (BLK-9) before a letter
// using them reaches a real clinic.

export interface GlossaryTerm {
  readonly en: string;
  readonly ar: string;
}

export const APPEAL_GLOSSARY: readonly GlossaryTerm[] = [
  { en: "prior authorization", ar: "الموافقة المسبقة" },
  { en: "medical necessity", ar: "الضرورة الطبية" },
  { en: "eligibility", ar: "الأهلية" },
  { en: "re-adjudication", ar: "إعادة النظر في المطالبة" },
  { en: "coverage", ar: "التغطية التأمينية" },
  { en: "benefit schedule", ar: "جدول المنافع" },
  { en: "supporting documentation", ar: "المستندات الداعمة" },
  { en: "clinical justification", ar: "المبرر السريري" },
  { en: "diagnosis", ar: "التشخيص" },
  { en: "procedure", ar: "الإجراء" },
  { en: "duplicate claim", ar: "مطالبة مكررة" },
  { en: "service date", ar: "تاريخ الخدمة" },
  { en: "member", ar: "المشترك" },
  { en: "payer", ar: "جهة التأمين" },
  { en: "appeal", ar: "الاعتراض" },
] as const;

const EN_INDEX: ReadonlyMap<string, GlossaryTerm> = new Map(
  APPEAL_GLOSSARY.map((t) => [t.en.toLowerCase(), t]),
);

/** Look up the AR rendering for an English term (case-insensitive), or undefined. */
export function glossaryArFor(enTerm: string): string | undefined {
  return EN_INDEX.get(enTerm.trim().toLowerCase())?.ar;
}

/** Render the glossary as prompt lines the model is asked to prefer. */
export function glossaryPromptLines(): string {
  return APPEAL_GLOSSARY.map((t) => `- ${t.en} → ${t.ar}`).join("\n");
}
