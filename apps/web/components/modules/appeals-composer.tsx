"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, ShieldCheck, Loader2, Download, Sparkles, Plus, X } from "lucide-react";
import { levenshtein } from "@taweed/shared";
import type { AppealSuggestion } from "@taweed/appeals";
import type { AppealableRow } from "@/lib/appeals-data";
import type { AppealResult } from "@/lib/appeals-data";
import { loadAppealDraft, recordAppealExport } from "@/lib/actions/appeals";
import { createRequestGuard } from "@/lib/request-guard";
import {
  assistAppealAction,
  recordSuggestionEditAction,
} from "@/lib/actions/assist-appeal";
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
  // Per-language letter body so toggling EN/AR never discards reviewer edits or the
  // AI paragraphs inserted into one language (each keeps its own working copy).
  const [bodies, setBodies] = React.useState<{ en: string; ar: string }>({
    en: "",
    ar: "",
  });
  const body = bodies[lang];
  const setBody = React.useCallback(
    (v: string | ((prev: string) => string)) =>
      setBodies((prev) => ({
        ...prev,
        [lang]: typeof v === "function" ? v(prev[lang]) : v,
      })),
    [lang],
  );
  const [name, setName] = React.useState(reviewerName);
  const [reviewed, setReviewed] = React.useState(false);
  const [, start] = React.useTransition();
  // Tracks the loadAppealDraft round-trip explicitly rather than relying on
  // useTransition's own `isPending`: React 18 only keeps a transition
  // "pending" for the synchronous portion of an async callback, so it flips
  // back to false right after `select()` fires and well before
  // loadAppealDraft's promise actually settles — leaving no reliable signal
  // to gate the loading UI/announcement on.
  const [isLoadingDraft, setIsLoadingDraft] = React.useState(false);

  // Roving tabindex for the queue (WCAG 2.1.1/2.4.3): only ONE row is a Tab
  // stop at a time (`queueFocusIdx`); Up/Down/Home/End move focus between
  // rows without consuming a Tab press. With up to 100 rows in a seeded
  // tenant, without this a keyboard user had to Tab through every remaining
  // row to reach the composer — this collapses the whole queue to a single
  // Tab stop, same as any standard listbox/toolbar composite widget.
  const [queueFocusIdx, setQueueFocusIdx] = React.useState(0);
  const queueRowRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const moveQueueFocus = (nextIdx: number) => {
    if (queue.length === 0) return;
    const clamped = Math.max(0, Math.min(queue.length - 1, nextIdx));
    setQueueFocusIdx(clamped);
    queueRowRefs.current[clamped]?.focus();
  };

  const handleQueueRowKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number,
  ) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveQueueFocus(idx + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveQueueFocus(idx - 1);
        break;
      case "Home":
        e.preventDefault();
        moveQueueFocus(0);
        break;
      case "End":
        e.preventDefault();
        moveQueueFocus(queue.length - 1);
        break;
      default:
        break;
    }
  };
  // Guards select()'s async loadAppealDraft against out-of-order resolution:
  // rapid clicks between rows must not let an earlier click's stale response
  // overwrite the draft/bodies for whatever row is selected now.
  const draftRequest = React.useRef(createRequestGuard()).current;

  // AI-2 assist state (additive; the deterministic body above always stands alone).
  type AssistState = "idle" | "loading" | "ready" | "suppressed" | "unavailable";
  const [assist, setAssist] = React.useState<AssistState>("idle");
  const [suggestion, setSuggestion] = React.useState<AppealSuggestion | null>(null);
  const [suggestionId, setSuggestionId] = React.useState<string | null>(null);
  const [edited, setEdited] = React.useState<Record<string, string>>({});

  const resetAssist = () => {
    setAssist("idle");
    setSuggestion(null);
    setSuggestionId(null);
    setEdited({});
  };

  const select = (denialId: string) => {
    setSelected(denialId);
    setReviewed(false);
    resetAssist();
    const token = draftRequest.issue();
    setIsLoadingDraft(true);
    start(async () => {
      const r = await loadAppealDraft(denialId);
      // Drop stale responses: if a later select() has issued a newer token
      // since this request started, this result no longer belongs to the
      // currently-selected row.
      if (!draftRequest.isCurrent(token)) return;
      setDraft(r);
      setIsLoadingDraft(false);
      // Seed BOTH language bodies from the deterministic template up front, so a
      // later language toggle swaps between working copies instead of re-deriving.
      if (r) setBodies({ en: r.draft.body_en, ar: r.draft.body_ar });
    });
  };

  const requestAssist = async () => {
    if (!selected) return;
    setAssist("loading");
    const r = await assistAppealAction(selected, lang);
    if (r.ok && r.suggestion) {
      setSuggestion(r.suggestion);
      setSuggestionId(r.suggestionId ?? null);
      setEdited({});
      setAssist("ready");
    } else if (r.suppressed) {
      setAssist("suppressed");
    } else {
      setAssist("unavailable");
    }
  };

  // Insert a (possibly reviewer-edited) suggestion paragraph into the letter body
  // and record the edit distance — the ongoing quality metric (plan §4.2). NOTE:
  // one appeal_suggestions row per suggestion REQUEST; the metric captures the
  // FIRST action's outcome + edit distance (updateSuggestionOutcome only mutates a
  // still-'suggested' row). A later insert/discard on the same request is a no-op —
  // an accepted v1 aggregate; per-paragraph metrics would need a child table.
  const insertParagraph = async (idx: number, original: string) => {
    const key = `${lang}-${idx}`;
    const text = (edited[key] ?? original).trim();
    if (text.length === 0) return;
    setBody((b) => (b.trim() ? `${b}\n\n${text}` : text));
    if (suggestionId) {
      const dist = levenshtein(original, text);
      await recordSuggestionEditAction(
        suggestionId,
        dist > 0 ? "edited" : "inserted",
        dist,
        text.length,
      );
    }
  };

  const discardSuggestion = async () => {
    if (suggestionId) {
      await recordSuggestionEditAction(suggestionId, "discarded", 0, 0);
    }
    resetAssist();
  };

  const suggestionParagraphs =
    suggestion === null
      ? []
      : lang === "ar"
        ? suggestion.paragraphs_ar
        : suggestion.paragraphs_en;

  // Toggle language only — each language's body is its own working copy (seeded in
  // select), so switching never overwrites edits or inserted AI paragraphs.
  const switchLang = (next: "en" | "ar") => {
    if (next === lang) return;
    setLang(next);
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

  // WCAG 4.1.3 Status Messages: select() swaps the whole composer panel
  // (empty -> pending -> loaded) via conditional JSX with no visual page
  // navigation, so a screen-reader user gets no other signal the click
  // registered or that new content arrived. This mirrors the always-mounted
  // role="status" convention in ingest-panel.tsx / eob-review-queue.tsx —
  // the node must exist before its text changes for assistive tech to
  // pick up the mutation.
  const composerStatusMessage = !selected
    ? ""
    : isLoadingDraft
      ? t("loadingDraft")
      : draft
        ? t("draftLoaded", { payer: draft.context.payerName, amount: formatMoney(draft.deniedSar) })
        : t("emptyBody");

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[22rem_1fr]">
      {/* Queue, sorted by SAR */}
      <Card className="overflow-hidden">
        <div className="border-b border-hairline p-3">
          <h2 className="text-h3 font-medium">{t("queue")}</h2>
        </div>
        <ul className="max-h-[36rem] divide-y divide-hairline overflow-y-auto">
          {queue.map((d, idx) => (
            <li key={d.denialId}>
              <button
                ref={(el) => {
                  queueRowRefs.current[idx] = el;
                }}
                onClick={() => select(d.denialId)}
                onFocus={() => setQueueFocusIdx(idx)}
                onKeyDown={(e) => handleQueueRowKeyDown(e, idx)}
                tabIndex={idx === queueFocusIdx ? 0 : -1}
                aria-current={selected === d.denialId ? "true" : undefined}
                className={cn(
                  "focus-ring flex w-full flex-col gap-1 p-3 text-start transition-colors hover:bg-surface-2",
                  selected === d.denialId && "bg-accent-subtle",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-body font-medium">{d.payerName}</span>
                  <span className="num text-at-risk-text">SAR {formatMoney(d.deniedSar)}</span>
                </div>
                <div className="flex items-center justify-between text-label text-muted">
                  {/* reasonLabel is always the hardcoded English DENIAL_REASON_CODES
                      label (packages/shared/src/denial-codes.ts) — no Arabic variant
                      exists yet. On /ar (html lang="ar") that would announce English
                      text with no language marker (WCAG 3.1.2). `lang="en"` tells
                      assistive tech to switch pronunciation rules for this span
                      regardless of the surrounding page locale. */}
                  <span className="truncate" lang="en">
                    {d.reasonLabel}
                  </span>
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
        {/* Always-mounted live region: announces the select() -> loadAppealDraft
            lifecycle (loading, then loaded-with-context, or empty) since the
            panel below swaps entirely via conditional JSX with no other
            assistive-tech signal. */}
        <p className="sr-only" role="status" aria-live="polite">
          {composerStatusMessage}
        </p>
        {!selected ? (
          <div className="grid h-full min-h-[24rem] place-items-center text-center">
            <div>
              <FileText className="mx-auto size-8 text-muted" />
              <p className="mt-2 text-body text-muted">{t("lead")}</p>
            </div>
          </div>
        ) : isLoadingDraft ? (
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
                  {draft.context.payerName} ·{" "}
                  {/* Same hardcoded-English denial reasonLabel as the queue row
                      above — tag it lang="en" so Arabic screen-reader voices
                      don't attempt Arabic phonetics on it (WCAG 3.1.2). */}
                  <span lang="en">{draft.reasonLabel}</span>
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
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => switchLang(l)}
                  className={cn(
                    "focus-ring rounded-md px-3 py-1.5 text-label font-medium",
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
              aria-label={t("draft")}
              className="focus-ring-field w-full rounded-md border border-hairline bg-surface-1 p-3 text-body leading-relaxed"
            />

            {/* AI-2 — additive suggestion panel. The letter above is complete on
                its own; these are clearly-labelled DRAFT paragraphs. */}
            <div className="rounded-lg border border-dashed border-hairline p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-label font-medium text-muted">
                  <Sparkles className="size-4 text-accent" aria-hidden="true" />
                  {t("aiSuggestions")}
                </p>
                {assist === "ready" ? (
                  <Button variant="ghost" onClick={() => void discardSuggestion()}>
                    <X className="size-4" aria-hidden="true" />
                    {t("discard")}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => void requestAssist()}
                    disabled={assist === "loading"}
                  >
                    {assist === "loading" ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <Sparkles className="size-4" aria-hidden="true" />
                    )}
                    {t("aiSuggest")}
                  </Button>
                )}
              </div>

              {assist === "suppressed" && (
                <p className="mt-2 text-label text-muted">{t("aiSuppressed")}</p>
              )}
              {assist === "unavailable" && (
                <p className="mt-2 text-label text-muted">{t("aiUnavailable")}</p>
              )}

              {assist === "ready" && (
                <div
                  className="mt-3 flex flex-col gap-3"
                  role="region"
                  aria-label={t("aiSuggestions")}
                >
                  <p className="text-label text-muted">{t("aiDisclaimer")}</p>
                  {suggestionParagraphs.map((p, idx) => {
                    const key = `${lang}-${idx}`;
                    return (
                      <div
                        key={key}
                        className="rounded-md border border-hairline bg-surface-1 p-3"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          {/* Numbered so 2+ suggestion paragraphs don't share one
                              indistinguishable accessible name (WCAG 4.1.2): a
                              screen-reader user tabbing between these textareas
                              needs "AI draft 1" vs "AI draft 2", not "AI draft"
                              repeated for every paragraph. */}
                          <Badge variant="mock" id={`${key}-label`}>
                            {t("aiDraftLabelNumbered", { n: idx + 1 })}
                          </Badge>
                        </div>
                        <textarea
                          dir={lang === "ar" ? "rtl" : "ltr"}
                          value={edited[key] ?? p}
                          onChange={(e) =>
                            setEdited((m) => ({ ...m, [key]: e.target.value }))
                          }
                          rows={3}
                          aria-labelledby={`${key}-label`}
                          className="focus-ring-field w-full rounded-md border border-hairline bg-surface-1 p-2 text-body leading-relaxed"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          {/* Numbered accessible name (WCAG 4.1.2): with 2+
                              suggestion paragraphs, every "Insert" button
                              otherwise shares the identical accessible name,
                              so a screen-reader user browsing by button
                              cannot tell which paragraph a given button
                              targets without reading surrounding context.
                              aria-label overrides the visible "Insert" text
                              with "Insert AI draft {n}" while the label
                              itself stays unchanged for sighted users. */}
                          <Button
                            variant="ghost"
                            onClick={() => void insertParagraph(idx, p)}
                            aria-label={t("insertNumbered", { n: idx + 1 })}
                          >
                            <Plus className="size-4" aria-hidden="true" />
                            {t("insert")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
                    className="size-4 rounded accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
