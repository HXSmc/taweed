"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileWarning, Check, X, Loader2 } from "lucide-react";
import { DENIAL_REASON_CODES } from "@taweed/shared";
import type { EobExtraction, ValidatorFinding } from "@taweed/ai";
import type { EditedEobExtractionInput } from "@/lib/actions/eob-review";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "./confidence-badge";

// AI-4 — the reviewer's correct-and-approve surface (plan 04 §9). Every field the
// model extracted is editable before it can ever be persisted; nothing here
// writes anything by itself — approve/reject are callbacks the parent wires to
// the server actions (Container/Presentational split, react/patterns.md).
//
// Money is edited in SAR (a human reasons in SAR, not halalas) and converted back
// to halalas ONLY by the server action (@taweed/analytics is a server-only
// dependency chain and must never enter this client bundle) — this file's own
// halalas->SAR conversion is display-only and intentionally duplicated rather
// than imported, and assumes non-negative amounts (always true for a remittance
// line: billed/paid/patient-share/rejected are never negative).
function halalasToSarDisplay(halalas: number): string {
  const rounded = Math.max(0, Math.round(halalas));
  const sar = Math.floor(rounded / 100);
  const rem = rounded % 100;
  return `${sar}.${rem.toString().padStart(2, "0")}`;
}

// `validatorReport` is stored as opaque jsonb (packages/ai never enters this
// client bundle) — narrow it defensively at the boundary rather than trusting
// its shape, same posture as EobExtractionSchema.safeParse on `extraction`
// server-side: a malformed/legacy row must never crash the review form.
function failingFindings(report: unknown): ValidatorFinding[] {
  if (typeof report !== "object" || report === null) return [];
  const findings = (report as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) return [];
  return findings.filter(
    (f): f is ValidatorFinding =>
      typeof f === "object" &&
      f !== null &&
      typeof (f as ValidatorFinding).check === "string" &&
      typeof (f as ValidatorFinding).passed === "boolean" &&
      typeof (f as ValidatorFinding).detail === "string" &&
      (f as ValidatorFinding).passed === false,
  );
}

function toEditedInput(extraction: EobExtraction): EditedEobExtractionInput {
  return {
    payerName: extraction.payerName,
    payerNphiesId: extraction.payerNphiesId,
    remittanceDate: extraction.remittanceDate,
    remittanceTotalPaidSar: halalasToSarDisplay(extraction.remittanceTotalPaidHalalas),
    overallConfidence: extraction.overallConfidence,
    claims: extraction.claims.map((c) => ({
      claimId: c.claimId,
      nphiesClaimId: c.nphiesClaimId,
      patientRef: c.patientRef,
      serviceDate: c.serviceDate,
      confidence: c.confidence,
      totalBilledSar: halalasToSarDisplay(c.totalBilledHalalas),
      totalPaidSar: halalasToSarDisplay(c.totalPaidHalalas),
      totalRejectedSar: halalasToSarDisplay(c.totalRejectedHalalas),
      lines: c.lines.map((l) => ({
        claimLineRef: l.claimLineRef,
        sbsCode: l.sbsCode,
        icd10amCode: l.icd10amCode,
        denialCode: l.denialCode,
        confidence: l.confidence,
        billedSar: halalasToSarDisplay(l.billedHalalas),
        paidSar: halalasToSarDisplay(l.paidHalalas),
        patientShareSar: halalasToSarDisplay(l.patientShareHalalas),
        rejectedSar: halalasToSarDisplay(l.rejectedHalalas),
      })),
    })),
  };
}

const inputCls =
  "w-full rounded-sm border border-hairline bg-surface-1 px-2 py-1 text-label focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const moneyInputCls = cn(inputCls, "num text-end");

function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.length > 0 ? e.target.value : null)}
      className={inputCls}
    />
  );
}

function MoneyField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={moneyInputCls}
    />
  );
}

