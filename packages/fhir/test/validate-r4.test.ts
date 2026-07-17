import { describe, it, expect } from "vitest";
import { validateR4 } from "@taweed/fhir";

const validClaim = {
  resourceType: "Claim",
  status: "active",
  type: { coding: [{ code: "institutional" }] },
  use: "claim",
  patient: { reference: "Patient/p1" },
  created: "2026-01-01",
  provider: { reference: "Organization/o1" },
  priority: { coding: [{ code: "normal" }] },
  insurance: [
    { sequence: 1, focal: true, coverage: { reference: "Coverage/cov1" } },
  ],
};

const validClaimResponse = {
  resourceType: "ClaimResponse",
  status: "active",
  type: { coding: [{ code: "institutional" }] },
  use: "claim",
  patient: { reference: "Patient/p1" },
  created: "2026-01-02",
  insurer: { reference: "Organization/payer1" },
  outcome: "complete",
  request: { reference: "Claim/c1" },
};

const cases: Array<{
  name: string;
  input: unknown;
  ok: boolean;
  issueIncludes?: string;
}> = [
  { name: "valid Claim", input: validClaim, ok: true },
  { name: "valid ClaimResponse", input: validClaimResponse, ok: true },
  {
    name: "unknown resourceType",
    input: { ...validClaim, resourceType: "Patient" },
    ok: false,
    issueIncludes: "resourceType",
  },
  {
    name: "Claim missing status",
    input: { ...validClaim, status: undefined },
    ok: false,
    issueIncludes: "status",
  },
  {
    name: "ClaimResponse missing outcome",
    input: { ...validClaimResponse, outcome: undefined },
    ok: false,
    issueIncludes: "outcome",
  },
  {
    name: "Claim missing priority",
    input: { ...validClaim, priority: undefined },
    ok: false,
    issueIncludes: "priority",
  },
  {
    name: "ClaimResponse missing request",
    input: { ...validClaimResponse, request: undefined },
    ok: false,
    issueIncludes: "pipeline pairing",
  },
  { name: "null", input: null, ok: false, issueIncludes: "object" },
  { name: "string", input: "nope", ok: false, issueIncludes: "object" },
  {
    name: "Claim missing insurance",
    input: { ...validClaim, insurance: undefined },
    ok: false,
    issueIncludes: "Claim.insurance is required",
  },
  {
    name: "Claim empty insurance array",
    input: { ...validClaim, insurance: [] },
    ok: false,
    issueIncludes: "Claim.insurance is required",
  },
  {
    name: "Claim insurance entry missing coverage",
    input: { ...validClaim, insurance: [{ sequence: 1, focal: true }] },
    ok: false,
    issueIncludes: "Claim.insurance[0].coverage is required",
  },
  {
    name: "Claim careTeam entry missing provider",
    input: { ...validClaim, careTeam: [{ sequence: 1 }] },
    ok: false,
    issueIncludes: "Claim.careTeam[0].provider is required",
  },
  {
    name: "Claim diagnosis entry missing diagnosis[x]",
    input: { ...validClaim, diagnosis: [{ sequence: 1 }] },
    ok: false,
    issueIncludes: "Claim.diagnosis[0].diagnosis[x] is required",
  },
  {
    name: "Claim diagnosis entry with diagnosisReference is valid",
    input: {
      ...validClaim,
      diagnosis: [
        { sequence: 1, diagnosisReference: { reference: "Condition/c1" } },
      ],
    },
    ok: true,
  },
  {
    name: "Claim procedure entry missing procedure[x]",
    input: { ...validClaim, procedure: [{ sequence: 1 }] },
    ok: false,
    issueIncludes: "Claim.procedure[0].procedure[x] is required",
  },
  {
    name: "Claim item entry missing productOrService",
    input: { ...validClaim, item: [{ sequence: 1 }] },
    ok: false,
    issueIncludes: "Claim.item[0].productOrService is required",
  },
  {
    name: "Claim item.detail entry missing sequence",
    input: {
      ...validClaim,
      item: [
        {
          sequence: 1,
          productOrService: { coding: [{ code: "svc" }] },
          detail: [{ productOrService: { coding: [{ code: "svc" }] } }],
        },
      ],
    },
    ok: false,
    issueIncludes: "Claim.item[0].detail[0].sequence is required",
  },
  {
    name: "Claim item.detail.subDetail entry missing productOrService",
    input: {
      ...validClaim,
      item: [
        {
          sequence: 1,
          productOrService: { coding: [{ code: "svc" }] },
          detail: [
            {
              sequence: 1,
              productOrService: { coding: [{ code: "svc" }] },
              subDetail: [{ sequence: 1 }],
            },
          ],
        },
      ],
    },
    ok: false,
    issueIncludes: "Claim.item[0].detail[0].subDetail[0].productOrService is required",
  },
  {
    name: "ClaimResponse item entry missing adjudication",
    input: { ...validClaimResponse, item: [{ itemSequence: 1 }] },
    ok: false,
    issueIncludes: "ClaimResponse.item[0].adjudication is required",
  },
  {
    name: "ClaimResponse item adjudication entry missing category",
    input: {
      ...validClaimResponse,
      item: [{ itemSequence: 1, adjudication: [{}] }],
    },
    ok: false,
    issueIncludes: "ClaimResponse.item[0].adjudication[0].category is required",
  },
  {
    name: "ClaimResponse item.detail entry missing detailSequence",
    input: {
      ...validClaimResponse,
      item: [
        {
          itemSequence: 1,
          adjudication: [{ category: { coding: [{ code: "eligible" }] } }],
          detail: [
            { adjudication: [{ category: { coding: [{ code: "eligible" }] } }] },
          ],
        },
      ],
    },
    ok: false,
    issueIncludes: "ClaimResponse.item[0].detail[0].detailSequence is required",
  },
  {
    name: "ClaimResponse item.detail.subDetail entry missing subDetailSequence",
    input: {
      ...validClaimResponse,
      item: [
        {
          itemSequence: 1,
          adjudication: [{ category: { coding: [{ code: "eligible" }] } }],
          detail: [
            {
              detailSequence: 1,
              adjudication: [{ category: { coding: [{ code: "eligible" }] } }],
              subDetail: [{}],
            },
          ],
        },
      ],
    },
    ok: false,
    issueIncludes: "ClaimResponse.item[0].detail[0].subDetail[0].subDetailSequence is required",
  },
  {
    name: "ClaimResponse item.detail.subDetail entry without adjudication is valid",
    input: {
      ...validClaimResponse,
      item: [
        {
          itemSequence: 1,
          adjudication: [{ category: { coding: [{ code: "eligible" }] } }],
          detail: [
            {
              detailSequence: 1,
              adjudication: [{ category: { coding: [{ code: "eligible" }] } }],
              subDetail: [{ subDetailSequence: 1 }],
            },
          ],
        },
      ],
    },
    ok: true,
  },
  {
    name: "ClaimResponse total entry missing amount",
    input: {
      ...validClaimResponse,
      total: [{ category: { coding: [{ code: "submitted" }] } }],
    },
    ok: false,
    issueIncludes: "ClaimResponse.total[0].amount is required",
  },
  {
    name: "ClaimResponse payment missing amount",
    input: {
      ...validClaimResponse,
      payment: { type: { coding: [{ code: "complete" }] } },
    },
    ok: false,
    issueIncludes: "ClaimResponse.payment.amount is required",
  },
  {
    name: "ClaimResponse insurance entry missing focal",
    input: {
      ...validClaimResponse,
      insurance: [
        { sequence: 1, coverage: { reference: "Coverage/cov1" } },
      ],
    },
    ok: false,
    issueIncludes: "ClaimResponse.insurance[0].focal is required",
  },
  {
    name: "ClaimResponse processNote entry missing text",
    input: { ...validClaimResponse, processNote: [{ number: 1 }] },
    ok: false,
    issueIncludes: "ClaimResponse.processNote[0].text is required",
  },
  {
    name: "ClaimResponse error entry missing code",
    input: { ...validClaimResponse, error: [{ itemSequence: 1 }] },
    ok: false,
    issueIncludes: "ClaimResponse.error[0].code is required",
  },
  {
    name: "ClaimResponse addItem entry missing adjudication",
    input: {
      ...validClaimResponse,
      addItem: [{ productOrService: { coding: [{ code: "svc" }] } }],
    },
    ok: false,
    issueIncludes: "ClaimResponse.addItem[0].adjudication is required",
  },
];

describe("validateR4", () => {
  for (const c of cases) {
    it(c.name, () => {
      const result = validateR4(c.input);
      expect(result.ok).toBe(c.ok);
      if (!result.ok && c.issueIncludes) {
        expect(result.issues.join(" ")).toContain(c.issueIncludes);
      }
    });
  }
});
