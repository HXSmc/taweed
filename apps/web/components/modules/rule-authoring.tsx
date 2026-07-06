"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, Loader2, ShieldCheck, ShieldAlert, Check, X } from "lucide-react";
import {
  draftRuleAction,
  approveRuleAction,
  rejectRuleAction,
  type DraftRuleResult,
} from "@/lib/actions/author-rule";
import type { AuthoredRuleRow } from "@/lib/rules-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// AI-3 — NL → ScrubRule authoring surface (plan 04 §2, §4.3). The SME describes a
// billing rule; the model proposes a structured draft; the deterministic gate
// (shape → dry-run → golden) decides whether it can be approved. Nothing executes
// until a human approves. Additive + fail-safe: when AI is off, the panel shows a
// manual-authoring note and the deterministic rule library is unaffected.

interface PayerOption {
  id: string;
  name: string;
}

// Readable render of a json-rules-engine condition tree (all/any groups + leaves).
function ConditionTree({ node, depth = 0 }: { node: unknown; depth?: number }) {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const groupKey = Array.isArray(obj.all)
    ? "all"
    : Array.isArray(obj.any)
      ? "any"
      : null;
  if (groupKey) {
    const children = obj[groupKey] as unknown[];
    return (
      <ul className="flex flex-col gap-1 border-s border-hairline ps-3">
        <li className="text-label font-medium uppercase tracking-wide text-muted">
          {groupKey === "all" ? "ALL of" : "ANY of"}
        </li>
        {children.map((child, i) => (
          <li key={i}>
            <ConditionTree node={child} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof obj.fact === "string") {
    return (
      <code className="mono text-label">
        {String(obj.fact)} <span className="text-accent">{String(obj.operator)}</span>{" "}
        {JSON.stringify(obj.value)}
      </code>
    );
  }
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("settings");
  const variant =
    status === "approved" ? "accent" : status === "rejected" ? "atRisk" : "neutral";
  const label =
    status === "approved"
      ? t("statusApproved")
      : status === "rejected"
        ? t("statusRejected")
        : t("statusDraft");
  return <Badge variant={variant}>{label}</Badge>;
}

export function RuleAuthoring({
  payers,
  authoredRules,
}: {
  payers: PayerOption[];
  authoredRules: AuthoredRuleRow[];
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();

  const [text, setText] = React.useState("");
  const [scope, setScope] = React.useState<"global" | "payer">("global");
  const [payerId, setPayerId] = React.useState<string>(payers[0]?.id ?? "");
  const [result, setResult] = React.useState<DraftRuleResult | null>(null);
  const [pending, start] = React.useTransition();
  const [acting, setActing] = React.useState<string | null>(null);

  const draft = () => {
    if (text.trim().length < 3) return;
    setResult(null);
    start(async () => {
      const r = await draftRuleAction(
        text,
        scope,
        scope === "payer" ? payerId : undefined,
      );
      setResult(r);
    });
  };

  const decide = (
    rowId: string,
    fn: (id: string) => Promise<{ ok: boolean }>,
  ) => {
    setActing(rowId);
    start(async () => {
      await fn(rowId);
      setActing(null);
      setResult(null);
      router.refresh();
    });
  };

  const gate = result?.gate;
  const draftView = result?.draft;

  return (
    <div className="flex flex-col gap-5">
      {/* Composer */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-accent" aria-hidden="true" />
          <h2 className="text-h3 font-medium">{t("authorTitle")}</h2>
        </div>
        <p className="mb-3 text-body text-muted">{t("authorLead")}</p>

        <label htmlFor="sme-text" className="sr-only">
          {t("authorTitle")}
        </label>
        <textarea
          id="sme-text"
          dir={locale === "ar" ? "rtl" : "ltr"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={t("authorPlaceholder")}
          className="w-full rounded-md border border-hairline bg-surface-1 p-3 text-body leading-relaxed focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <fieldset className="flex items-center gap-1">
            <legend className="sr-only">{t("scopeLegend")}</legend>
            {(["global", "payer"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => setScope(s)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-label font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  scope === s
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:bg-surface-2",
                )}
              >
                {s === "global" ? t("scopeGlobal") : t("scopePayer")}
              </button>
            ))}
          </fieldset>

          {scope === "payer" && (
            <label className="flex flex-col gap-1 text-label text-muted">
              {t("payerLabel")}
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="rounded-md border border-hairline bg-surface-1 px-2 py-1.5 text-body focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {payers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {payers.length === 0 && <option value="">—</option>}
              </select>
            </label>
          )}

          <Button
            onClick={draft}
            disabled={pending || text.trim().length < 3}
            className="ms-auto"
          >
            {pending && !acting ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {t("draftButton")}
          </Button>
        </div>

        {/* Result */}
        {result && !result.ok && result.disabled && (
          <p className="mt-4 rounded-md border border-hairline bg-surface-2 p-3 text-body text-muted">
            {t("authorOff")}
          </p>
        )}
        {result && !result.ok && result.misconfigured && (
          <p className="mt-4 rounded-md border border-hairline bg-surface-2 p-3 text-body text-muted">
            {t("authorMisconfigured")}
          </p>
        )}
        {result && !result.ok && result.error === "generation" && (
          <p className="mt-4 rounded-md border border-hairline bg-surface-2 p-3 text-body text-muted">
            {t("authorGenError")}
          </p>
        )}

        {draftView && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-hairline bg-surface-2 p-4">
            {/* Gate verdict */}
            {gate?.ok ? (
              <p className="flex items-center gap-2 text-label font-medium text-recovered-text">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {t("gatePassed")}
              </p>
            ) : (
              <div>
                <p className="flex items-center gap-2 text-label font-medium text-at-risk-text">
                  <ShieldAlert className="size-4" aria-hidden="true" />
                  {t("gateBlocked", { stage: gate?.stage ?? "" })}
                </p>
                <ul className="mt-1 list-disc ps-6 text-label text-muted">
                  {(gate?.errors ?? []).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Draft body */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body font-medium">{draftView.name}</span>
              <Badge variant={draftView.severity === "high" ? "atRisk" : "neutral"}>
                {draftView.severity}
              </Badge>
              <span className="mono text-label text-muted">{draftView.field}</span>
              <span className="num text-label text-muted">
                {t("weightLabel")} {draftView.weight}
              </span>
            </div>
            <p className="text-body" dir={locale === "ar" ? "rtl" : "ltr"}>
              {locale === "ar" ? draftView.messageAr : draftView.messageEn}
            </p>
            {draftView.rationale && (
              <p className="text-label text-muted">{draftView.rationale}</p>
            )}
            <div>
              <p className="mb-1 text-label font-medium uppercase tracking-wide text-muted">
                {t("conditionsLabel")}
              </p>
              <ConditionTree node={draftView.conditions} />
            </div>

            {gate?.ok && result?.rowId && (
              <div className="mt-1 flex items-center gap-2">
                <Button
                  onClick={() => decide(result.rowId!, approveRuleAction)}
                  disabled={pending}
                >
                  <Check className="size-4" aria-hidden="true" />
                  {t("approve")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => decide(result.rowId!, rejectRuleAction)}
                  disabled={pending}
                >
                  <X className="size-4" aria-hidden="true" />
                  {t("reject")}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Authored-rule library */}
      <Card className="overflow-hidden">
        <div className="border-b border-hairline p-3">
          <h3 className="text-h3 font-medium">{t("authoredHeading")}</h3>
        </div>
        {authoredRules.length === 0 ? (
          <p className="p-6 text-center text-body text-muted">{t("authoredEmpty")}</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {authoredRules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                <StatusBadge status={r.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium">{r.name}</p>
                  <p className="truncate text-label text-muted">
                    <span className="mono">{r.ruleKey}</span> · {r.scope}
                    {r.payerId ? ` · ${r.payerId}` : ""} · {r.severity}
                    {r.authoredBy === "llm" ? " · AI" : ""}
                  </p>
                </div>
                {r.status === "draft" && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => decide(r.id, approveRuleAction)}
                      disabled={pending && acting === r.id}
                    >
                      {pending && acting === r.id ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        <Check className="size-4" aria-hidden="true" />
                      )}
                      {t("approve")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => decide(r.id, rejectRuleAction)}
                      disabled={pending && acting === r.id}
                    >
                      <X className="size-4" aria-hidden="true" />
                      {t("reject")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
