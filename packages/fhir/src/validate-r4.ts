import type { Claim, ClaimResponse } from "@medplum/fhirtypes";

export type SupportedResource = Claim | ClaimResponse;

export type ParseResult<T> =
  | { ok: true; resource: T }
  | { ok: false; issues: string[] };

// SHALL (1..1) elements per base FHIR R4. This is a pragmatic base
// FHIR R4 structural check — NOT NPHIES profile conformance, which is gated
// (see validateAgainstNphiesProfile / build-plan §5).
const CLAIM_REQUIRED = [
  "status",
  "type",
  "use",
  "patient",
  "created",
  "provider",
  "priority",
] as const;

// FHIR R4 SHALL (1..1) elements on ClaimResponse.
const CLAIM_RESPONSE_REQUIRED = [
  "status",
  "type",
  "use",
  "patient",
  "created",
  "insurer",
  "outcome",
] as const;

// `request` is 0..1 in base FHIR R4, but the pipeline pairs a ClaimResponse
// to its Claim via `request.reference` (see parseBundle), so it's required
// here for pipeline purposes, not FHIR conformance.
const CLAIM_RESPONSE_PIPELINE_REQUIRED = ["request"] as const;

function requireFields(
  entry: Record<string, unknown>,
  fields: readonly string[],
  path: string,
): string[] {
  return fields
    .filter((field) => entry[field] === undefined || entry[field] === null)
    .map((field) => `${path}.${field} is required (FHIR R4)`);
}

// FHIR polymorphic elements (diagnosis[x], procedure[x]) serialize as one
// of several suffixed keys (e.g. diagnosisCodeableConcept, diagnosisReference);
// presence of any one of them satisfies the 1..1 cardinality.
function requireChoiceField(
  entry: Record<string, unknown>,
  base: string,
  path: string,
): string[] {
  const present = Object.keys(entry).some(
    (key) => key.startsWith(base) && entry[key] !== undefined && entry[key] !== null,
  );
  return present ? [] : [`${path}.${base}[x] is required (FHIR R4)`];
}

function mapArrayEntries(
  value: unknown,
  path: string,
  validate: (entry: Record<string, unknown>, entryPath: string) => string[],
): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (typeof entry !== "object" || entry === null) {
      return [`${entryPath} must be an object`];
    }
    return validate(entry as Record<string, unknown>, entryPath);
  });
}

function validateClaimItem(item: Record<string, unknown>, path: string): string[] {
  return [
    ...requireFields(item, ["sequence", "productOrService"], path),
    ...mapArrayEntries(item["detail"], `${path}.detail`, validateClaimItemDetail),
  ];
}

function validateClaimItemDetail(
  detail: Record<string, unknown>,
  path: string,
): string[] {
  return [
    ...requireFields(detail, ["sequence", "productOrService"], path),
    ...mapArrayEntries(detail["subDetail"], `${path}.subDetail`, (sub, subPath) =>
      requireFields(sub, ["sequence", "productOrService"], subPath),
    ),
  ];
}

// Claim.insurance is 1..* — unlike the scalar CLAIM_REQUIRED fields, an
// empty array must also be rejected, not just undefined/null.
function validateClaimInsurance(insurance: unknown): string[] {
  if (!Array.isArray(insurance) || insurance.length === 0) {
    return ["Claim.insurance is required (FHIR R4)"];
  }
  return mapArrayEntries(insurance, "Claim.insurance", (entry, path) =>
    requireFields(entry, ["sequence", "focal", "coverage"], path),
  );
}

function validateClaimArrays(r: Record<string, unknown>): string[] {
  return [
    ...validateClaimInsurance(r["insurance"]),
    ...mapArrayEntries(r["careTeam"], "Claim.careTeam", (entry, path) =>
      requireFields(entry, ["sequence", "provider"], path),
    ),
    ...mapArrayEntries(r["diagnosis"], "Claim.diagnosis", (entry, path) => [
      ...requireFields(entry, ["sequence"], path),
      ...requireChoiceField(entry, "diagnosis", path),
    ]),
    ...mapArrayEntries(r["procedure"], "Claim.procedure", (entry, path) => [
      ...requireFields(entry, ["sequence"], path),
      ...requireChoiceField(entry, "procedure", path),
    ]),
    ...mapArrayEntries(r["item"], "Claim.item", validateClaimItem),
  ];
}

