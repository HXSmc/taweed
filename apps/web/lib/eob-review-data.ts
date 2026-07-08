import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { schema, type Database } from "@taweed/db";
import { EobExtractionSchema, type EobExtraction } from "@taweed/ai";
import { withSession } from "./db";

// AI-4 review-queue data access (plan 04 §9). A human reviews (and may correct)
// every model extraction before it can ever touch claims/denials — nothing here
// executes the extraction, it only reads/flips the eob_extractions row. RLS-scoped
// (tenant from the session), so a tenant only ever sees its own queue.

type EobExtractionDbRow = typeof schema.eobExtractions.$inferSelect;

export interface EobReviewRow {
  id: string;
  sourceFilename: string;
  status: string;
  /** Parsed model output, or null if the stored JSON no longer matches the wire
   *  schema (defensive — a row must never crash the queue page). */
  extraction: EobExtraction | null;
  /** The deterministic validator report (eob-validators.ts's ValidatorReport)
   *  the adapter (or, post-approve, the re-check in actions/eob-review.ts)
   *  produced — surfaced so the human reviewer sees WHICH check failed (which
   *  line's totals disagree, which field missed the text-layer match), not
   *  just a bare "escalated" flag. Untyped here (opaque jsonb, same posture as
   *  `extraction`) — the UI reads `findings`/`passed` defensively. */
  validatorReport: unknown;
  model: string;
  escalated: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

function rowToReview(r: EobExtractionDbRow): EobReviewRow {
  const parsed = EobExtractionSchema.safeParse(r.extraction);
  return {
    id: r.id,
    sourceFilename: r.source_filename,
    status: r.status,
    extraction: parsed.success ? parsed.data : null,
    validatorReport: r.validator_report,
    model: r.model,
    escalated: r.escalated,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

/** The tenant's pending-review queue, oldest first (FIFO — first extracted, first
 *  reviewed), for the ingest surface's review-queue tab. */
export function listPendingEobExtractions(
  tenantId: string,
): Promise<EobReviewRow[]> {
  return withSession(tenantId, async (db) => {
    const rows = await db
      .select()
      .from(schema.eobExtractions)
      .where(eq(schema.eobExtractions.status, "pending_review"))
      .orderBy(asc(schema.eobExtractions.created_at));
    return rows.map(rowToReview);
  });
}

/** One row regardless of status (approve/reject re-check it before acting). */
export function getEobExtraction(
  tenantId: string,
  rowId: string,
): Promise<EobReviewRow | null> {
  return withSession(tenantId, async (db) => {
    const rows = await db
      .select()
      .from(schema.eobExtractions)
      .where(eq(schema.eobExtractions.id, rowId))
      .limit(1);
    const r = rows[0];
    return r ? rowToReview(r) : null;
  });
}

/**
 * Flip a still-pending row to 'rejected'. Only a still-'pending_review' row can
 * transition — an already-decided row is a no-op (returns false), so a stale
 * client can never re-decide a row twice.
 */
export function rejectEobExtractionRow(
  tenantId: string,
  rowId: string,
  reviewedBy: string,
): Promise<boolean> {
  return withSession(tenantId, async (db) => {
    const rows = await db
      .update(schema.eobExtractions)
      .set({ status: "rejected", reviewed_by: reviewedBy, reviewed_at: new Date() })
      .where(
        and(
          eq(schema.eobExtractions.id, rowId),
          eq(schema.eobExtractions.status, "pending_review"),
        ),
      )
      .returning({ id: schema.eobExtractions.id });
    return rows.length > 0;
  });
}

export interface NewEobExtractionRow {
  actorId: string;
  sourceFilename: string;
  /** The validated EobExtraction payload (already parsed against
   *  EobExtractionSchema by the caller) — stored as opaque jsonb. */
  extraction: EobExtraction;
  /** The deterministic validator report the adapter actually used to derive
   *  `escalated`/confidence — stored verbatim, never recomputed here. */
  validatorReport: unknown;
  model: string;
  escalated: boolean;
  promptSha256: string;
}

/**
 * Insert a new PDF-drop extraction row as 'pending_review' (the table default).
 * `tenant_id` is bound to the session's RLS setting, never client input — same
 * pattern as the payer find-or-create insert in actions/eob-review.ts.
 */
export function insertPendingEobExtraction(
  tenantId: string,
  row: NewEobExtractionRow,
): Promise<string> {
  return withSession(tenantId, async (db) => {
    const [inserted] = await db
      .insert(schema.eobExtractions)
      .values({
        tenant_id: sql`current_setting('app.tenant_id')::uuid`,
        actor_id: row.actorId,
        source_filename: row.sourceFilename,
        extraction: row.extraction,
        validator_report: row.validatorReport,
        model: row.model,
        escalated: row.escalated,
        prompt_sha256: row.promptSha256,
      })
      .returning({ id: schema.eobExtractions.id });
    if (!inserted) throw new Error("eob_extractions insert returned no row");
    return inserted.id;
  });
}

/**
 * Flip a still-pending row to 'approved' INSIDE an already-open transaction (the
 * caller's `withSession`) — the approve action must flip the row and write the
 * resolved claims in the SAME transaction so a partial failure can never leave
 * claims inserted with the source row still 'pending_review' (or vice versa).
 * Returns false (no throw) when the row was not pending, so the caller can
 * report "already decided" instead of silently double-writing claims.
 *
 * `validatorReport` is the RE-CHECKED report (eob-validators.ts's
 * validateEobExtractionArithmetic run against the human-edited payload, done
 * by the caller BEFORE this transaction) — persisted here so the stored report
 * always reflects what was actually approved, not the original model output's
 * report gone stale the moment any field was edited.
 */
export async function flipEobExtractionApprovedTx(
  db: Database,
  rowId: string,
  reviewedBy: string,
  validatorReport: unknown,
): Promise<boolean> {
  const rows = await db
    .update(schema.eobExtractions)
    .set({
      status: "approved",
      reviewed_by: reviewedBy,
      reviewed_at: new Date(),
      validator_report: validatorReport,
    })
    .where(
      and(
        eq(schema.eobExtractions.id, rowId),
        eq(schema.eobExtractions.status, "pending_review"),
      ),
    )
    .returning({ id: schema.eobExtractions.id });
  return rows.length > 0;
}
