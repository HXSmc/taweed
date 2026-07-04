export interface NphiesProfileStubResult {
  ok: true;
  todo: "nphies-creds";
}

/**
 * TODO(nphies-creds): plug the gated NPHIES IG StructureDefinitions/profiles in
 * here (build-plan §5, §12). The IG package (`nphies-fs#1.0.0`) is HL7-licensed
 * and credential-gated; until it is available this returns a typed stub so the
 * call site and its type are already wired.
 */
export function validateAgainstNphiesProfile(
  _resource: unknown,
): NphiesProfileStubResult {
  return { ok: true, todo: "nphies-creds" };
}
