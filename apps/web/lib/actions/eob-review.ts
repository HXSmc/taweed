"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asc, sql } from "drizzle-orm";
import { schema, insertNormalizedClaim } from "@taweed/db";
import {
  EobExtractionSchema,
  validateEobExtractionArithmetic,
  type EobExtraction,
} from "@taweed/ai";
import { moneyToHalalas, toSar } from "@taweed/analytics";
import { DENIAL_REASON_CODES } from "@taweed/shared";
import { resolveDimension } from "@taweed/ingest";
import { logAudit } from "@taweed/audit";
import { authorizeAction } from "@/lib/authz";
import { withSession } from "@/lib/db";
import {
  getEobExtraction,
  flipEobExtractionApprovedTx,
  rejectEobExtractionRow,
} from "@/lib/eob-review-data";
import { buildNormalizedClaimsFromEob } from "@/lib/eob-to-normalized";

// AI-4 review-queue approve/reject actions (plan 04 §9). A human reviews (and may
// correct) every field before anything is written; nothing extracted ever reaches
// claims/denials un-reviewed. Server actions are public endpoints: RBAC is
// server-enforced and the (possibly human-edited) payload is re-validated here —
// never trusted just because it round-tripped through the client. Same reviewer
// roles as the FHIR-bundle ingest path (ingestBundle): finance ("upload"),
// rcm/admin ("full").
const REVIEW_ROLES = ["full", "upload"] as const;

// The client edits money as SAR strings (never halalas — a human reviewer reasons
// in SAR, and this also means the client never needs @taweed/analytics, which
// pulls in @taweed/db and must not enter the client bundle). Every other field
// mirrors EobExtractionSchema (packages/ai/src/schemas/eobExtraction.ts) exactly;
// only the four *Halalas number fields become *Sar strings here.
const MoneySar = z.string().regex(/^\d+(\.\d{1,2})?$/, "invalid amount");
const DENIAL_CODES = DENIAL_REASON_CODES.map((c) => c.code) as [
  (typeof DENIAL_REASON_CODES)[number]["code"],
  ...(typeof DENIAL_REASON_CODES)[number]["code"][],
];

const EditedLine = z.object({
  claimLineRef: z.string().min(1).max(200),
  sbsCode: z.string().max(50).nullable(),
  icd10amCode: z.string().max(50).nullable(),
  billedSar: MoneySar,
  paidSar: MoneySar,
  patientShareSar: MoneySar,
  rejectedSar: MoneySar,
  denialCode: z.enum(DENIAL_CODES).nullable(),
  confidence: z.number().min(0).max(1),
}).strict();

const EditedClaim = z.object({
  claimId: z.string().min(1).max(200),
  nphiesClaimId: z.string().max(200).nullable(),
  patientRef: z.string().max(200).nullable(),
  serviceDate: z.string().max(40).nullable(),
  lines: z.array(EditedLine).min(1).max(50),
  totalBilledSar: MoneySar,
  totalPaidSar: MoneySar,
  totalRejectedSar: MoneySar,
  confidence: z.number().min(0).max(1),
}).strict();

const EditedExtraction = z.object({
  payerName: z.string().max(200).nullable(),
  payerNphiesId: z.string().max(200).nullable(),
  remittanceDate: z.string().max(40).nullable(),
  remittanceTotalPaidSar: MoneySar,
  claims: z.array(EditedClaim).min(1).max(20),
  overallConfidence: z.number().min(0).max(1),
}).strict();

export type EditedEobExtractionInput = z.infer<typeof EditedExtraction>;

/** SAR-edited input -> the model's halalas wire shape, at the single money
 *  boundary this whole feature has (design-brief money-precision requirement). */
function toWireExtraction(input: EditedEobExtractionInput): EobExtraction {
  return {
    payerName: input.payerName,
    payerNphiesId: input.payerNphiesId,
    remittanceDate: input.remittanceDate,
    remittanceTotalPaidHalalas: moneyToHalalas(input.remittanceTotalPaidSar),
    overallConfidence: input.overallConfidence,
    claims: input.claims.map((c) => ({
      claimId: c.claimId,
      nphiesClaimId: c.nphiesClaimId,
      patientRef: c.patientRef,
      serviceDate: c.serviceDate,
      confidence: c.confidence,
      totalBilledHalalas: moneyToHalalas(c.totalBilledSar),
      totalPaidHalalas: moneyToHalalas(c.totalPaidSar),
      totalRejectedHalalas: moneyToHalalas(c.totalRejectedSar),
      lines: c.lines.map((l) => ({
        claimLineRef: l.claimLineRef,
        sbsCode: l.sbsCode,
        icd10amCode: l.icd10amCode,
        denialCode: l.denialCode,
        confidence: l.confidence,
        billedHalalas: moneyToHalalas(l.billedSar),
        paidHalalas: moneyToHalalas(l.paidSar),
        patientShareHalalas: moneyToHalalas(l.patientShareSar),
        rejectedHalalas: moneyToHalalas(l.rejectedSar),
      })),
    })),
  };
}

export interface ApproveEobResult {
  ok: boolean;
  error?:
    | "forbidden"
    | "invalid"
    | "not_pending"
    | "not_seeded"
    | "failed"
    /** the human-edited payload fails the deterministic cross-total check —
     *  the original model output's validator_report goes stale the moment any
     *  field is edited, so this re-check is the ONLY thing standing between an
     *  arithmetic mistake and the claims/money path at exactly the point human
     *  error enters. Never silently approved past this. */
    | "inconsistent";
}

/** Control-flow sentinel thrown INSIDE the transaction so a re-check failure or a
 *  missing tenant dimension rolls the whole approve back — never a partial write. */
class EobApproveAbort extends Error {
  constructor(public readonly reason: "not_pending" | "not_seeded") {
    super(reason);
  }
}

