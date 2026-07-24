import "server-only";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
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

/**
 * Backward-compat backfill for eob_extractions rows persisted before Gap 2
 * added the adjustmentHalalas/totalAdjustmentHalalas bucket (code-review
 * finding: schemas/eobExtraction.ts's adjustmentHalalas/totalAdjustmentHalalas
 * are REQUIRED wire fields with no `.default()` — deliberately, since this
 * same schema is also converted to the model-facing structured-output JSON
 * schema by extractEob.ts, where a `.default()` would leak an optional field
 * into the model's tool contract). Any row stored before this branch lacks
 * both keys entirely and would otherwise fail EobExtractionSchema.safeParse
 * below, surfacing as extraction:null — unopenable in the review queue,
 * approvable only via reject. Backfilling to 0 here (DB-read path only) is
 * exactly what those rows meant: no write-off bucket existed yet, so the
 * true adjustment was always 0.
 */
export function backfillLegacyAdjustmentFields(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const extraction = raw as Record<string, unknown>;
  if (!Array.isArray(extraction.claims)) return raw;
  return {
    ...extraction,
    claims: extraction.claims.map((claim) => {
      if (typeof claim !== "object" || claim === null) return claim;
      const c = claim as Record<string, unknown>;
      const lines = Array.isArray(c.lines)
        ? c.lines.map((line) =>
            typeof line === "object" && line !== null && !("adjustmentHalalas" in line)
              ? { ...line, adjustmentHalalas: 0 }
              : line,
          )
        : c.lines;
      return {
        ...c,
        lines,
        ...("totalAdjustmentHalalas" in c ? {} : { totalAdjustmentHalalas: 0 }),
      };
    }),
  };
}

