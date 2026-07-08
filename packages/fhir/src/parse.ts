import type { Bundle, Claim, ClaimResponse } from "@medplum/fhirtypes";
import {
  validateR4,
  type ParseResult,
  type SupportedResource,
} from "./validate-r4.js";

export interface ClaimPair {
  claim: Claim;
  claimResponse: ClaimResponse;
}

export interface ParsedBundle {
  pairs: ClaimPair[];
  issues: string[];
}

/** Parse + base-R4-validate a single resource (Claim or ClaimResponse). */
export function parseResource(input: unknown): ParseResult<SupportedResource> {
  return validateR4(input);
}

/**
 * Parse a FHIR Bundle into matched `{ claim, claimResponse }` pairs. A
 * ClaimResponse is paired to its Claim via `request.reference`, resolved
 * against both `Claim/{id}` and the entry `fullUrl` (urn:uuid) forms.
 * Validation problems and unmatched responses are surfaced as `issues`.
 */
export function parseBundle(input: unknown): ParsedBundle {
  const issues: string[] = [];
  const resourceType =
    typeof input === "object" && input !== null
      ? (input as { resourceType?: unknown }).resourceType
      : undefined;
  if (resourceType !== "Bundle") {
    return { pairs: [], issues: ["input is not a FHIR Bundle"] };
  }

  const bundle = input as Bundle;
  const claimsByKey = new Map<string, Claim>();
  const responses: ClaimResponse[] = [];

  const addClaimKey = (key: string, claim: Claim) => {
    if (claimsByKey.has(key)) {
      issues.push(
        `duplicate Claim entry for ${key}; keeping the first occurrence and discarding the duplicate`,
      );
      return;
    }
    claimsByKey.set(key, claim);
  };

  for (const entry of bundle.entry ?? []) {
    const result = validateR4(entry.resource);
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    if (result.resource.resourceType === "Claim") {
      const claim = result.resource;
      if (claim.id) addClaimKey(`Claim/${claim.id}`, claim);
      if (entry.fullUrl) addClaimKey(entry.fullUrl, claim);
    } else {
      responses.push(result.resource);
    }
  }

  const pairs: ClaimPair[] = [];
  for (const claimResponse of responses) {
    const ref = claimResponse.request?.reference;
    const claim = ref ? claimsByKey.get(ref) : undefined;
    if (!claim) {
      issues.push(
        `ClaimResponse ${claimResponse.id ?? "(no id)"} has no matching claim (unmatched request: ${ref ?? "missing"})`,
      );
      continue;
    }
    pairs.push({ claim, claimResponse });
  }

  return { pairs, issues };
}
