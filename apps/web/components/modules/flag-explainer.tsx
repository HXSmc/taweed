"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";
import type { FlagExplanation } from "@taweed/ai";
import { explainFlagAction } from "@/lib/actions/explain-flag";
import { cn } from "@/lib/utils";

// AI-1 — additive, on-demand explanation for a scrub flag (plan 04 §2). The
// deterministic message is always rendered by the parent; this reveals the
// bilingual AI explanation only when asked, and degrades to a muted "unavailable"
// note when AI is off (graceful absence — design-brief §13). PHI-free: only the
// rule id + version leave the client; the prompt is server-derived.

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: FlagExplanation }
  | { status: "unavailable" };

export function FlagExplainer({
  ruleId,
  ruleVersion,
}: {
  ruleId: string;
  ruleVersion: number;
}) {
  const t = useTranslations("scrubber");
  const locale = useLocale();
  const [state, setState] = React.useState<State>({ status: "idle" });
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();

  async function handleToggle() {
    // A request is already in flight — ignore the click so a rapid double-click
    // can't fire a second (paid) request that also misses the server cache.
    if (state.status === "loading") return;
    // Already fetched — just collapse/expand, no second call (dedupe is also
    // server-side, but avoid the round-trip entirely once we have the answer).
    if (state.status === "ready" || state.status === "unavailable") {
      setOpen((o) => !o);
      return;
    }
    setOpen(true);
    setState({ status: "loading" });
    const res = await explainFlagAction(ruleId, ruleVersion);
    setState(res ? { status: "ready", data: res } : { status: "unavailable" });
  }

  const isAr = locale === "ar";
  const explanation =
    state.status === "ready"
      ? isAr
        ? state.data.explanation_ar
        : state.data.explanation_en
      : "";
  const fix =
    state.status === "ready"
      ? isAr
        ? state.data.suggested_fix_ar
        : state.data.suggested_fix_en
      : "";

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-1.5 rounded-sm text-label font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        {t("explain")}
        {state.status === "loading" ? (
          <Loader2
            className="size-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={t("aiExplanation")}
          aria-live="polite"
          aria-busy={state.status === "loading"}
          className="mt-2 rounded-md border border-hairline bg-surface-2 p-3"
        >
          {state.status === "loading" && (
            <p className="text-label text-muted">{t("explaining")}</p>
          )}
          {state.status === "unavailable" && (
            <p className="text-label text-muted">{t("explainUnavailable")}</p>
          )}
          {state.status === "ready" && (
            <div className="flex flex-col gap-2">
              <p className="text-body">{explanation}</p>
              <div>
                <p className="text-label font-medium text-muted">
                  {t("suggestedFix")}
                </p>
                <p className="text-body">{fix}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
