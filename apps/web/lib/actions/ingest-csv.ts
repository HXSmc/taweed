"use server";
import { revalidatePath } from "next/cache";
import {
  parseDelimited,
  parseXlsx,
  detectFieldMapping,
  applyMappingOverrides,
  csvRowsToClaims,
  type CanonicalField,
  type FieldMapping,
  type MappingSuggestion,
} from "@taweed/ingest";
import { insertNormalizedClaim } from "@taweed/db";
import { logAudit } from "@taweed/audit";
import { authorizeAction } from "@/lib/authz";
import { withSession } from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import { resolveFirstDimensions } from "@/lib/tenant-dimensions";
import { type IngestResult, type QuarantineItem } from "./ingest";

// EXECUTE B6 — CSV/TSV/XLSX field-mapping panel actions. Shares the exact same
// "ingest:" rate-limit key prefix + window as ingestBundle (apps/web/lib/
// actions/ingest.ts) so the CSV path draws from the same per-tenant+actor
// throttle bucket, not a separate one.
const CSV_RATE_LIMIT = 10;
const CSV_WINDOW_MS = 60_000;
const UPLOAD_ROLES = ["full", "upload"] as const;

// Security guard (common/security.md): with no cap, an authorized actor could
// upload an arbitrarily large file to drive outsized parse CPU, and — on the
// commit path — an arbitrarily long sequential, awaited per-row DB insert
// loop. No existing cap precedent elsewhere in this codebase to match
// (ingestBundle has the same pre-existing gap for JSON bundles, out of scope
// here); this is a conservative, documented bound rather than an unbounded
// one, partially backstopped by Next.js's default ~1MB Server Action body
// limit.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_UPLOAD_ROWS = 5_000;

function fileTooLarge(file: File): boolean {
  return file.size > MAX_UPLOAD_BYTES;
}

function tooManyRows(rowCount: number): boolean {
  return rowCount > MAX_UPLOAD_ROWS;
}

export interface CsvPreviewResult {
  ok: boolean;
  headers: string[];
  suggestions: MappingSuggestion[];
  rowCount: number;
  // These are machine-readable codes (underscore-separated), looked up by
  // csvPreviewErrorMessageKey (ingest-panel.tsx) to select a translated
  // message — deliberately distinct from commitCsvMapping/ingestBundle's
  // IngestResult.error, which carries a fixed, human-readable string
  // rendered verbatim (no translation lookup). Do not "align" the two
  // literal styles; each is load-bearing for its own consumer. A parse
  // failure never forwards the raw exception text (see previewCsvMapping's
  // catch below) — "xlsx_not_wired" and "parse_error" are fixed codes of
  // their own, mirroring commitCsvMapping/ingestBundle's hardening.
  error?:
    | "not_authorized"
    | "rate_limited"
    | "empty_file"
    | "file_too_large"
    | "xlsx_not_wired"
    | "parse_error"
    | string;
}

interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

/** Route by filename extension: .xlsx -> the (currently unwired) XLSX
 *  adapter seam, .tsv -> tab-delimited, everything else -> comma-delimited.
 *  Reuses packages/ingest's parseXlsx "not wired" throw as-is (no adapter
 *  exists by design — see packages/ingest/src/xlsx.ts). */
async function parseUploadedFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return parseXlsx(bytes);
  }
  if (name.endsWith(".tsv")) {
    return parseDelimited(await file.text(), "\t");
  }
  return parseDelimited(await file.text(), ",");
}

function suggestionsToFieldMapping(suggestions: MappingSuggestion[]): FieldMapping {
  const mapping = {} as FieldMapping;
  for (const s of suggestions) mapping[s.field] = s.sourceColumn;
  return mapping;
}

/**
 * Parse an uploaded CSV/TSV/XLSX file and return its detected header ->
 * canonical-field mapping for operator review. Read-only: never touches the
 * DB (design-brief §8.1 — the mapping panel is a review step before commit).
 * Still gated by RBAC + the shared throttle since parsing is real CPU cost.
 */
export async function previewCsvMapping(formData: FormData): Promise<CsvPreviewResult> {
  const empty: CsvPreviewResult = { ok: false, headers: [], suggestions: [], rowCount: 0 };

  const session = await authorizeAction("ingest", [...UPLOAD_ROLES]);
  if (!session) return { ...empty, error: "not_authorized" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ...empty, error: "empty_file" };

  // Throttle before the parse work, mirroring ingestBundle's own comment
  // ("before the expensive parse/insert work below").
  if (
    !(await allowRequest(
      `ingest:${session.tenantId}:${session.userId}`,
      CSV_RATE_LIMIT,
      CSV_WINDOW_MS,
    ))
  ) {
    return { ...empty, error: "rate_limited" };
  }

  // Reject oversized uploads before the parse work (see MAX_UPLOAD_BYTES).
  if (fileTooLarge(file)) return { ...empty, error: "file_too_large" };

  let parsed: ParsedFile;
  try {
    parsed = await parseUploadedFile(file);
  } catch (err) {
    // Fixed, safe codes only — never forward the raw exception message
    // (mirrors commitCsvMapping's identical catch below, and ingestBundle's
    // JSON.parse catch, "file is not valid JSON"). The XLSX "not wired" seam
    // gets its own distinct code so the client can still show a targeted
    // message without the server forwarding parser/library-internal text
    // verbatim on this PHI-adjacent intake surface.
    const msg = err instanceof Error ? err.message : "";
    return { ...empty, error: /not wired/i.test(msg) ? "xlsx_not_wired" : "parse_error" };
  }
  if (parsed.headers.length === 0) return { ...empty, error: "empty_file" };
  if (tooManyRows(parsed.rows.length)) return { ...empty, error: "file_too_large" };

  return {
    ok: true,
    headers: parsed.headers,
    suggestions: detectFieldMapping(parsed.headers),
    rowCount: parsed.rows.length,
  };
}

