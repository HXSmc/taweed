import type {
  Bundle,
  Claim,
  ClaimItem,
  ClaimResponse,
  ClaimResponseItem,
  ClaimResponseItemAdjudication,
} from "@medplum/fhirtypes";
import { DENIAL_REASON_CODES, denialLabel } from "@taweed/shared";
import { makeRng } from "./rng.js";
import {
  SCENARIOS,
  SCENARIO_SPECS,
  type ScenarioName,
} from "./scenarios.js";

const CURRENCY = "SAR";
const SBS_SYSTEM = "http://taweed.local/fhir/CodeSystem/sbs-placeholder";
const ADJUDICATION_SYSTEM =
  "http://taweed.local/fhir/CodeSystem/adjudication-placeholder";
const DENIAL_SYSTEM = "http://taweed.local/fhir/CodeSystem/denial-placeholder";

const ARABIC_LABELS: Record<string, string> = {
  "TWD-D06": "مستندات داعمة مفقودة",
};

function reasonDisplay(code: string, language: "en" | "ar"): string {
  if (language === "ar" && ARABIC_LABELS[code]) return ARABIC_LABELS[code]!;
  const def = DENIAL_REASON_CODES.find((d) => d.code === code);
  return def ? denialLabel(def.code) : code;
}

/**
 * Build a valid FHIR R4 Bundle containing one Claim and its ClaimResponse for
 * the given scenario. Deterministic in `seed` (see rng.ts). Denial reasons are
 * drawn from the placeholder enum in @taweed/shared.
 * TODO(nphies-creds): SBS/ICD/adjudication systems + codes are placeholders.
 */
export function generateBundle(scenario: ScenarioName, seed: number): Bundle {
  const spec = SCENARIO_SPECS[scenario];
  const rng = makeRng(seed + SCENARIOS.indexOf(scenario) * 1000);

  const claimId = `claim-${scenario}-${seed}`;
  const responseId = `resp-${scenario}-${seed}`;
  const patientRef = `Patient/patient-${scenario}`;
  const providerRef = `Organization/provider-${scenario}`;
  const claimFullUrl = `urn:uuid:${claimId}`;

  const claimItems: ClaimItem[] = [];
  const responseItems: ClaimResponseItem[] = [];
  let total = 0;

  for (let i = 0; i < spec.lineCount; i++) {
    const sequence = i + 1;
    const qty = rng.int(1, 3);
    const unit = rng.int(50, 500);
    const net = qty * unit;
    total += net;

    claimItems.push({
      sequence,
      productOrService: {
        coding: [{ system: SBS_SYSTEM, code: `SBS-${rng.int(1000, 9999)}` }],
      },
      diagnosisSequence: [1],
      quantity: { value: qty },
      unitPrice: { value: unit, currency: CURRENCY },
      net: { value: net, currency: CURRENCY },
    });

    const codes = spec.denials[i] ?? [];
    const adjudication: ClaimResponseItemAdjudication[] = [];
    if (codes.length === 0) {
      adjudication.push({
        category: { coding: [{ system: ADJUDICATION_SYSTEM, code: "benefit" }] },
        amount: { value: net, currency: CURRENCY },
      });
    } else {
      for (const code of codes) {
        adjudication.push({
          category: {
            coding: [{ system: ADJUDICATION_SYSTEM, code: "denied" }],
          },
          reason: {
            coding: [
              {
                system: DENIAL_SYSTEM,
                code,
                display: reasonDisplay(code, spec.language),
              },
            ],
          },
          amount: { value: net, currency: CURRENCY },
        });
      }
    }
    responseItems.push({ itemSequence: sequence, adjudication });
  }

  const narrative =
    spec.language === "ar"
      ? "مطالبة تأمين تجريبية"
      : "Synthetic institutional claim";

  const claim: Claim = {
    resourceType: "Claim",
    id: claimId,
    status: "active",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/claim-type",
          code: "institutional",
        },
      ],
    },
    use: "claim",
    patient: { reference: patientRef },
    created: "2026-01-01",
    provider: { reference: providerRef },
    priority: { coding: [{ code: "normal" }] },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: { reference: `Coverage/coverage-${scenario}` },
        ...(spec.hasPreAuth ? { preAuthRef: [`PA-${seed}`] } : {}),
      },
    ],
    item: claimItems,
    total: { value: total, currency: CURRENCY },
    text: {
      status: "generated",
      div: `<div xmlns="http://www.w3.org/1999/xhtml">${narrative}</div>`,
    },
  };

  const response: ClaimResponse = {
    resourceType: "ClaimResponse",
    id: responseId,
    status: "active",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/claim-type",
          code: "institutional",
        },
      ],
    },
    use: "claim",
    patient: { reference: patientRef },
    created: "2026-01-05",
    insurer: { reference: `Organization/${spec.payer.id}` },
    outcome: spec.outcome,
    disposition:
      spec.language === "ar" ? "تمت معالجة المطالبة" : "Adjudication processed",
    request: { reference: `Claim/${claimId}` },
    item: responseItems,
  };

  return {
    resourceType: "Bundle",
    type: "collection",
    entry: [
      { fullUrl: claimFullUrl, resource: claim },
      { resource: response },
    ],
  };
}

export interface GeneratedScenario {
  scenario: ScenarioName;
  bundle: Bundle;
}

export function generateAll(seed: number): GeneratedScenario[] {
  return SCENARIOS.map((scenario) => ({
    scenario,
    bundle: generateBundle(scenario, seed),
  }));
}