// ClaimResponse.item.adjudication and .detail.adjudication are 1..* — an
// empty array is also rejected. subDetail.adjudication is 0..* and is not
// checked here.
function requireAdjudication(
  entry: Record<string, unknown>,
  path: string,
): string[] {
  const adjudication = entry["adjudication"];
  if (!Array.isArray(adjudication) || adjudication.length === 0) {
    return [`${path}.adjudication is required (FHIR R4)`];
  }
  return mapArrayEntries(adjudication, `${path}.adjudication`, (adj, adjPath) =>
    requireFields(adj, ["category"], adjPath),
  );
}

function validateClaimResponseItem(
  item: Record<string, unknown>,
  path: string,
): string[] {
  return [
    ...requireFields(item, ["itemSequence"], path),
    ...requireAdjudication(item, path),
    ...mapArrayEntries(item["detail"], `${path}.detail`, validateClaimResponseDetail),
  ];
}

function validateClaimResponseDetail(
  detail: Record<string, unknown>,
  path: string,
): string[] {
  return [
    ...requireFields(detail, ["detailSequence"], path),
    ...requireAdjudication(detail, path),
    ...mapArrayEntries(detail["subDetail"], `${path}.subDetail`, (sub, subPath) =>
      requireFields(sub, ["subDetailSequence"], subPath),
    ),
  ];
}

function validateClaimResponseAddItem(
  entry: Record<string, unknown>,
  path: string,
): string[] {
  return [
    ...requireFields(entry, ["productOrService"], path),
    ...requireAdjudication(entry, path),
  ];
}

function validateClaimResponsePayment(payment: unknown): string[] {
  if (payment === undefined || payment === null) return [];
  if (typeof payment !== "object" || Array.isArray(payment)) {
    return ["ClaimResponse.payment must be an object"];
  }
  return requireFields(
    payment as Record<string, unknown>,
    ["type", "amount"],
    "ClaimResponse.payment",
  );
}

function validateClaimResponseArrays(r: Record<string, unknown>): string[] {
  return [
    ...mapArrayEntries(r["item"], "ClaimResponse.item", validateClaimResponseItem),
    ...mapArrayEntries(r["total"], "ClaimResponse.total", (entry, path) =>
      requireFields(entry, ["category", "amount"], path),
    ),
    ...mapArrayEntries(r["insurance"], "ClaimResponse.insurance", (entry, path) =>
      requireFields(entry, ["sequence", "focal", "coverage"], path),
    ),
    ...mapArrayEntries(r["processNote"], "ClaimResponse.processNote", (entry, path) =>
      requireFields(entry, ["text"], path),
    ),
    ...mapArrayEntries(r["error"], "ClaimResponse.error", (entry, path) =>
      requireFields(entry, ["code"], path),
    ),
    ...mapArrayEntries(r["addItem"], "ClaimResponse.addItem", validateClaimResponseAddItem),
    ...validateClaimResponsePayment(r["payment"]),
  ];
}

/**
 * Validate that an unknown value is a base-FHIR-R4 `Claim` or `ClaimResponse`
 * with its required (1..1) elements present.
 */
export function validateR4(input: unknown): ParseResult<SupportedResource> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: ["resource must be a FHIR object"] };
  }
  const r = input as Record<string, unknown>;
  const resourceType = r["resourceType"];
  if (resourceType !== "Claim" && resourceType !== "ClaimResponse") {
    return {
      ok: false,
      issues: [`unsupported or missing resourceType: ${String(resourceType)}`],
    };
  }
  const required =
    resourceType === "Claim" ? CLAIM_REQUIRED : CLAIM_RESPONSE_REQUIRED;
  const issues: string[] = [];
  for (const field of required) {
    if (r[field] === undefined || r[field] === null) {
      issues.push(`${resourceType}.${field} is required (FHIR R4)`);
    }
  }
  if (resourceType === "ClaimResponse") {
    for (const field of CLAIM_RESPONSE_PIPELINE_REQUIRED) {
      if (r[field] === undefined || r[field] === null) {
        issues.push(`${resourceType}.${field} is required (pipeline pairing)`);
      }
    }
  }
  issues.push(
    ...(resourceType === "Claim"
      ? validateClaimArrays(r)
      : validateClaimResponseArrays(r)),
  );
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, resource: input as SupportedResource };
}
