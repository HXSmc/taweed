import { makeRng } from "@taweed/synthetic-fhir";
import { formatDigits } from "./digits.js";
import {
  EOB_SCENARIOS,
  EOB_SCENARIO_SPECS,
  type EobScenarioName,
  type EobScenarioSpec,
} from "./scenarios.js";
import type { EobClaim, EobClaimLine, EobExtraction } from "./types.js";

const REMITTANCE_DATE = "2026-01-15";
const SERVICE_DATE = "2026-01-05";

// Confidence bands. lowQualityScan lowers every confidence draw into a visibly
// lower band so a downstream consumer can assert on the *observable* effect
// (confidence) instead of a synthetic marker field baked into extraction —
// extraction must stay strictObject-clean against the (parallel-task)
// EobExtractionSchema, so no lowQualityScan flag lives on the extraction data.
const CONFIDENCE_HIGH_MIN = 0.86;
const CONFIDENCE_HIGH_SPAN = 0.13;
const CONFIDENCE_LOW_MIN = 0.42;
const CONFIDENCE_LOW_SPAN = 0.28;

function draftConfidence(rng: ReturnType<typeof makeRng>, lowQuality: boolean): number {
  const min = lowQuality ? CONFIDENCE_LOW_MIN : CONFIDENCE_HIGH_MIN;
  const span = lowQuality ? CONFIDENCE_LOW_SPAN : CONFIDENCE_HIGH_SPAN;
  return Math.round((min + rng.next() * span) * 100) / 100;
}

function buildLine(
  rng: ReturnType<typeof makeRng>,
  spec: EobScenarioSpec,
  claimIdx: number,
  lineIdx: number,
): EobClaimLine {
  const billedHalalas = rng.int(5, 50) * 100;
  const denialCode = spec.denials[claimIdx]?.[lineIdx] ?? null;
  // Gap 2 — only a non-denied line can carry a contractual write-off: a
  // denied line's paidHalalas is already 0 and rejectedHalalas already
  // absorbs the full billed amount, so there is nothing left for an
  // adjustment to subtract from.
  const adjustmentHalalas = denialCode ? 0 : (spec.adjustments[claimIdx]?.[lineIdx] ?? 0);
  const patientShareHalalas = denialCode ? 0 : Math.round(billedHalalas * 0.1);
  const paidHalalas = denialCode
    ? 0
    : billedHalalas - patientShareHalalas - adjustmentHalalas;
  const rejectedHalalas = denialCode ? billedHalalas : 0;

  return {
    claimLineRef: `line-${claimIdx}-${lineIdx}`,
    sbsCode: `SBS-${rng.int(1000, 9999)}`,
    icd10amCode: `ICD10AM-${rng.int(100, 999)}`,
    billedHalalas,
    paidHalalas,
    patientShareHalalas,
    rejectedHalalas,
    adjustmentHalalas,
    denialCode,
    confidence: draftConfidence(rng, spec.lowQualityScan),
  };
}

function buildClaim(
  rng: ReturnType<typeof makeRng>,
  spec: EobScenarioSpec,
  scenario: EobScenarioName,
  seed: number,
  claimIdx: number,
): EobClaim {
  const lines: EobClaimLine[] = [];
  for (let lineIdx = 0; lineIdx < spec.linesPerClaim; lineIdx++) {
    lines.push(buildLine(rng, spec, claimIdx, lineIdx));
  }
  const totalBilledHalalas = lines.reduce((sum, l) => sum + l.billedHalalas, 0);
  const totalPaidHalalas = lines.reduce((sum, l) => sum + l.paidHalalas, 0);
  const totalRejectedHalalas = lines.reduce((sum, l) => sum + l.rejectedHalalas, 0);
  const totalAdjustmentHalalas = lines.reduce((sum, l) => sum + l.adjustmentHalalas, 0);
  return {
    claimId: `claim-${scenario}-${seed}-${claimIdx}`,
    nphiesClaimId: `NPHIES-CLM-${scenario}-${seed}-${claimIdx}`,
    patientRef: `Patient/patient-${scenario}-${claimIdx}`,
    serviceDate: SERVICE_DATE,
    lines,
    totalBilledHalalas,
    totalPaidHalalas,
    totalRejectedHalalas,
    totalAdjustmentHalalas,
    confidence: draftConfidence(rng, spec.lowQualityScan),
  };
}

/**
 * Builds the ground-truth extraction for one scenario/seed pair. Deterministic
 * (see @taweed/synthetic-fhir's makeRng — mulberry32, no Math.random/Date.now).
 *
 * `extraction` mirrors packages/ai/src/schemas/eobExtraction.ts's
 * EobExtractionSchema field-for-field — see ./types.ts for the reconciliation
 * note. It is kept strictObject-clean (no scenario/seed/marker fields) so
 * `EobExtractionSchema.safeParse(extraction)` passes.
 */
