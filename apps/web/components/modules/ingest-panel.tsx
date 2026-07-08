"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { UploadCloud, FileJson, CheckCircle2, Loader2 } from "lucide-react";
import { resolveUploadState, type UploadState } from "@/lib/ingest-submit";
import type { ExtractEobPdfResult } from "@/lib/actions/eob-extract";
import { formatMoney } from "@/lib/money";
import { CountUp } from "@/components/money/count-up";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// A PDF drop routes to the AI-4 extraction path (extractEobPdfAction) instead
// of the FHIR-bundle path (ingestBundle) — every JSON/FHIR-bundle upload is
// UNCHANGED, still handled by ingestBundle exactly as before this file was
// touched (it will report its own "not valid JSON" error for anything it
// can't parse, same as always).
//
// DEVIATION (deliberate, documented): before this file was touched, a
// drag-dropped PDF had no client-side type guard on the drop handler (the
// <input accept> only blocked it in the file PICKER), so it fell through to
// ingestBundle -> JSON.parse -> "file is not valid JSON". That incidental
// behavior is intentionally replaced by routing every PDF through
// extractEobPdfAction unconditionally (client-side there is no flag check —
// only the server knows the flag). When extractEob is OFF, that action's
// only flag-keyed branch (resolveEobExtractionAdapter) returns undefined and
// extractEobFromPdf(bytes, undefined) throws packages/ingest's UNTOUCHED
// pre-existing "not wired" Error (see packages/ai/test/claude-vision-ocr.test.ts's
// resolveEobExtractionAdapter describe block for the proof) -- which this
// component surfaces as the pdfFailed message. This matches the brief's own
// framing ("still throws the existing 'not wired' error ... whichever this
// codebase already does today") rather than preserving the old accidental
// JSON-parse error for a file type ingestBundle was never meant to handle.

function pdfErrorMessageKey(error: ExtractEobPdfResult["error"]): string {
  switch (error) {
    case "forbidden":
      return "pdfForbidden";
    case "invalid":
      return "pdfInvalid";
    case "rate_limited":
      return "pdfRateLimited";
    case "disabled":
      return "pdfDisabled";
    case "misconfigured":
      return "pdfMisconfigured";
    default:
      return "pdfFailed";
  }
}

// Split view (design-brief §8.1): inline-start dropzone, inline-end live run
// ledger with tabular counters. Malformed rows are quarantined with a reason,
// never silently dropped.
export function IngestPanel() {
  const t = useTranslations("ingest");
  const [pending, start] = React.useTransition();
  const [state, setState] = React.useState<UploadState | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    start(async () => setState(await resolveUploadState(file, fd)));
  };

  const result = state?.kind === "json" ? state.result : null;
  const stage = pending ? "parsing" : state ? "ready" : "idle";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Dropzone */}
      <Card
        className={cn(
          "flex min-h-[18rem] flex-col items-center justify-center gap-3 border-dashed p-8 text-center transition-colors",
          dragging && "border-accent bg-accent-subtle",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) submit(f);
        }}
      >
        <UploadCloud className="size-8 text-muted" />
        <p className="max-w-xs text-body text-muted">{t("dropzone")}</p>
        <p className="mono text-label text-faint">{t("dropzoneHint")}</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json,application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) submit(f);
          }}
        />
        <div className="mt-2 flex gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileJson className="size-4" />
            )}
            {t("process")}
          </Button>
          <Button variant="secondary" asChild>
            <a href="/api/sample-bundle" download>
              {t("sampleFile")}
            </a>
          </Button>
        </div>
      </Card>

      {/* Run ledger */}
      <Card className="p-5">
        <h2 className="mb-4 text-h3 font-medium">{t("runLedger")}</h2>
        <ol className="mb-5 flex flex-col gap-2">
          {(["received", "parsing", "validating", "ready"] as const).map((s) => {
            const done =
              stage === "ready" || (stage === "parsing" && s !== "ready");
            return (
              <li key={s} className="flex items-center gap-2 text-body">
                {done ? (
                  <CheckCircle2 className="size-4 text-recovered" />
                ) : (
                  <span className="size-4 rounded-full border border-hairline-strong" />
                )}
                <span className={done ? "text-text" : "text-muted"}>{t(s)}</span>
              </li>
            );
          })}
        </ol>

        {state?.kind !== "pdf" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Counter label={t("claimsCreated")} value={result?.claims ?? 0} tone="text" />
              <Counter
                label={t("denialsDetected")}
                value={result?.denials ?? 0}
                tone="atRisk"
              />
              <Counter
                label={t("quarantined")}
                value={result?.quarantined.length ?? 0}
                tone="muted"
              />
            </div>

            {result?.ok && (
              <p className="mt-4 border-t border-hairline pt-4 text-body">
                {t("resultLead", {
                  claims: result.claims,
                  denials: result.denials,
                  atRisk: formatMoney(result.atRiskSar),
                })}
              </p>
            )}
            {result?.error && (
              <p className="mt-4 rounded-md bg-at-risk-bg p-3 text-body text-at-risk-text">
                {result.error}
              </p>
            )}
          </>
        )}

        {/* AI-4 PDF-drop path: files as a pending_review row for the Review
            queue tab (this page's other tab) rather than reporting counters
            directly — nothing from a PDF ever reaches claims without a human
            approving it there. */}
        {state?.kind === "pdf" && (
          <div className="mt-4 border-t border-hairline pt-4">
            {state.result.ok ? (
              <p role="status" aria-live="polite" className="text-body">
                {t("pdfResultLead")}
              </p>
            ) : (
              <p
                role="alert"
                aria-live="assertive"
                className="rounded-md bg-at-risk-bg p-3 text-body text-at-risk-text"
              >
                {t(pdfErrorMessageKey(state.result.error))}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Quarantine */}
      {result && result.quarantined.length > 0 && (
        <Card className="lg:col-span-2">
          <div className="border-b border-hairline p-4">
            <h2 className="text-h3 font-medium">{t("quarantineTitle")}</h2>
            <p className="text-label text-muted">
              {t("quarantineLead", { n: result.quarantined.length })}
            </p>
          </div>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH className="w-40">Ref</TH>
                  <TH>{t("quarantineReason")}</TH>
                </TR>
              </THead>
              <TBody>
                {result.quarantined.map((q, i) => (
                  <TR key={i}>
                    <TD className="mono text-label">{q.ref}</TD>
                    <TD className="text-at-risk-text">{q.reason}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "text" | "atRisk" | "muted";
}) {
  const color =
    tone === "atRisk" ? "text-at-risk" : tone === "muted" ? "text-muted" : "text-text";
  return (
    <div className="rounded-md bg-surface-2 p-3">
      <p className="text-label text-muted">{label}</p>
      <CountUp value={value} durationMs={600} className={cn("text-display font-display font-medium", color)} />
    </div>
  );
}