/**
 * Re-parse the same uploaded file, apply the operator's confirmed overrides
 * to the detected mapping, and commit every valid row as a claim (one CSV
 * row = one claim = one claim line — no multi-row claim grouping in this
 * pass). One bad row quarantines without aborting the batch, mirroring
 * ingestBundle's per-claim try/catch. No per-row dimension creation: every
 * claim maps onto the tenant's existing first branch/provider/payer/patient,
 * the same simplification ingestBundle applies to FHIR-bundle uploads.
 */
export async function commitCsvMapping(
  formData: FormData,
  overrides: Partial<Record<CanonicalField, string | null>>,
): Promise<IngestResult> {
  const empty: IngestResult = {
    ok: false,
    fileName: "",
    claims: 0,
    denials: 0,
    atRiskSar: "0",
    quarantined: [],
  };

  const session = await authorizeAction("ingest", [...UPLOAD_ROLES]);
  if (!session) return { ...empty, error: "not authorized" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ...empty, error: "no file" };
  const fileName = file.name;

  if (
    !(await allowRequest(
      `ingest:${session.tenantId}:${session.userId}`,
      CSV_RATE_LIMIT,
      CSV_WINDOW_MS,
    ))
  ) {
    return { ...empty, fileName, error: "rate_limited" };
  }

  // Reject oversized uploads before the parse work (see MAX_UPLOAD_BYTES).
  if (fileTooLarge(file)) {
    return { ...empty, fileName, error: "file is too large to import" };
  }

  let parsed: ParsedFile;
  try {
    parsed = await parseUploadedFile(file);
  } catch {
    // Fixed, safe string — mirrors ingestBundle's JSON.parse catch ("file is
    // not valid JSON"). Never forward the raw exception message: it can
    // carry parser/library-internal text (e.g. the XLSX "not wired" seam)
    // that this PHI-adjacent operator UI renders verbatim and untranslated.
    return { ...empty, fileName, error: "could not parse file" };
  }

  // Reject oversized row counts before the per-row insert loop below — the
  // real amplification vector a byte cap alone doesn't fully close.
  if (tooManyRows(parsed.rows.length)) {
    return { ...empty, fileName, error: "file is too large to import" };
  }

  let dims;
  try {
    dims = await resolveFirstDimensions(session.tenantId);
  } catch {
    return { ...empty, fileName, error: "could not read tenant setup" };
  }
  if (!dims.branch || !dims.provider || !dims.payer || !dims.patient) {
    return { ...empty, fileName, error: "tenant has no dimensions seeded" };
  }

  const mapping = suggestionsToFieldMapping(
    applyMappingOverrides(detectFieldMapping(parsed.headers), overrides),
  );

  const { claims: normalizedClaims, quarantined: parseQuarantined } = csvRowsToClaims(
    parsed.rows,
    mapping,
    {
      tenantId: session.tenantId,
      branchId: dims.branch.id,
      providerId: dims.provider.id,
      payerId: dims.payer.id,
      patientId: dims.patient.id,
      // In-app uploads are demo/synthetic in this pass, same convention as
      // ingestBundle's own TODO(nphies-creds) comment. KNOWN LIMITATION
      // (shared byte-for-byte with ingestBundle, deferred to BLK-1 real
      // ingest): tagging every row 'synthetic' routes it through the
      // scrubber's claimToFactsSynthetic projection (packages/rules-engine/
      // src/project.ts), which ignores csvRowsToClaims' honest null
      // preauth_present/eligibility_verified/is_duplicate/has_documentation
      // columns entirely and fabricates those signals (plus placeholder SBS
      // codes and a patient-age override) from a hash of the claim id. Real
      // partner ingest must tag 'production' so those nulls actually reach
      // claimToFactsReal instead.
      dataOrigin: "synthetic",
    },
  );

  const quarantined: QuarantineItem[] = [...parseQuarantined];
  let claimsInserted = 0;
  let denials = 0;
  let atRisk = 0;

  for (const normalized of normalizedClaims) {
    // csvRowsToClaims does not carry the row's original claimId-column ref
    // forward onto the built NormalizedClaim (ClaimRow has no such column —
    // only nphies_claim_id, a distinct field). A DB-insert failure here is
    // rare (duplicate/check-constraint); nphies_claim_id, falling back to the
    // internal row id, is the best available label at this point.
    const ref = normalized.claim.nphies_claim_id ?? normalized.claim.id;
    try {
      await withSession(session.tenantId, (db) => insertNormalizedClaim(db, normalized));
      claimsInserted += 1;
      denials += normalized.denials.length;
      atRisk += normalized.denials.reduce((a, d) => a + Number(d.denied_amount), 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      quarantined.push({
        ref,
        reason: /duplicate|unique/i.test(msg)
          ? "duplicate claim (already ingested for this tenant)"
          : /check constraint|violates/i.test(msg)
            ? "failed a data-quality check (amount, currency, or range)"
            : "could not be inserted",
      });
    }
  }

  try {
    await withSession(session.tenantId, (db) =>
      logAudit(db, {
        actor: session.email,
        action: "write",
        entity: "ingest",
        entityId: fileName || "upload",
      }),
    );
  } catch {
    // Ingest succeeded; an audit-write failure must not lose the ingested data.
  }

  revalidatePath("/[locale]/(app)", "layout");
  return {
    ok: true,
    fileName,
    claims: claimsInserted,
    denials,
    atRiskSar: atRisk.toFixed(2),
    quarantined,
  };
}