function buildExtraction(scenario: EobScenarioName, seed: number): EobExtraction {
  const spec = EOB_SCENARIO_SPECS[scenario];
  const rng = makeRng(seed + EOB_SCENARIOS.indexOf(scenario) * 1000);

  const claims: EobClaim[] = [];
  for (let claimIdx = 0; claimIdx < spec.claimCount; claimIdx++) {
    claims.push(buildClaim(rng, spec, scenario, seed, claimIdx));
  }

  const remittanceTotalPaidHalalas = claims.reduce(
    (claimSum, claim) =>
      claimSum + claim.lines.reduce((lineSum, line) => lineSum + line.paidHalalas, 0),
    0,
  );

  return {
    payerName: spec.payer.name,
    payerNphiesId: spec.payer.nphiesId,
    remittanceDate: REMITTANCE_DATE,
    remittanceTotalPaidHalalas,
    claims,
    overallConfidence: draftConfidence(rng, spec.lowQualityScan),
  };
}

/**
 * Renders a plain-text simulation of a pdftotext-style extraction of the exact
 * same values in `extraction` (this is the correspondence a future "verbatim
 * text-layer match" validator depends on — every amount and id below is
 * derived directly from `extraction`, nothing re-randomized). Amounts are
 * rendered as SAR (halalas / 100, two-decimal fixed) since that's what a real
 * remittance advice PDF prints, not raw halalas. Digit script follows
 * `spec.digitSet` — "mixed" alternates Western/Arabic-Indic per numeric token
 * (see ./digits.ts) so both scripts are guaranteed present.
 */
