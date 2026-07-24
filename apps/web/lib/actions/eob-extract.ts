"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import {
  EobExtractionSchema,
  resolveEobExtractionAdapter,
  isAiDisabledError,
  isAiConfigError,
} from "@taweed/ai";
import {
  extractEobFromPdf,
  extractPdfTextLayer,
  type EobExtractionAdapter,
} from "@taweed/ingest";
import { logAudit } from "@taweed/audit";
import { authorizeAction } from "@/lib/authz";
import { appPool, withSession } from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import {
  insertProcessingEobExtraction,
  completeEobExtractionProcessing,
  failEobExtractionProcessing,
} from "@/lib/eob-review-data";
import { describeErrorForLog } from "@/lib/error-log";

// AI-4 — the PDF-drop ingest path (plan 04 §9): a payer EOB/remittance PDF
// goes through resolveEobExtractionAdapter (the isFeatureEnabled("extractEob")
// gate) -> a NEW eob_extractions row ('processing'), returned to the client
// FAST. The heavy work — packages/ingest's extractPdfTextLayer +
// extractEobFromPdf seam — runs in `after()` (next/server) AFTER the response
// is flushed, transitioning that same row to 'pending_review' (success) or
// 'failed' (caught throw). The existing review-queue UI/actions
// (eob-review-data.ts / actions/eob-review.ts) then read, approve, and reject
// the 'pending_review' rows. This file only ever CREATES a row and runs the
// extraction into it; it never approves one or touches claims/denials — that
// gate is entirely the human-reviewed approve action's job.
//
// Feature gate, precisely: resolveEobExtractionAdapter(...) is the ONLY branch
// keyed on the flag (@taweed/ai). When extractEob is off it returns
// `undefined`, and this action fast-fails synchronously with 'disabled' BEFORE
// inserting any row. When the flag is on, the billable model call happens
// inside `after()`; a per-tenant AI disable (AiDisabledError), a misconfigured
// provider (AiConfigError), or any other extraction failure is caught there and
// recorded on the row's reason field, transitioning it to 'failed'.
//
// Same RBAC + reviewer roles as the FHIR-bundle ingest path (ingestBundle)
// and the review-queue approve/reject actions.
const UPLOAD_ROLES = ["full", "upload"] as const;

// A billable model call (Sonnet, possibly escalating to Opus) per upload —
// throttle per (tenant, actor), same posture as AI-3's authoring rate limit
// (author-rule.ts).
const EXTRACT_RATE_LIMIT = 10;
const EXTRACT_WINDOW_MS = 60_000;

// Reject obviously-wrong uploads before they ever reach the model: a wrong
// mime type/extension or an empty/oversized file is a client mistake, not an
// AI-gate concern.
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MiB

export interface ExtractEobPdfResult {
  ok: boolean;
  rowId?: string;
  error?:
    | "forbidden"
    | "invalid"
    | "rate_limited"
    /** AI kill switch off (global, feature, or per-tenant) — the UI should
     *  point the user at the manual-entry / FHIR-bundle path instead. */
    | "disabled"
    /** feature on but no provider configured — distinct from off (ops signal). */
    | "misconfigured"
    | "failed";
}

function isPdfFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

// `file.type`/`file.name` are attacker/client-controlled (a browser lets
// script set arbitrary File.type/name) — real content verification is the
// PDF magic number itself, checked below once the bytes are in hand.
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((b, i) => bytes[i] === b);
}

// This action sends real (non-pseudonymized) PDF page content to the model by
// design (docs/blocker.md BLK-AI-1) — unlike AI-1/2/3, there is no PHI-free
// construction here, so the caught `err` below is NOT safe to log verbatim.
// See lib/error-log.ts (describeErrorForLog) for the full rationale — shared
// with the sibling approve/reject action in eob-review.ts, which writes to
// Postgres on this same non-PHI-free path.

/**
 * Extract a candidate EOB from an uploaded PDF and file it as a new
 * 'pending_review' row. Never writes claims/denials itself — the row only
 * becomes real data once a human approves it via approveEobExtractionAction.
 */
