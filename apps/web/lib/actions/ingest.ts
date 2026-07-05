"use server";
import { revalidatePath } from "next/cache";
import { asc } from "drizzle-orm";
import { parseBundle, type ClaimPair } from "@taweed/fhir";
import { normalize, type NormalizeContext } from "@taweed/normalizer";
import { insertNormalizedClaim, schema } from "@taweed/db";
import { logAudit } from "@taweed/audit";
import { authorizeAction } from "@/lib/authz";
import { withSession } from "@/lib/db";

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

  let bundle: unknown;
  try {
    bundle = JSON.parse(await file.text());
  } catch {
    return { ...empty, fileName, error: "file is not valid JSON" };
  }

  // Resolve dimension ids for this tenant (RLS-scoped). Uploaded bundles map onto
  // the tenant's existing branch/provider/payer/patient for this pass.
  let dims;
  try {
    dims = await withSession(session.tenantId, async (db) => {
      const [branch] = await db.select().from(schema.branches).orderBy(asc(schema.branches.name)).limit(1);
      const [provider] = await db.select().from(schema.providers).orderBy(asc(schema.providers.name)).limit(1);
      const [payer] = await db.select().from(schema.payers).orderBy(asc(schema.payers.name)).limit(1);
      const [patient] = await db.select().from(schema.patients).orderBy(asc(schema.patients.pseudonym)).limit(1);
      return { branch, provider, payer, patient };
    });
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