function buildTextLayer(spec: EobScenarioSpec, extraction: EobExtraction): string {
  let slot = 0;
  const fmt = (value: number | string): string => formatDigits(value, spec.digitSet, slot++);
  const sar = (halalas: number): string => fmt((halalas / 100).toFixed(2));

  const lines: string[] = [];
  const isAr = spec.language === "ar";
  lines.push(isAr ? "إشعار تسوية مطالبات" : "Remittance Advice");
  lines.push(`${isAr ? "الدافع" : "Payer"}: ${extraction.payerName}`);
  lines.push(`${isAr ? "رقم الدافع" : "Payer NPHIES ID"}: ${extraction.payerNphiesId}`);
  lines.push(`${isAr ? "تاريخ التسوية" : "Remittance Date"}: ${fmt(extraction.remittanceDate)}`);
  lines.push(
    `${isAr ? "إجمالي المسدد" : "Total Paid"}: ${sar(extraction.remittanceTotalPaidHalalas)} SAR`,
  );
  lines.push("");

  for (const claim of extraction.claims) {
    lines.push(`${isAr ? "مطالبة" : "Claim"}: ${claim.nphiesClaimId} (${claim.claimId})`);
    lines.push(`${isAr ? "المريض" : "Patient"}: ${claim.patientRef}`);
    lines.push(`${isAr ? "تاريخ الخدمة" : "Service Date"}: ${fmt(claim.serviceDate)}`);
    for (const line of claim.lines) {
      const parts = [
        line.claimLineRef,
        line.sbsCode,
        line.icd10amCode,
        `${isAr ? "المفوتر" : "Billed"} ${sar(line.billedHalalas)}`,
        `${isAr ? "المسدد" : "Paid"} ${sar(line.paidHalalas)}`,
        `${isAr ? "تحمل المريض" : "Patient Share"} ${sar(line.patientShareHalalas)}`,
        `${isAr ? "المرفوض" : "Rejected"} ${sar(line.rejectedHalalas)}`,
        `${isAr ? "التسوية التعاقدية" : "Adjustment"} ${sar(line.adjustmentHalalas)}`,
      ];
      if (line.denialCode) {
        parts.push(`${isAr ? "سبب الرفض" : "Denial"} ${line.denialCode}`);
      }
      lines.push(`  ${parts.join(" | ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Builds a minimal, valid, bilingual (EN+AR) RTL-aware HTML document
 * representing the same remittance. This is the source `rasterize.ts`
 * (Playwright headless Chromium) renders to PDF/PNG for the live vision-model
 * eval (packages/ai/evals/extractEob.eval.ts) — rasterization now ships in
 * this codebase; this is no longer a placeholder seam for a future step.
 */
function buildHtmlTemplate(spec: EobScenarioSpec, extraction: EobExtraction): string {
  // MONEY-PATH / EVAL-FIDELITY FIX (code-review finding): this used to render
  // sar()/date output as plain Western ASCII digits regardless of
  // `spec.digitSet`, while buildTextLayer (above) already honored it via
  // formatDigits. The live vision eval (packages/ai/evals/extractEob.eval.ts)
  // rasterizes THIS template to PDF (rasterize.ts) and feeds that PDF to
  // extractEob() — it never feeds textLayer — so the arabicHeavy/
  // mixedDigitSets scenarios were presenting only Western numerals to the
  // model, silently defeating the digit-diversity property the corpus exists
  // to stress. `slot` mirrors buildTextLayer's alternation counter so "mixed"
  // still guarantees both scripts appear.
  let slot = 0;
  const fmt = (value: number | string): string => formatDigits(value, spec.digitSet, slot++);
  const sar = (halalas: number): string => fmt((halalas / 100).toFixed(2));
  const isAr = spec.language === "ar";
  // Per-claim identity block (claim id, patient ref, service date), mirroring
  // buildTextLayer's info above — previously ONLY buildTextLayer rendered
  // these, so the vision-model corpus (rasterize.ts renders THIS template,
  // never textLayer, to the PDF the model actually sees) never made
  // patientRef/serviceDate/the internal claimId visible at all, and the eval
  // scored the model as wrong for correctly emitting null/omitting them
  // (confirmed live 2026-07-18: scoring.ts's claim-matching also broke on
  // claimId specifically, since that field is genuinely never legible on a
  // real remittance either — kept matching on nphiesClaimId there, but the
  // OTHER two fields are legitimately printable, so print them for real).
  const claimBlocks = extraction.claims
    .map(
      (claim) => `
      <p>${isAr ? "مطالبة" : "Claim"}: ${claim.nphiesClaimId} (${claim.claimId})</p>
      <p>${isAr ? "المريض" : "Patient"}: ${claim.patientRef}</p>
      <p>${isAr ? "تاريخ الخدمة" : "Service Date"}: ${fmt(claim.serviceDate)}</p>`,
    )
    .join("");
  const rows = extraction.claims
    .flatMap((claim) =>
      claim.lines.map(
        (line) => `
        <tr>
          <td>${claim.nphiesClaimId}</td>
          <td>${line.claimLineRef}</td>
          <td>${line.sbsCode}</td>
          <td>${line.icd10amCode}</td>
          <td>${sar(line.billedHalalas)}</td>
          <td>${sar(line.paidHalalas)}</td>
          <td>${sar(line.patientShareHalalas)}</td>
          <td>${sar(line.rejectedHalalas)}</td>
          <td>${sar(line.adjustmentHalalas)}</td>
          <td>${line.denialCode ?? ""}</td>
        </tr>`,
      ),
    )
    .join("");

  return `<!doctype html>
<html lang="${spec.language}" dir="${spec.language === "ar" ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>Remittance Advice / إشعار تسوية مطالبات</title>
</head>
<body>
  <h1>Remittance Advice / إشعار تسوية مطالبات</h1>
  <p>Payer / الدافع: ${extraction.payerName} (${extraction.payerNphiesId})</p>
  <p>Remittance Date / تاريخ التسوية: ${fmt(extraction.remittanceDate)}</p>
  <p>Total Paid / إجمالي المسدد: ${sar(extraction.remittanceTotalPaidHalalas)} SAR</p>
  ${claimBlocks}
  <table>
    <thead>
      <tr>
        <th>Claim / المطالبة</th>
        <th>Line / السطر</th>
        <th>SBS</th>
        <th>ICD-10-AM</th>
        <th>Billed / المفوتر</th>
        <th>Paid / المسدد</th>
        <th>Patient Share / تحمل المريض</th>
        <th>Rejected / المرفوض</th>
        <th>Adjustment / التسوية التعاقدية</th>
        <th>Denial / الرفض</th>
      </tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</body>
</html>
`;
}

export interface EobGroundTruth {
  extraction: EobExtraction;
  textLayer: string;
  htmlTemplate: string;
}

/**
 * Generates the full ground-truth triple for one scenario/seed. Same
 * (scenario, seed) input always produces byte-identical JSON output (no
 * Math.random/Date.now anywhere in the call graph — see makeRng).
 */
export function generateEobGroundTruth(
  scenario: EobScenarioName,
  seed: number,
): EobGroundTruth {
  const spec = EOB_SCENARIO_SPECS[scenario];
  const extraction = buildExtraction(scenario, seed);
  return {
    extraction,
    textLayer: buildTextLayer(spec, extraction),
    htmlTemplate: buildHtmlTemplate(spec, extraction),
  };
}

export interface GeneratedEobItem extends EobGroundTruth {
  scenario: EobScenarioName;
  seed: number;
}

const BASE_SEED = 1000;

/**
 * Cycles through EOB_SCENARIOS with per-item deterministic seeds
 * (BASE_SEED + index), producing `count` ground-truth items total.
 */
export function generateAllEob(count = 40): GeneratedEobItem[] {
  const items: GeneratedEobItem[] = [];
  for (let i = 0; i < count; i++) {
    const scenario = EOB_SCENARIOS[i % EOB_SCENARIOS.length]!;
    const seed = BASE_SEED + i;
    items.push({ scenario, seed, ...generateEobGroundTruth(scenario, seed) });
  }
  return items;
}
