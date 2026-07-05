"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, ShieldCheck, Loader2, Download } from "lucide-react";
import type { AppealableRow } from "@/lib/appeals-data";
import type { AppealResult } from "@/lib/appeals-data";
import { loadAppealDraft, recordAppealExport } from "@/lib/actions/appeals";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function AppealsComposer({
  queue,
  reviewerName,
  reviewerRole,
}: {
  queue: AppealableRow[];
  reviewerName: string;
  reviewerRole: string;
}) {
  const t = useTranslations("appeals");
  const tc = useTranslations("common");
  const tr = useTranslations("trust");
  const locale = useLocale();

  const [selected, setSelected] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<AppealResult | null>(null);
  const [lang, setLang] = React.useState<"en" | "ar">(locale === "ar" ? "ar" : "en");
  const [body, setBody] = React.useState("");
  const [name, setName] = React.useState(reviewerName);
  const [reviewed, setReviewed] = React.useState(false);
  const [pending, start] = React.useTransition();

  const select = (denialId: string) => {
    setSelected(denialId);
    setReviewed(false);
    start(async () => {
      const r = await loadAppealDraft(denialId);
      setDraft(r);
      if (r) setBody(lang === "ar" ? r.draft.body_ar : r.draft.body_en);
    });
  };

  const switchLang = (next: "en" | "ar") => {
    setLang(next);
    if (draft) setBody(next === "ar" ? draft.draft.body_ar : draft.draft.body_en);
  };

  // Escape EVERY interpolated value — the letter may be opened in a browser.
  const esc = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );

  const doExport = async () => {
    if (!draft || !selected) return;
    const subject = esc(lang === "ar" ? draft.draft.subject_ar : draft.draft.subject_en);
    const dir = lang === "ar" ? "rtl" : "ltr";
    const checklist = draft.draft.docChecklist
      .map((d) => `<li>${esc(lang === "ar" ? d.label_ar : d.label_en)}</li>`)
      .join("");
    const docsTitle = lang === "ar" ? "المستندات الداعمة" : "Supporting documents";
    const footer = `${esc(tr("humanInLoop"))} · ${esc(tr("notDevice"))} · ${esc(name)}, ${esc(reviewerRole)}`;
    const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${subject}</title><style>body{font-family:system-ui;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.6}h1{font-size:18px}pre{white-space:pre-wrap;font-family:inherit}footer{margin-top:2rem;border-top:1px solid #ccc;padding-top:1rem;color:#555;font-size:12px}</style></head><body><h1>${subject}</h1><pre>${esc(body)}</pre><h2>${docsTitle}</h2><ul>${checklist}</ul><footer>${footer}</footer></body></html>`;
    // Record the export (awaited) BEFORE handing over the PHI letter, so an
    // export never completes without its compliance record.
    await recordAppealExport(selected);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appeal-${selected.slice(0, 8)}-${lang}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canExport = reviewed && name.trim().length > 0 && !!draft;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[22rem_1fr]">
      {/* Queue, sorted by SAR */}
      <Card className="overflow-hidden">
        <div className="border-b border-hairline p-3">
          <h2 className="text-h3 font-medium">{t("queue")}</h2>
        </div>
        <ul className="max-h-[36rem] divide-y divide-hairline overflow-y-auto">
          {queue.map((d) => (
            <li key={d.denialId}>
              <button
                onClick={() => select(d.denialId)}
                className={cn(
                  "flex w-full flex-col gap-1 p-3 text-start transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  selected === d.denialId && "bg-accent-subtle",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-body font-medium">{d.payerName}</span>
                  <span className="num text-at-risk-text">SAR {formatMoney(d.deniedSar)}</span>
                </div>
                <div className="flex items-center justify-between text-label text-muted">
                  <span className="truncate">{d.reasonLabel}</span>
                  <span className="num">{d.deadlineDays}d</span>
                </div>
              </button>
            </li>
          ))}
          {queue.length === 0 && (
            <li className="p-6 text-center text-body text-muted">{t("emptyBody")}</li>
          )}
        </ul>
      </Card>

      {/* Composer */}
      <Card className="p-5">
        {!selected ? (
          <div className="grid h-full min-h-[24rem] place-items-center text-center">
            <div>
              <FileText className="mx-auto size-8 text-muted" />
              <p className="mt-2 text-body text-muted">{t("lead")}</p>
            </div>
          </div>
        ) : pending ? (
          <div className="grid h-full min-h-[24rem] place-items-center">
            <Loader2 className="size-6 animate-spin text-muted" />
          </div>
        ) : !draft ? (
          <div className="grid h-full min-h-[24rem] place-items-center text-center">
            <div>
              <p className="text-body text-muted">{t("emptyBody")}</p>
              <button
                onClick={() => select(selected)}
                className="mt-2 text-body text-accent underline-offset-4 hover:underline"
              >
                {tc("review")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Context header — the SAR being appealed at the top */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 p-3">
              <div>
                <span className="mono text-label text-muted">
                  {draft.context.nphiesClaimId ?? draft.context.claimId.slice(0, 8)}
                </span>
                <p className="text-body font-medium">
                  {draft.context.payerName} · {draft.reasonLabel}
                </p>
              </div>
              <div className="text-end">
                <span className="text-label text-muted">{t("appealingCaption")}</span>
                <p className="num text-h2 font-display font-medium text-at-risk-text">
                  SAR {formatMoney(draft.deniedSar)}
                </p>
              </div>
            </div>

            {/* Language toggle — regenerates natively, not machine-translated */}
            <div className="flex items-center gap-1">
              {(["en", "ar"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => switchLang(l)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-label font-medium",
                    lang === l ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2",
                  )}
                >
                  {l === "ar" ? "العربية" : "English"}
                </button>
              ))}
              {!draft.draft.payerSpecific && (
                <Badge variant="mock" className="ms-2">
                  {t("notPayerSpecific")}
                </Badge>
              )}
            </div>

            {/* Editable draft */}
            <textarea
              dir={lang === "ar" ? "rtl" : "ltr"}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full rounded-md border border-hairline bg-surface-1 p-3 text-body leading-relaxed focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />

            {/* Doc checklist */}
            <div>
              <h3 className="mb-2 text-label font-medium uppercase tracking-wide text-muted">
                {t("checklist")}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {draft.draft.docChecklist.map((d) => (
                  <li key={d.key} className="flex items-center gap-2 text-body">
                    <span className="size-1.5 rounded-full bg-accent" />
                    {lang === "ar" ? d.label_ar : d.label_en}
                  </li>
                ))}
              </ul>
            </div>

            {/* Human-in-the-loop gate + export (visually separated) */}
            <div className="mt-2 rounded-lg border border-hairline bg-surface-2 p-4">
              <p className="mb-3 flex items-center gap-2 text-label text-muted">
                <ShieldCheck className="size-4 text-money-neutral" />
                {tr("humanInLoop")}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-label text-muted">
                    {t("reviewGate", { name: name.trim() || "…", role: reviewerRole })}
                  </span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    className="max-w-xs"
                  />
                </label>
                <label className="flex items-center gap-2 text-body">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  {t("confirmReview")}
                </label>
                <Button onClick={() => void doExport()} disabled={!canExport}>
                  <Download className="size-4" />
                  {tc("exportPdf")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
