// TODO(nphies-creds): replace with real NPHIES adjudication / denial-reason codes.
// These are PLACEHOLDER CARC/RARC-style codes for pipeline de-risking only.
// They are deliberately prefixed "TWD-" so they can never be mistaken for real
// NPHIES/CARC/RARC codes. The real taxonomy is creds + KSA-RCM-SME gated
// (build-plan §8 CREATE exit gate, §12.3 critical content gap #1).

export interface DenialReasonDef {
  readonly code: string;
  readonly kind: "CARC" | "RARC";
  readonly label: string;
}

export const DENIAL_REASON_CODES = [
  { code: "TWD-D01", kind: "CARC", label: "Service not covered by plan" },
  { code: "TWD-D02", kind: "CARC", label: "Prior authorization missing" },
  { code: "TWD-D03", kind: "CARC", label: "Diagnosis / procedure mismatch" },
  { code: "TWD-D04", kind: "CARC", label: "Patient not eligible on service date" },
  { code: "TWD-D05", kind: "CARC", label: "Duplicate claim / service" },
  { code: "TWD-D06", kind: "RARC", label: "Missing supporting documentation" },
  { code: "TWD-D07", kind: "RARC", label: "Procedure bundled into another line" },
  { code: "TWD-D08", kind: "RARC", label: "Quantity exceeds allowed limit" },
] as const satisfies readonly DenialReasonDef[];

export type DenialReasonCode = (typeof DENIAL_REASON_CODES)[number]["code"];

const CODE_SET: ReadonlySet<string> = new Set(
  DENIAL_REASON_CODES.map((c) => c.code),
);

export function isDenialReasonCode(value: unknown): value is DenialReasonCode {
  return typeof value === "string" && CODE_SET.has(value);
}

export function denialLabel(code: DenialReasonCode): string {
  return DENIAL_REASON_CODES.find((c) => c.code === code)!.label;
}
