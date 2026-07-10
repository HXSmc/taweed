"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { UploadCloud, FileJson, CheckCircle2, Loader2 } from "lucide-react";
import { resolveUploadState, isCsvLikeFile, type UploadState } from "@/lib/ingest-submit";
import { resolveCsvPreview, resolveCsvCommit, type CsvMappingState } from "@/lib/csv-mapping-submit";
import type { ExtractEobPdfResult } from "@/lib/actions/eob-extract";
import type { IngestResult } from "@/lib/actions/ingest";
import type { CanonicalField } from "@taweed/ingest";
import { formatMoney } from "@/lib/money";
import { CountUp } from "@/components/money/count-up";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { CsvMappingPanel } from "@/components/modules/csv-mapping-panel";
import { cn } from "@/lib/utils";

// EXECUTE B6 — maps a CSV-preview failure code to a translated message key
// under "ingest.csvMapping". previewCsvMapping never forwards the raw parser
// exception text (see ingest-csv.ts) — "xlsx_not_wired" is its own fixed
// code for the XLSX seam's "not wired" throw (packages/ingest/src/xlsx.ts),
// and any other parse failure is the generic "parse_error" code.
function csvPreviewErrorMessageKey(error: string): string {
  if (error === "not_authorized") return "csvMapping.notAuthorized";
  if (error === "rate_limited") return "csvMapping.rateLimited";
  if (error === "empty_file") return "csvMapping.emptyFile";
  if (error === "file_too_large") return "csvMapping.fileTooLarge";
  if (error === "xlsx_not_wired") return "csvMapping.xlsxNotWired";
  return "csvMapping.previewFailed";
}

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
//
// `onIngestSuccess` is optional and additive (A2 first-run corridor step 3):
// the /ingest page renders this with no props, exactly as before. The
// corridor passes a callback so it can advance to the handoff step the
// instant a JSON/FHIR-bundle upload actually succeeds, without duplicating
// any of this component's dropzone/run-ledger logic.
export function IngestPanel({
  onIngestSuccess,
}: {
  onIngestSuccess?: (result: IngestResult) => void;
} = {}) {
  const t = useTranslations("ingest");
  const [pending, start] = React.useTransition();
  const [state, setState] = React.useState<UploadState | null>(null);
  const [csvState, setCsvState] = React.useState<CsvMappingState | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const runLedgerHeadingRef = React.useRef<HTMLHeadingElement>(null);
  // Tracks whether the mapping panel was showing on the previous render, so
  // the focus effect below only fires on the actual preview -> committed/
  // cancelled transition — never on this component's own initial mount
  // (unlike a dedicated single-purpose wizard, IngestPanel is embedded in a
  // larger page and must not steal focus just by rendering).
  const wasShowingCsvMappingPanel = React.useRef(false);

  const submit = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    // A CSV/TSV/XLSX drop routes to the field-mapping panel (design-brief
    // §8.1) instead of the FHIR-bundle JSON path — the operator confirms the
    // mapping before anything is committed (see handleCsvConfirm below).
    if (isCsvLikeFile(file)) {
      setState(null);
      start(async () => {
        const next = await resolveCsvPreview(file, fd);
        setCsvState(next);
      });
      return;
    }
    setCsvState(null);
    start(async () => {
      const next = await resolveUploadState(file, fd);
      setState(next);
      // Called directly where the result becomes available, not via a
      // useEffect watching `state` — notifying a caller of a state change
      // belongs in the event handler that produced it (react/hooks.md).
      if (next.kind === "json" && next.result.ok) onIngestSuccess?.(next.result);
    });
  };

  const handleCsvConfirm = (overrides: Partial<Record<CanonicalField, string | null>>) => {
    if (csvState?.kind !== "preview") return;
    const { file } = csvState;
    start(async () => {
      const next = await resolveCsvCommit(file, overrides);
      setCsvState(next);
      if (next.kind === "committed" && next.result.ok) onIngestSuccess?.(next.result);
    });
  };

  const handleCsvCancel = () => setCsvState(null);

  const jsonResult = state?.kind === "json" ? state.result : null;
  const csvResult = csvState?.kind === "committed" ? csvState.result : null;
  const result = jsonResult ?? csvResult;
  const showCsvMappingPanel = csvState?.kind === "preview";
  const csvPreviewError = csvState?.kind === "previewFailed" ? csvState.error : null;
  const stage = pending ? "parsing" : state || csvState ? "ready" : "idle";
  // A stable identity for the file currently under mapping review — keyed on
  // the <CsvMappingPanel> below so React remounts it (fresh `selections`
  // state) whenever a new file replaces one already being reviewed, instead
  // of reusing the first file's column selections against the second file's
  // headers.
  const csvMappingPanelKey =
    csvState?.kind === "preview"
      ? `${csvState.file.name}:${csvState.file.size}:${csvState.file.lastModified}`
      : undefined;

  // Moves focus to the run-ledger heading whenever the mapping panel just
  // closed (Confirm succeeded, or Cancel) — otherwise focus is left on the
  // now-unmounted Confirm/Cancel button and lands on <body>, giving a
  // keyboard/screen-reader user no signal the transition happened.
  React.useEffect(() => {
    if (wasShowingCsvMappingPanel.current && !showCsvMappingPanel) {
      runLedgerHeadingRef.current?.focus();
    }
    wasShowingCsvMappingPanel.current = showCsvMappingPanel;
  }, [showCsvMappingPanel]);

  // Always-mounted live region for the CSV mapping panel's lifecycle
  // (same established idiom as appeals-composer.tsx's composerStatusMessage):
  // the mapping panel and the run ledger are two different Card instances
  // that swap via conditional JSX with no other page navigation, so a freshly
  // (re)mounted, already-populated live region is never announced on its
  // own — this node stays mounted the whole time and only its text changes.
  const csvStatusMessage =
    csvState?.kind === "preview"
      ? t("csvMapping.rowsDetected", { n: csvState.rowCount })
      : csvState?.kind === "committed"
        ? csvState.result.ok
          ? t("resultLead", {
              claims: csvState.result.claims,
              denials: csvState.result.denials,
              atRisk: formatMoney(csvState.result.atRiskSar),
            })
          : (csvState.result.error ?? t("csvMapping.previewFailed"))
        : "";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        data-testid="csv-lifecycle-announcer"
      >
        {csvStatusMessage}
      </p>

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
        {/* Contrast fix (WCAG AA finding): text-faint is 3.42:1 (light) / 3.67:1
         * (dark), below the 4.5:1 normal-text minimum. text-muted is the next
         * token up the scale and clears AA in both themes (see the same fix in
         * marketing/landing.tsx). */}
        <p className="mono text-label text-muted">{t("dropzoneHint")}</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json,application/pdf,.pdf,.csv,text/csv,.tsv,text/tab-separated-values,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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

      {/* CSV/TSV/XLSX field-mapping panel — replaces the run ledger while the
          operator reviews the detected mapping. Nothing is committed until
          they press Confirm (design-brief §8.1: no auto-proceed on high
          confidence, this is a PHI-adjacent intake surface). */}
      {showCsvMappingPanel && csvState.kind === "preview" && (
        <CsvMappingPanel
          key={csvMappingPanelKey}
          headers={csvState.headers}
          suggestions={csvState.suggestions}
          rowCount={csvState.rowCount}
          onConfirm={handleCsvConfirm}
          onCancel={handleCsvCancel}
          pending={pending}
        />
      )}

      {/* Run ledger */}
      {!showCsvMappingPanel && (
        <Card className="p-5">
          <h2
            ref={runLedgerHeadingRef}
            tabIndex={-1}
            className="mb-4 text-h3 font-medium focus:outline-none"
          >
            {t("runLedger")}
          </h2>
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

          {csvPreviewError && (
            <p
              role="alert"
              aria-live="assertive"
              className="rounded-md bg-at-risk-bg p-3 text-body text-at-risk-text"
            >
              {t(csvPreviewErrorMessageKey(csvPreviewError))}
            </p>
          )}

          {!csvPreviewError && state?.kind !== "pdf" && (
            <>
              <div role="status" aria-live="polite" className="grid grid-cols-3 gap-3">
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
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-4 border-t border-hairline pt-4 text-body"
                >
                  {t("resultLead", {
                    claims: result.claims,
                    denials: result.denials,
                    atRisk: formatMoney(result.atRiskSar),
                  })}
                </p>
              )}
              {result?.error && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="mt-4 rounded-md bg-at-risk-bg p-3 text-body text-at-risk-text"
                >
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
      )}

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
                  <TH className="w-40">{t("quarantineRef")}</TH>
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
