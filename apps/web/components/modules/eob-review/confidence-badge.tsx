import { CircleCheck, CircleDot, CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

// AI-4 review-queue confidence indicator (plan 04 §9). Confidence is a MODEL
// signal, not a money state — design-brief §4.2's --at-risk/--recovered pair is
// reserved for money at-risk/recovered semantics and must never be repurposed
// here. This reuses the Badge component's existing neutral/outline/accent
// variants (no new color tokens) and never encodes the tier by color alone: an
// icon + text label ("Low"/"Medium"/"High") carry the meaning too.
const HIGH_THRESHOLD = 0.85;
const MED_THRESHOLD = 0.6;

export type ConfidenceTier = "low" | "med" | "high";

export function confidenceTier(value: number): ConfidenceTier {
  if (value >= HIGH_THRESHOLD) return "high";
  if (value >= MED_THRESHOLD) return "med";
  return "low";
}

export function ConfidenceBadge({ value }: { value: number }) {
  const t = useTranslations("reviewQueue");
  const tier = confidenceTier(value);
  const pct = Math.round(value * 100);

  if (tier === "high") {
    return (
      <Badge variant="accent" title={`${pct}%`}>
        <CircleCheck className="size-3" aria-hidden="true" />
        {t("confidenceHigh")}
      </Badge>
    );
  }
  if (tier === "med") {
    return (
      <Badge variant="outline" title={`${pct}%`}>
        <CircleDot className="size-3" aria-hidden="true" />
        {t("confidenceMed")}
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" title={`${pct}%`}>
      <CircleAlert className="size-3" aria-hidden="true" />
      {t("confidenceLow")}
    </Badge>
  );
}