/**
 * Approve a reviewed (possibly human-corrected) EOB extraction: re-validate the
 * payload, resolve the payer via B6 find-or-create (resolveDimension), default
 * the remaining dimensions from the tenant's seeded data (mirrors the FHIR-bundle
 * ingest path's own precedent), insert the resulting claims via the SAME
 * insertNormalizedClaim path ingestBundle uses, flip the row to 'approved', and
 * audit it — ALL inside one transaction so a mid-failure can never leave claims
 * inserted with the source row still pending, or vice versa.
 */
export async function approveEobExtractionAction(
  rowId: string,
  edited: unknown,
): Promise<ApproveEobResult> {
  const session = await authorizeAction("ingest", [...REVIEW_ROLES]);
  if (!session) return { ok: false, error: "forbidden" };
  if (typeof rowId !== "string" || rowId.length === 0) {
    return { ok: false, error: "invalid" };
  }

  const parsed = EditedExtraction.safeParse(edited);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const wire = toWireExtraction(parsed.data);
  // Defense-in-depth: the converted shape must still satisfy the model's own wire
  // contract (packages/ai/src/schemas/eobExtraction.ts) before it can be persisted.
  const wireCheck = EobExtractionSchema.safeParse(wire);
  if (!wireCheck.success) return { ok: false, error: "invalid" };

  // Re-run the deterministic arithmetic gate on the (possibly human-edited)
  // payload — the stored validator_report was computed on the ORIGINAL model
  // output and goes stale the instant a reviewer edits any amount. No text
  // layer is available here (only the report is persisted, not the PDF's text
  // layer), so this is the arithmetic/enum-only variant, same as
  // claude-vision-ocr.ts's no-textLayer path. A failure here means the human
  // edit itself introduced an inconsistency — block, don't silently approve.
  const recheckedReport = validateEobExtractionArithmetic(wire);
  if (!recheckedReport.passed) return { ok: false, error: "inconsistent" };

  try {
    await withSession(session.tenantId, async (db) => {
      const flipped = await flipEobExtractionApprovedTx(
        db,
        rowId,
        session.email,
        recheckedReport,
      );
      if (!flipped) throw new EobApproveAbort("not_pending");

      const existingPayers = await db
        .select({ id: schema.payers.id, name: schema.payers.name })
        .from(schema.payers)
        .orderBy(asc(schema.payers.name));

      let payerId: string;
      const payerMatch = resolveDimension(existingPayers, wire.payerName ?? "");
      if (payerMatch.name === "") {
        // No usable payer name extracted — fall back to the tenant's first payer
        // (mirrors ingestBundle's own "default from seeded dimensions" precedent)
        // rather than ever writing a null/invalid payer_id (NOT NULL FK).
        const fallback = existingPayers[0];
        if (!fallback) throw new EobApproveAbort("not_seeded");
        payerId = fallback.id;
      } else if (payerMatch.create) {
        const [created] = await db
          .insert(schema.payers)
          .values({
            tenant_id: sql`current_setting('app.tenant_id')::uuid`,
            name: payerMatch.name,
            nphies_payer_id: wire.payerNphiesId,
            type: null,
          })
          .returning({ id: schema.payers.id });
        payerId = created!.id;
      } else {
        payerId = payerMatch.id!;
      }

      const [branch] = await db
        .select({ id: schema.branches.id })
        .from(schema.branches)
        .orderBy(asc(schema.branches.name))
        .limit(1);
      const [provider] = await db
        .select({ id: schema.providers.id })
        .from(schema.providers)
        .orderBy(asc(schema.providers.name))
        .limit(1);
      const [patient] = await db
        .select({ id: schema.patients.id })
        .from(schema.patients)
        .orderBy(asc(schema.patients.pseudonym))
        .limit(1);
      if (!branch || !provider || !patient) {
        throw new EobApproveAbort("not_seeded");
      }

      const normalizedClaims = buildNormalizedClaimsFromEob(
        wire,
        {
          tenantId: session.tenantId,
          branchId: branch.id,
          providerId: provider.id,
          payerId,
          patientId: patient.id,
        },
        toSar,
      );
      for (const nc of normalizedClaims) {
        await insertNormalizedClaim(db, nc);
      }

      await logAudit(db, {
        actor: session.email,
        action: "write",
        entity: "eob_extraction",
        entityId: rowId,
      });
    });
  } catch (err) {
    if (err instanceof EobApproveAbort) return { ok: false, error: err.reason };
    console.error("approveEobExtractionAction failed", err);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/[locale]/(app)/ingest", "page");
  return { ok: true };
}

export interface RejectEobResult {
  ok: boolean;
  error?: "forbidden" | "invalid" | "not_pending";
}

/** Reject a pending row (never executes). Server-enforced RBAC; audited. */
export async function rejectEobExtractionAction(
  rowId: string,
): Promise<RejectEobResult> {
  const session = await authorizeAction("ingest", [...REVIEW_ROLES]);
  if (!session) return { ok: false, error: "forbidden" };
  if (typeof rowId !== "string" || rowId.length === 0) {
    return { ok: false, error: "invalid" };
  }

  const row = await getEobExtraction(session.tenantId, rowId);
  if (!row || row.status !== "pending_review") {
    return { ok: false, error: "not_pending" };
  }

  const flipped = await rejectEobExtractionRow(session.tenantId, rowId, session.email);
  if (!flipped) return { ok: false, error: "not_pending" };

  await withSession(session.tenantId, (db) =>
    logAudit(db, {
      actor: session.email,
      action: "write",
      entity: "eob_extraction_reject",
      entityId: rowId,
    }),
  );

  revalidatePath("/[locale]/(app)/ingest", "page");
  return { ok: true };
}
