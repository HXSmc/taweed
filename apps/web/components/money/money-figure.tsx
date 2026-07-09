import { TrendingDown, TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

// A money truth rendered as the hero: muted SAR prefix at 0.5x, the number in the
// hero color, count-up, optional delta chip vs prior period. Never encodes state
// by color alone — carries a label and an arrow glyph (design-brief §3, §4.2).
interface MoneyFigureProps {
  value: number;
  tone: "recovered" | "atRisk" | "neutral";
  size?: "hero" | "stat";
  deltaPct?: number;
  className?: string;
}

const toneText: Record<MoneyFigureProps["tone"], string> = {
  recovered: "text-recovered",
  atRisk: "text-at-risk",
  neutral: "text-text",
};

export function MoneyFigure({
  value,
  tone,
  size = "hero",
  deltaPct,
  className,
}: MoneyFigureProps) {
  const Arrow =
    tone === "recovered" ? TrendingUp : tone === "atRisk" ? ArrowRight : ArrowRight;
  return (
    <div className={cn("flex items-end gap-2", className)}>
      <span className="pb-1 text-h3 font-medium text-muted">SAR</span>
      <CountUp
        value={value}
        durationMs={tone === "atRisk" ? 900 : 1000}
        className={cn(
          "num-hero font-medium leading-none",
          size === "hero" ? "text-hero" : "text-display",
          toneText[tone],
        )}
      />
      <Arrow
        className={cn("mb-2 size-5", toneText[tone], tone !== "recovered" && "rtl:rotate-180")}
        aria-hidden
      />
      {deltaPct !== undefined && (
        <span
          className={cn(
            "mb-1.5 inline-flex items-center gap-0.5 text-label num",
            deltaPct >= 0 ? "text-recovered-text" : "text-at-risk-text",
          )}
        >
          {deltaPct >= 0 ? (
            <TrendingUp className="size-3" aria-hidden />
          ) : (
            <TrendingDown className="size-3" aria-hidden />
          )}
          {Math.abs(deltaPct).toFixed(1)}%
        </span>
      )}
    </div>
  );
}
