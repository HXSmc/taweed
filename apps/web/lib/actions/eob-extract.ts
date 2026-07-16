"use server";
import { revalidatePath } from "next/cache";
import {
  EobExtractionSchema,
  resolveEobExtractionAdapter,
  isAiDisabledError,
  isAiConfigError,
} from "@taweed/ai";
import { extractEobFromPdf, extractPdfTextLayer } from "@taweed/ingest";
import { logAudit } from "@taweed/audit";
import { authorizeAction } from "@/lib/authz";
import { appPool, withSession } from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import { insertPendingEobExtraction } from "@/lib/eob-review-data";
import { describeErrorForLog } from "@/lib/error-log";

// AI-4 — the PDF-drop ingest path (plan 04 §9): a payer EOB/remittance PDF
// goes through resolveEobExtractionAdapter (the isFeatureEnabled("extractEob")
// gate) -> packages/ingest's extractEobFromPdf seam -> a NEW eob_extractions
// row ('pending_review'), which the existing review-queue UI/actions
// (eob-review-data.ts / actions/eob-review.ts) already read, approve, and
// reject. This file only ever CREATES a pending row; it never approves one or
// touches claims/denials — that gate is entirely the human-reviewed approve
// action's job.
//
// Feature gate, precisely: resolveEobExtractionAdapter(...) is the ONLY branch
// keyed on the flag (@taweed/ai). When extractEob is off it returns
// `undefined`, and `extractEobFromPdf(pdfBytes, undefined)` is packages/
// ingest's UNTOUCHED pre-existing "not wired" throw — this action does not
// special-case the flag itself; the catch block below runs identically
// whether the flag is off (not-wired throw), a tenant has AI disabled
// (AiDisabledError), the provider is misconfigured (AiConfigError), or the
// model call itself fails.
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
  // undefined -> extractEobFromPdf's pre-existing "not wired" throw below.
  const adapter = resolveEobExtractionAdapter({
    actor: session.userId,
    tenantId: session.tenantId,
    pool: appPool(),
  });

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

  let extracted;
  try {
    extracted = await extractEobFromPdf(pdfBytes, adapter, { textLayer });
  } catch (err) {
    if (isAiDisabledError(err)) return { ok: false, error: "disabled" };
    if (isAiConfigError(err)) return { ok: false, error: "misconfigured" };
    // Covers packages/ingest's pre-existing "not wired" Error (adapter
    // undefined) and any other extraction failure — none of these are a
    // distinct branch from the caller's point of view.
    console.error(
      `extractEobPdfAction extraction failed (${describeErrorForLog(err)})`,
    );
    return { ok: false, error: "failed" };
  }

  const parsedExtraction = EobExtractionSchema.safeParse(extracted.data);
  if (!parsedExtraction.success) {
    console.error(
      "extractEobPdfAction: model output failed EobExtractionSchema",
      parsedExtraction.error,
    );
    return { ok: false, error: "failed" };
  }

  let rowId: string;
  try {
    rowId = await insertPendingEobExtraction(session.tenantId, {
      actorId: session.userId,
      sourceFilename: file.name,
      extraction: parsedExtraction.data,
      // Persist the SAME report the adapter derived escalated/confidence
      // from — never recomputed independently (see eob-extraction-adapter.ts's
      // EobExtractionResult.validatorReport doc comment for why that would be
      // unsafe: a naive re-run without the adapter's exact textLayer/filtering
      // can disagree with the escalated/confidence already derived from it).
      // `validator_report` is NOT NULL jsonb — an empty object (not `null`,
      // which would violate that column) is the defensive fallback for a
      // hypothetical adapter that omits it; the real Claude adapter always
      // sets it, so this branch is not expected to be exercised in practice.
      validatorReport: extracted.validatorReport ?? {},
      // Both are optional on the generic ingest seam (non-LLM adapters have no
      // natural "model id"/"prompt hash"); the real Claude adapter always sets
      // them, but fall back defensively rather than violate the NOT NULL
      // columns if some future adapter omits them.
      model: extracted.model ?? extracted.modelTier,
      escalated: extracted.escalated,
      promptSha256: extracted.promptSha256 ?? "",
    });
  } catch (err) {
    console.error("extractEobPdfAction: failed to persist row", err);
    return { ok: false, error: "failed" };
  }

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