export function EobExtractionForm({
  extraction,
  sourceFilename,
  escalated,
  validatorReport,
  onApprove,
  onReject,
  pending,
}: {
  extraction: EobExtraction;
  sourceFilename: string;
  escalated: boolean;
  validatorReport: unknown;
  onApprove: (edited: EditedEobExtractionInput) => void;
  onReject: () => void;
  pending: boolean;
}) {
  const t = useTranslations("reviewQueue");
  const locale = useLocale();
  const findings = failingFindings(validatorReport);
  // Seeded ONCE per mount, not re-synced via effect: the parent
  // (EobReviewQueue) renders this component with `key={selected.id}`, so a
  // genuinely new row selection remounts this component and the lazy
  // initializer below re-seeds from scratch. A `useEffect` keyed on the
  // `extraction` object's reference would ALSO fire on same-row re-renders
  // that produce a new (but logically identical) `extraction` object — e.g. a
  // future `rows` revalidation while this form stays open — silently
  // clobbering in-progress edits. Resetting state on prop change belongs on
  // the parent's `key`, not in an effect (react/hooks.md).
  const [edited, setEdited] = React.useState<EditedEobExtractionInput>(() =>
    toEditedInput(extraction),
  );

  const updateTop = (patch: Partial<EditedEobExtractionInput>) =>
    setEdited((prev) => ({ ...prev, ...patch }));

  const updateClaim = (
    i: number,
    patch: Partial<EditedEobExtractionInput["claims"][number]>,
  ) =>
    setEdited((prev) => ({
      ...prev,
      claims: prev.claims.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));

  const updateLine = (
    ci: number,
    li: number,
    patch: Partial<EditedEobExtractionInput["claims"][number]["lines"][number]>,
  ) =>
    setEdited((prev) => ({
      ...prev,
      claims: prev.claims.map((c, cidx) =>
        cidx !== ci
          ? c
          : {
              ...c,
              lines: c.lines.map((l, lidx) => (lidx === li ? { ...l, ...patch } : l)),
            },
      ),
    }));

  return (
    <div className="flex flex-col gap-4" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* No page rasterization pipeline exists this pass — a clearly-labeled
          placeholder stands in for the real page image, never a broken <img>. */}
      <Card className="flex min-h-[10rem] flex-col items-center justify-center gap-2 border-dashed p-6 text-center">
        <FileWarning className="size-6 text-muted" aria-hidden="true" />
        <p className="text-label text-muted">{t("pagePreviewPending")}</p>
        <p className="mono text-label text-faint">{sourceFilename}</p>
      </Card>

      {escalated && (
        <p className="flex items-center gap-2 rounded-md border border-hairline bg-surface-2 p-3 text-label text-muted">
          <FileWarning className="size-4" aria-hidden="true" />
          {t("escalatedNote")}
        </p>
      )}

      {/* The deterministic gate's own failing findings — the reviewer needs to
          see WHICH check failed (which line's totals disagree, which field
          missed the text-layer match), not just a bare "escalated" flag. */}
      {findings.length > 0 && (
        <Card
          role="region"
          aria-label={t("validatorFindingsHeading")}
          className="border-[color:var(--at-risk)] bg-[color:var(--at-risk-bg)] p-4"
        >
          <h3 className="mb-2 flex items-center gap-2 text-label font-medium text-[color:var(--at-risk-text)]">
            <FileWarning className="size-4" aria-hidden="true" />
            {t("validatorFindingsHeading")}
          </h3>
          <ul className="flex flex-col gap-1">
            {findings.map((f, i) => (
              <li key={i} className="mono text-label text-[color:var(--at-risk-text)]">
                {f.detail}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Remittance-level fields */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-h3 font-medium">{t("remittanceHeading")}</h3>
          <ConfidenceBadge value={edited.overallConfidence} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("payerName")}>
            <TextField
              value={edited.payerName}
              onChange={(v) => updateTop({ payerName: v })}
            />
          </Field>
          <Field label={t("payerNphiesId")}>
            <TextField
              value={edited.payerNphiesId}
              onChange={(v) => updateTop({ payerNphiesId: v })}
            />
          </Field>
          <Field label={t("remittanceDate")}>
            <TextField
              value={edited.remittanceDate}
              onChange={(v) => updateTop({ remittanceDate: v })}
            />
          </Field>
          <Field label={t("remittanceTotalPaid")}>
            <MoneyField
              value={edited.remittanceTotalPaidSar}
              onChange={(v) => updateTop({ remittanceTotalPaidSar: v })}
            />
          </Field>
        </div>
      </Card>

      {/* Claims */}
      {edited.claims.map((claim, ci) => (
        <Card key={ci} className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-body font-medium">
              {t("claimHeading", { n: ci + 1 })}
            </h4>
            <ConfidenceBadge value={claim.confidence} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("claimId")}>
              <TextField
                value={claim.claimId}
                onChange={(v) => updateClaim(ci, { claimId: v ?? "" })}
              />
            </Field>
            <Field label={t("nphiesClaimId")}>
              <TextField
                value={claim.nphiesClaimId}
                onChange={(v) => updateClaim(ci, { nphiesClaimId: v })}
              />
            </Field>
            <Field label={t("patientRef")}>
              <TextField
                value={claim.patientRef}
                onChange={(v) => updateClaim(ci, { patientRef: v })}
              />
            </Field>
            <Field label={t("serviceDate")}>
              <TextField
                value={claim.serviceDate}
                onChange={(v) => updateClaim(ci, { serviceDate: v })}
              />
            </Field>
            <Field label={t("totalBilled")}>
              <MoneyField
                value={claim.totalBilledSar}
                onChange={(v) => updateClaim(ci, { totalBilledSar: v })}
              />
            </Field>
            <Field label={t("totalPaid")}>
              <MoneyField
                value={claim.totalPaidSar}
                onChange={(v) => updateClaim(ci, { totalPaidSar: v })}
              />
            </Field>
            <Field label={t("totalRejected")}>
              <MoneyField
                value={claim.totalRejectedSar}
                onChange={(v) => updateClaim(ci, { totalRejectedSar: v })}
              />
            </Field>
          </div>

          <TableWrap className="mt-4">
            <Table>
              <THead>
                <TR>
                  <TH>{t("lineRef")}</TH>
                  <TH>{t("sbsCode")}</TH>
                  <TH>{t("icd10amCode")}</TH>
                  <TH className="text-end">{t("billed")}</TH>
                  <TH className="text-end">{t("paid")}</TH>
                  <TH className="text-end">{t("patientShare")}</TH>
                  <TH className="text-end">{t("rejected")}</TH>
                  <TH>{t("denialCode")}</TH>
                  <TH>{t("confidence")}</TH>
                </TR>
              </THead>
              <TBody>
                {claim.lines.map((line, li) => (
                  <TR key={li}>
                    <TD className="w-24">
                      <TextField
                        value={line.claimLineRef}
                        onChange={(v) => updateLine(ci, li, { claimLineRef: v ?? "" })}
                      />
                    </TD>
                    <TD className="w-24">
                      <TextField
                        value={line.sbsCode}
                        onChange={(v) => updateLine(ci, li, { sbsCode: v })}
                      />
                    </TD>
                    <TD className="w-24">
                      <TextField
                        value={line.icd10amCode}
                        onChange={(v) => updateLine(ci, li, { icd10amCode: v })}
                      />
                    </TD>
                    <TD className="w-24">
                      <MoneyField
                        value={line.billedSar}
                        onChange={(v) => updateLine(ci, li, { billedSar: v })}
                      />
                    </TD>
                    <TD className="w-24">
                      <MoneyField
                        value={line.paidSar}
                        onChange={(v) => updateLine(ci, li, { paidSar: v })}
                      />
                    </TD>
                    <TD className="w-24">
                      <MoneyField
                        value={line.patientShareSar}
                        onChange={(v) => updateLine(ci, li, { patientShareSar: v })}
                      />
                    </TD>
                    <TD className="w-24">
                      <MoneyField
                        value={line.rejectedSar}
                        onChange={(v) => updateLine(ci, li, { rejectedSar: v })}
                      />
                    </TD>
                    <TD className="w-40">
                      <label className="sr-only">{t("denialCode")}</label>
                      <select
                        value={line.denialCode ?? ""}
                        onChange={(e) =>
                          updateLine(ci, li, {
                            denialCode:
                              e.target.value.length > 0
                                ? (e.target.value as (typeof DENIAL_REASON_CODES)[number]["code"])
                                : null,
                          })
                        }
                        className={inputCls}
                      >
                        <option value="">{t("noDenial")}</option>
                        {DENIAL_REASON_CODES.map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.code} — {d.label}
                          </option>
                        ))}
                      </select>
                    </TD>
                    <TD>
                      <ConfidenceBadge value={line.confidence} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      ))}

      <div className="flex items-center gap-2">
        <Button onClick={() => onApprove(edited)} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          {t("approve")}
        </Button>
        <Button variant="ghost" onClick={onReject} disabled={pending}>
          <X className="size-4" aria-hidden="true" />
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-label text-muted">
      {label}
      {children}
    </label>
  );
}
