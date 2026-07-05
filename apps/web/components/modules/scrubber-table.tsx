"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import type { ScrubRow } from "@/lib/data";
import type { ScrubFlag } from "@taweed/rules-engine";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  TableWrap,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui/table";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FlagExplainer } from "@/components/modules/flag-explainer";

function riskColor(score: number): string {
  if (score >= 60) return "bg-at-risk";
  if (score >= 30) return "bg-at-risk-soft";
  return "bg-money-neutral";
}

export function ScrubberTable({ rows }: { rows: ScrubRow[] }) {
  const t = useTranslations("scrubber");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [selected, setSelected] = React.useState<ScrubRow | null>(null);

  const msg = (f: ScrubFlag) => (locale === "ar" ? f.message_ar : f.message_en);

  return (
    <>
      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH className="w-56">{t("risk")}</TH>
              <TH>{t("claimId")}</TH>
              <TH>{t("patient")}</TH>
              <TH>{tc("payer")}</TH>
              <TH>{t("codes")}</TH>
              <TH className="text-end">{t("amount")}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const top = r.result.flags[0];
              return (
                <TR
                  key={r.claimId}
                  className="cursor-pointer"
                  onClick={() => setSelected(r)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Claim ${r.nphiesClaimId ?? r.claimId}, risk ${r.result.riskScore}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(r);
                    }
                  }}
                >
                  <TD>
                    <div className="flex items-center gap-2">
                      <span className="num w-7 text-end text-body font-medium tabular-nums">
                        {r.result.riskScore}
                      </span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            riskColor(r.result.riskScore),
                          )}
                          style={{ width: `${r.result.riskScore}%` }}
                        />
                      </div>
                      <span className="truncate text-label text-muted">
                        {top
                          ? msg(top)
                          : r.result.unevaluable.length
                            ? t("needsData")
                            : "—"}
                      </span>
                    </div>
                  </TD>
                  <TD className="mono text-label">
                    {r.nphiesClaimId ?? r.claimId.slice(0, 8)}
                  </TD>
                  <TD className="mono text-label text-muted">
                    {r.patientLabel}
                  </TD>
                  <TD>{r.payerName}</TD>
                  <TD>
                    <span className="mono text-label text-muted">
                      {r.sbsCodes.slice(0, 3).join(", ") || "—"}
                    </span>
                  </TD>
                  <TD className="text-end num">{formatMoney(r.amount)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableWrap>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <SheetContent title={t("detailTitle")}>
            <div className="mb-4 flex items-center justify-between rounded-md bg-surface-2 p-3">
              <span className="mono text-label">
                {selected.nphiesClaimId ?? selected.claimId.slice(0, 8)}
              </span>
              <span className="num text-h3 font-medium">
                {selected.result.riskScore}
              </span>
            </div>
            <ul className="flex flex-col gap-3">
              {selected.result.flags.map((f) => (
                <li
                  key={f.ruleId}
                  className="rounded-md border border-hairline p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-body font-medium">{f.ruleName}</span>
                    <Badge
                      variant={f.severity === "high" ? "atRisk" : "neutral"}
                      className="capitalize"
                    >
                      {f.severity}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-body text-muted">{msg(f)}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-label text-muted">
                    <span className="rounded-sm bg-surface-2 px-1.5 py-0.5">
                      {t("fieldLabel")}: <span className="mono">{f.field}</span>
                    </span>
                    <span className="rounded-sm bg-surface-2 px-1.5 py-0.5">
                      {t("ruleLabel")}: <span className="mono">{f.ruleId}</span>
                    </span>
                  </p>
                  <FlagExplainer
                    ruleId={f.ruleId}
                    ruleVersion={selected.ruleVersions[f.ruleId] ?? 1}
                  />
                </li>
              ))}
              {selected.result.unevaluable.map((id) => (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-dashed border-hairline p-3 text-label text-muted"
                >
                  <AlertTriangle className="size-4 text-at-risk-soft" />
                  {t("needsData")} · <span className="mono">{id}</span>
                </li>
              ))}
              {selected.result.flags.length === 0 &&
                selected.result.unevaluable.length === 0 && (
                  <li className="text-body text-muted">—</li>
                )}
            </ul>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
