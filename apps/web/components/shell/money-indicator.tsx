"use client";
import { TrendingUp, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { CountUp } from "@/components/money/count-up";
import { cn } from "@/lib/utils";

// The signature element (design-brief §7): a dual figure, always current for the
// active tenant + branch scope. Recovered counts up (goal-gradient); at-risk
// counts up once (the leak). Never color alone — each carries a label + arrow.
export function MoneyIndicator({
  recovered,
  atRisk,
  scopeLabel,
}: {
  recovered: number;
  atRisk: number;
  scopeLabel: string;
}) {
  const t = useTranslations("money");
  return (
    <div className="flex items-center gap-4" aria-label={scopeLabel}>
      <Figure
        label={t("recovered")}
        value={recovered}
        tone="recovered"
        Icon={TrendingUp}
        duration={1000}
      />
      <div className="h-8 w-px bg-hairline" aria-hidden />
      <Figure
        label={t("atRisk")}
        value={atRisk}
        tone="atRisk"
        Icon={ArrowRight}
        duration={900}
      />
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
  Icon,
  duration,
}: {
  label: string;
  value: number;
  tone: "recovered" | "atRisk";
  Icon: typeof TrendingUp;
  duration: number;
}) {
  const color = tone === "recovered" ? "text-recovered-text" : "text-at-risk-text";
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-label text-muted">{label}</span>
      <span className={`flex items-center gap-1 ${color}`}>
        <span className="text-label text-muted">SAR</span>
        <CountUp value={value} durationMs={duration} className="text-h3 font-medium num" />
        <Icon className={cn("size-3.5", tone === "atRisk" && "rtl:rotate-180")} aria-hidden />
      </span>
    </div>
  );
}