export async function extractEobPdfAction(
  formData: FormData,
): Promise<ExtractEobPdfResult> {
  const session = await authorizeAction("ingest", [...UPLOAD_ROLES]);
  if (!session) return { ok: false, error: "forbidden" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "invalid" };
  if (
    file.type !== "application/pdf" &&
    !isPdfFilename(file.name)
  ) {
    return { ok: false, error: "invalid" };
  }
  if (file.size === 0 || file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "invalid" };
  }

  if (
    !(await allowRequest(
      `extract-eob:${session.tenantId}:${session.userId}`,
      EXTRACT_RATE_LIMIT,
      EXTRACT_WINDOW_MS,
    ))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfMagicBytes(pdfBytes)) return { ok: false, error: "invalid" };

  // The ONLY branch keyed on isFeatureEnabled("extractEob", env): off ->
  // undefined. Resolved on the REQUEST path (cheap — a flag read, no model
  // call) so the global-feature-off case still fast-fails with a distinct
  // 'disabled' error to the client, WITHOUT inserting a row that would only
  // ever fail inside `after()`. Per-tenant disable (AiDisabledError) and a
  // misconfigured provider (AiConfigError) are only detectable once the model
  // is actually called, so those surface as a 'failed' row from inside the
  // `after()` callback below rather than a synchronous error code.
  const adapter = resolveEobExtractionAdapter({
    actor: session.userId,
    tenantId: session.tenantId,
    pool: appPool(),
  });
  if (adapter === undefined) return { ok: false, error: "disabled" };

  // Insert the row as 'processing' BEFORE the heavy work runs, so the HTTP
  // response can return immediately. The expensive PDF text-layer parse and
  // billable AI extraction happen in `after()` (next/server) — after this
  // response is flushed — and transition this same row to 'pending_review'
  // (success) or 'failed' (caught throw) once done.
  let rowId: string;
  try {
    rowId = await insertProcessingEobExtraction(session.tenantId, {
      actorId: session.userId,
      sourceFilename: file.name,
    });
  } catch (err) {
    console.error("extractEobPdfAction: failed to persist processing row", err);
    return { ok: false, error: "failed" };
  }

  // Schedule the heavy work to run after the response is sent. The callback
  // closes over the already-validated bytes, the resolved adapter, and the
  // row id — nothing request-scoped is touched after the response flushes.
  // All DB writes inside it are short, single-purpose UPDATEs (one per
  // terminal state): a post-response Neon connection must not be held open in
  // a long transaction (separate seeding-hang investigation against this DB).
  after(() =>
    runExtractionAfterResponse({
      tenantId: session.tenantId,
      rowId,
      pdfBytes,
      adapter,
    }).catch((err) => {
      // The callback's own try/catch already transitions the row to 'failed'
      // on an extraction error; this outer catch is the last-resort guard for
      // an unexpected throw in the transition itself (e.g. a transient DB
      // error during the failure UPDATE) so `after()` never rejects
      // unhandled. The row may stay 'processing' here — the reaper
      // (reapStalledProcessingExtractions) is the backstop for that case.
      console.error(
        `extractEobPdfAction after() threw (${describeErrorForLog(err)})`,
      );
    }),
  );

  try {
    await withSession(session.tenantId, (db) =>
      logAudit(db, {
        actor: session.email,
        action: "write",
        entity: "eob_extraction_created",
        entityId: rowId,
      }),
    );
  } catch {
    // The row is already committed; an audit-write failure must not lose it
    // (same tolerant posture as ingestBundle's own audit write).
  }

  revalidatePath("/[locale]/(app)/ingest", "page");
  return { ok: true, rowId };
}

/**
 * The post-response half of the PDF-drop ingest path. Runs the text-layer
 * extraction + the billable AI call and transitions the 'processing' row to a
 * terminal state. Extracted into its own function so the failure transition is
 * a single explicit catch around all the heavy work (including the schema
 * parse), and so it is directly unit-testable without driving the full request
 * action. Never writes claims/denials — the row only becomes real data on a
 * later human approve (approveEobExtractionAction).
 */
async function runExtractionAfterResponse(args: {
  tenantId: string;
  rowId: string;
  pdfBytes: Uint8Array;
  adapter: EobExtractionAdapter;
}): Promise<void> {
  const { tenantId, rowId, pdfBytes, adapter } = args;
  try {
    // Born-digital PDFs carry their own text layer, independent of whatever the
    // vision model reads off the page image — eob-validators' "text-layer-match"
    // check uses it as a non-LLM source-fidelity signal. A scanned PDF has none
    // (extractPdfTextLayer resolves to undefined, not an error); the adapter
    // skips that specific check in that case rather than scoring against "".
    //
    // Pass a COPY: pdf-parse's pdfjs-dist internals detach the underlying
    // ArrayBuffer of whatever typed array they're given (a pdfjs-dist
    // optimization to avoid copying large PDFs). Handing them `pdfBytes`
    // directly left the buffer empty by the time the vision adapter below
    // base64-encoded the same reference, so every extraction died with a real
    // API 400 ("PDF cannot be empty") that surfaced as a generic schema-parse
    // failure — caught live via chrome-devtools MCP against the real API,
    // 2026-07-16. `.slice()` copies into a fresh buffer pdf-parse can consume.
    const textLayer = await extractPdfTextLayer(pdfBytes.slice());

    const extracted = await extractEobFromPdf(pdfBytes, adapter, { textLayer });

    const parsedExtraction = EobExtractionSchema.safeParse(extracted.data);
    if (!parsedExtraction.success) {
      console.error(
        "extractEobPdfAction: model output failed EobExtractionSchema",
        parsedExtraction.error,
      );
      await failEobExtractionProcessing(tenantId, rowId, "schema_parse_failed");
      return;
    }

    await completeEobExtractionProcessing(tenantId, rowId, {
      extraction: parsedExtraction.data,
      // Persist the SAME report the adapter derived escalated/confidence from
      // — never recomputed independently (see eob-extraction-adapter.ts's
      // EobExtractionResult.validatorReport doc comment). `validator_report`
      // is NOT NULL jsonb — `{}` is the defensive fallback for a hypothetical
      // adapter that omits it; the real Claude adapter always sets it.
      validatorReport: extracted.validatorReport ?? {},
      // Both are optional on the generic ingest seam; the real Claude adapter
      // always sets them, but fall back defensively rather than violate the
      // NOT NULL columns if some future adapter omits them.
      model: extracted.model ?? extracted.modelTier ?? "",
      escalated: extracted.escalated,
      promptSha256: extracted.promptSha256 ?? "",
    });
    // Bust the ingest page cache so a reviewer reloading sees the row land as
    // 'pending_review' without waiting for the next scheduled revalidation.
    revalidatePath("/[locale]/(app)/ingest", "page");
  } catch (err) {
    // Categorize the failure for the row's reason field. The disabled/
    // misconfigured distinctions are not surfaced to the client synchronously
    // in the async path (the response already went out as {ok:true}); they
    // are recorded here for ops/debuggability instead.
    let reason: string;
    if (isAiDisabledError(err)) reason = "ai_disabled";
    else if (isAiConfigError(err)) reason = "misconfigured";
    else reason = describeErrorForLog(err);
    console.error(
      `extractEobPdfAction extraction failed (${reason})`,
    );
    await failEobExtractionProcessing(tenantId, rowId, reason);
    revalidatePath("/[locale]/(app)/ingest", "page");
  }
}
