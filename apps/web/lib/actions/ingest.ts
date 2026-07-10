"use server";
import { revalidatePath } from "next/cache";
import { parseBundle, type ClaimPair } from "@taweed/fhir";
import { normalize, type NormalizeContext } from "@taweed/normalizer";
import { insertNormalizedClaim } from "@taweed/db";
import { logAudit } from "@taweed/audit";
import { authorizeAction } from "@/lib/authz";
import { withSession } from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import { resolveFirstDimensions } from "@/lib/tenant-dimensions";

// Per-tenant+actor throttle for this action (common/security.md): each call does
// an unbounded JSON.parse plus a per-claim DB insert loop, so without a ceiling
// one actor can loop this endpoint to drive unbounded CPU/DB load. Mirrors the
// same-directory AI actions (explain-flag.ts, author-rule.ts, eob-extract.ts),
// which all call allowRequest — this is the only ingest surface that lacked it.
const INGEST_RATE_LIMIT = 10;
const INGEST_WINDOW_MS = 60_000;

export interface QuarantineItem {
  ref: string;
  reason: string;
}
export interface IngestResult {
  ok: boolean;
  fileName: string;
  claims: number;
  denials: number;
  atRiskSar: string;
  quarantined: QuarantineItem[];
  error?: string;
}

// A required money amount that is absent must be QUARANTINED, not folded to 0.00
// (closes the money-precision follow-up). Returns a reason or null.
function requiredAmountIssue(claim: ClaimPair["claim"]): string | null {
  if (claim.total?.value == null) return "claim total amount is missing";
  for (const item of claim.item ?? []) {
    if (item.net?.value == null)
      return `line ${String(item.sequence ?? "?")} net amount is missing`;
  }
  return null;
}

export async function ingestBundle(formData: FormData): Promise<IngestResult> {
  const empty: IngestResult = {
    ok: false,
    fileName: "",
    claims: 0,
    denials: 0,
    atRiskSar: "0",
    quarantined: [],
  };
  // RBAC: only rcm (full) / finance (upload) / admin (full) may ingest.
  const session = await authorizeAction("ingest", ["full", "upload"]);
  if (!session) return { ...empty, error: "not authorized" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ...empty, error: "no file" };
  const fileName = file.name;

  // Throttle server-side, before the expensive parse/insert work below.
  if (
    !(await allowRequest(
      `ingest:${session.tenantId}:${session.userId}`,
      INGEST_RATE_LIMIT,
      INGEST_WINDOW_MS,
    ))
  ) {
    return { ...empty, fileName, error: "rate_limited" };
  }

  let bundle: unknown;
  try {
    bundle = JSON.parse(await file.text());
  } catch {
    return { ...empty, fileName, error: "file is not valid JSON" };
  }

  // Resolve dimension ids for this tenant (RLS-scoped). Uploaded bundles map onto
  // the tenant's existing branch/provider/payer/patient for this pass. Shared
  // with the CSV ingest path (apps/web/lib/actions/ingest-csv.ts) via
  // resolveFirstDimensions so there is exactly one copy of this query.
  let dims;
  try {
    dims = await resolveFirstDimensions(session.tenantId);
  } catch {
    return { ...empty, fileName, error: "could not read tenant setup" };
  }
  if (!dims.branch || !dims.provider || !dims.payer || !dims.patient) {
    return { ...empty, fileName, error: "tenant has no dimensions seeded" };
  }
  const ctx: NormalizeContext = {
    tenantId: session.tenantId,
    branchId: dims.branch.id,
    providerId: dims.provider.id,
    payerId: dims.payer.id,
    patientId: dims.patient.id,
    // In-app uploads are demo/synthetic in this pass. TODO(nphies-creds): real
    // partner ingest (BLK-1) tags 'production', which routes the scrubber to the
    // real-column projection and hard-blocks the synthetic one (EXECUTE B5).
    dataOrigin: "synthetic",
  };

  let parsed;
  try {
    parsed = parseBundle(bundle as never);
  } catch (err) {
    return {
      ...empty,
      fileName,
      error: err instanceof Error ? err.message : "could not parse bundle",
    };
  }

  const quarantined: QuarantineItem[] = parsed.issues.map((iss, i) => ({
    ref: `issue-${i + 1}`,
    reason: typeof iss === "string" ? iss : JSON.stringify(iss),
  }));

  let claims = 0;
  let denials = 0;
  let atRisk = 0;

  // Per-claim transaction so one bad claim quarantines without aborting the batch.
  for (const pair of parsed.pairs) {
    const ref = pair.claim.id ?? "(no id)";
    const amountIssue = requiredAmountIssue(pair.claim);
    if (amountIssue) {
      quarantined.push({ ref, reason: amountIssue });
      continue;
    }
    try {
      const normalized = normalize(pair, ctx);
      await withSession(session.tenantId, (db) => insertNormalizedClaim(db, normalized));
      claims += 1;
      denials += normalized.denials.length;
      atRisk += normalized.denials.reduce((a, d) => a + Number(d.denied_amount), 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // Don't leak internal Postgres/constraint detail to the client; map to a
      // human reason. (A check-constraint failure => a data-quality problem.)
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
    claims,
    denials,
    atRiskSar: atRisk.toFixed(2),
    quarantined,
  };
}
