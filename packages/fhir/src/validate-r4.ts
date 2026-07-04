import type { Claim, ClaimResponse } from "@medplum/fhirtypes";

export type SupportedResource = Claim | ClaimResponse;

export type ParseResult<T> =
  | { ok: true; resource: T }
  | { ok: false; issues: string[] };

// SHALL (1..1) elements we require for the pipeline. This is a pragmatic base
// FHIR R4 structural check — NOT NPHIES profile conformance, which is gated
// (see validateAgainstNphiesProfile / build-plan §5).
const CLAIM_REQUIRED = [
  "status",
  "type",
  "use",
  "patient",
  "created",
  "provider",
] as const;

const CLAIM_RESPONSE_REQUIRED = [
  "status",
  "type",
  "use",
  "patient",
  "created",
  "insurer",
  "outcome",
  "request",
] as const;

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
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, resource: input as SupportedResource };
}
