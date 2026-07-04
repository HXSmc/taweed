import type { AppealContext, AppealDraft, PdfDoc, PdfSegment } from "./types.js";
import type { AppealTemplate } from "./templates.js";
import {
  APPEAL_TEMPLATES,
  GENERIC_TEMPLATE,
  PAYER_TEMPLATE_OVERRIDES,
} from "./templates.js";

// Merge {field} placeholders. Null ids collapse to an em dash (no Latin token,
// so nothing spurious gets LTR-isolated later). Unknown keys are left literal.
function merge(template: string, ctx: AppealContext): string {
  const values: Record<string, string> = {
    claimId: ctx.claimId,
    nphiesClaimId: ctx.nphiesClaimId ?? "—",
    sbsCode: ctx.sbsCode ?? "—",
    denialCode: ctx.denialCode,
    denialCategory: ctx.denialCategory,
    payerName: ctx.payerName,
    providerName: ctx.providerName,
    memberId: ctx.memberId,
    atRiskSar: ctx.atRiskSar,
    serviceDate: ctx.serviceDate,
  };
  return template.replace(
    /\{(\w+)\}/g,
    (_match: string, key: string): string => values[key] ?? `{${key}}`,
  );
}

// Select template by denial code; a payer override (if present) wins and flips
// payerSpecific=true. Unknown code → neutral GENERIC_TEMPLATE, payerSpecific=false.
export function generateAppeal(ctx: AppealContext): AppealDraft {
  const override: AppealTemplate | undefined =
    PAYER_TEMPLATE_OVERRIDES[ctx.payerName]?.[ctx.denialCode];
  const template: AppealTemplate =
    override ?? APPEAL_TEMPLATES[ctx.denialCode] ?? GENERIC_TEMPLATE;

  return {
    subject_en: merge(template.subject_en, ctx),
    body_en: merge(template.body_en, ctx),
    subject_ar: merge(template.subject_ar, ctx),
    body_ar: merge(template.body_ar, ctx),
    docChecklist: template.docChecklist,
    payerSpecific: override !== undefined,
  };
}

// A "Latin token" is an id/code/number run: alphanumerics joined by internal
// separators (uuid hyphens, SBS "83000-00", "1500.00"). Trailing separators are
// excluded so the token stays exactly the id/code.
const LTR_TOKEN = /[A-Za-z0-9]+(?:[._:/-][A-Za-z0-9]+)*/g;

// Split an RTL line into runs: Latin ids/codes become ltr-isolated segments,
// the Arabic prose (and neutral punctuation) around them stays rtl.
function segmentRtl(line: string): PdfSegment[] {
  const segments: PdfSegment[] = [];
  let cursor = 0;
  for (const match of line.matchAll(LTR_TOKEN)) {
    const token = match[0];
    const start = match.index;
    if (token === undefined || start === undefined) continue;
    if (start > cursor) {
      segments.push({ text: line.slice(cursor, start), dir: "rtl" });
    }
    segments.push({ text: token, dir: "ltr" });
    cursor = start + token.length;
  }
  if (cursor < line.length) {
    segments.push({ text: line.slice(cursor), dir: "rtl" });
  }
  // Pure-Arabic (or empty) line → single rtl segment.
  if (segments.length === 0) segments.push({ text: line, dir: "rtl" });
  return segments;
}

// Build a layout-ready doc. A ctx-derived reference header leads the letter, then
// the body paragraphs. For AR, each line is bidi-segmented so Latin ids/SBS codes
// stay ltr-isolated; for EN every line is a single ltr run.
export function appealToPdfModel(
  draft: AppealDraft,
  ctx: AppealContext,
  locale: "en" | "ar",
): PdfDoc {
  const isAr = locale === "ar";
  const title = isAr ? draft.subject_ar : draft.subject_en;
  const body = isAr ? draft.body_ar : draft.body_en;
  const sbs = ctx.sbsCode ?? "—";
  const header = isAr
    ? `مرجع ${ctx.claimId} · العضو ${ctx.memberId} · رمز الخدمة ${sbs} · تاريخ الخدمة ${ctx.serviceDate}`
    : `Ref ${ctx.claimId} · Member ${ctx.memberId} · SBS ${sbs} · Service date ${ctx.serviceDate}`;

  const lines = [header, ...body.split("\n")].filter(
    (line) => line.trim().length > 0,
  );
  const blocks: PdfSegment[][] = lines.map((line) =>
    isAr ? segmentRtl(line) : [{ text: line, dir: "ltr" }],
  );

  return { locale, title, blocks };
}