function rowToReview(r: EobExtractionDbRow): EobReviewRow {
  const parsed = EobExtractionSchema.safeParse(backfillLegacyAdjustmentFields(r.extraction));
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

/** The tenant's review queue, oldest first (FIFO — first extracted, first
 *  reviewed), for the ingest surface's review-queue tab. Includes both
 *  'pending_review' rows (ready to review) and in-flight 'processing' rows
 *  (extraction still running in a request `after()` — surfaced so the user who
 *  just uploaded isn't staring at an empty list before their row lands). Failed
 *  rows are intentionally excluded: they aren't reviewable and a re-upload is
 *  the path forward. Reaps stalled 'processing' rows (see
 *  `reapStalledProcessingExtractions`) on every read so a crashed/killed
 *  extraction can't stick a row at 'processing' forever. */
export function listPendingEobExtractions(
  tenantId: string,
): Promise<EobReviewRow[]> {
  return withSession(tenantId, async (db) => {
    await reapStalledProcessingExtractions(db);
    const rows = await db
      .select()
      .from(schema.eobExtractions)
      .where(
        inArray(schema.eobExtractions.status, ["pending_review", "processing"]),
      )
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

// ── Async extraction path (extractEobPdfAction + next/server `after`) ────────
//
// The PDF-drop ingest path moved its heavy work (extractPdfTextLayer + the
// billable AI extraction call) OUT of the request via `after()`, so the HTTP
// response returns as soon as a row exists. The lifecycle is:
//
//   insertProcessingEobExtraction  →  status 'processing'  (request path)
//            │  after() runs the heavy work
//            ▼
//   completeEobExtractionProcessing → 'pending_review' (success)
//   failEobExtractionProcessing     → 'failed'         (caught throw)
//
// All three are RLS-scoped single-purpose writes (one statement each, no
// long-lived transaction) — exactly the posture the after()-DB coupling risk
// called for (a post-response, possibly-idle Neon connection must stay short).

/**
 * `status` column is a free-text field with no CHECK constraint and no enum
 * type, so a brand-new 'processing' value needs no migration — only the
 * readers/writers that observe it (this file, the review-queue UI). The NOT
 * NULL `extraction`/`validator_report`/`model`/`prompt_sha256` columns are
 * filled with placeholders here because the real values do not exist until the
 * `after()` extraction completes; `completeEobExtractionProcessing` overwrites
 * them on success. Returns the new row id (handed back to the client fast).
 */
export function insertProcessingEobExtraction(
  tenantId: string,
  row: { actorId: string; sourceFilename: string },
): Promise<string> {
  return withSession(tenantId, async (db) => {
    const [inserted] = await db
      .insert(schema.eobExtractions)
      .values({
        tenant_id: sql`current_setting('app.tenant_id')::uuid`,
        actor_id: row.actorId,
        source_filename: row.sourceFilename,
        status: "processing",
        extraction: {},
        validator_report: {},
        model: "",
        escalated: false,
        prompt_sha256: "",
      })
      .returning({ id: schema.eobExtractions.id });
    if (!inserted) throw new Error("eob_extractions insert returned no row");
    return inserted.id;
  });
}

/**
 * Transition a still-'processing' row to 'pending_review' with the real
 * extracted payload — the terminal success state of the async path, identical
 * to where the old synchronous flow inserted directly. Only a still-'processing'
 * row transitions; an already-decided row (e.g. reaped to 'failed' while the
 * `after()` raced it) is a no-op, so the callback can never clobber a reaper
 * decision. Short single UPDATE, run inside `after()` after the response.
 */
export async function completeEobExtractionProcessing(
  tenantId: string,
  rowId: string,
  payload: {
    extraction: EobExtraction;
    validatorReport: unknown;
    model: string;
    escalated: boolean;
    promptSha256: string;
  },
): Promise<void> {
  await withSession(tenantId, async (db) => {
    await db
      .update(schema.eobExtractions)
      .set({
        status: "pending_review",
        extraction: payload.extraction,
        validator_report: payload.validatorReport,
        model: payload.model,
        escalated: payload.escalated,
        prompt_sha256: payload.promptSha256,
      })
      .where(
        and(
          eq(schema.eobExtractions.id, rowId),
          eq(schema.eobExtractions.status, "processing"),
        ),
      );
  });
}

/**
 * Transition a still-'processing' row to 'failed'. There is no dedicated error
 * column on this table (and packages/db's schema is owned by another work
 * stream), so the failure reason is stored as an opaque field on the existing
 * NOT NULL `validator_report` jsonb — `{ error: "<reason>" }`. A still-'processing'
 * guard means a row already completed by the success path can never be flipped
 * back to 'failed' by a late/racing failure. Short single UPDATE, run inside
 * `after()`'s catch.
 */
export async function failEobExtractionProcessing(
  tenantId: string,
  rowId: string,
  reason: string,
): Promise<void> {
  await withSession(tenantId, async (db) => {
    await db
      .update(schema.eobExtractions)
      .set({
        status: "failed",
        validator_report: { error: reason },
      })
      .where(
        and(
          eq(schema.eobExtractions.id, rowId),
          eq(schema.eobExtractions.status, "processing"),
        ),
      );
  });
}

/**
 * Stuck-row recovery: a 'processing' row whose `after()` callback never reached
 * a terminal state (process killed / instance recycled mid-extraction, network
 * drop before the UPDATE) would otherwise sit at 'processing' forever — the
 * caught-throw guard in the action can't help when there's no throw. This flips
 * 'processing' rows older than `STALL_MINUTES` to 'failed' with a clear reason,
 * so the review queue never shows a permanently-spinning row. Run as part of
 * every queue read (`listPendingEobExtractions`) — a read is a cheap, frequent
 * enough trigger that no separate cron is needed for this pass. Single UPDATE,
 * no transaction.
 */
export const STALL_MINUTES = 10;

export async function reapStalledProcessingExtractions(db: Database): Promise<void> {
  await db
    .update(schema.eobExtractions)
    .set({
      status: "failed",
      validator_report: { error: "timed out / stalled" },
    })
    .where(
      and(
        eq(schema.eobExtractions.status, "processing"),
        lt(
          schema.eobExtractions.created_at,
          sql`now() - interval '1 minute' * ${STALL_MINUTES}`,
        ),
      ),
    );
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
