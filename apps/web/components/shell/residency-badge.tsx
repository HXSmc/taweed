import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Trust in chrome (design-brief §7): a compact data-residency lockup, graphite
// hairline treatment, not a green padlock. Demonstration beats assertion.
export function ResidencyBadge() {
  const t = useTranslations("trust");
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="hidden items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2 py-1 text-label text-muted md:inline-flex">
            <ShieldCheck className="size-3.5 text-money-neutral" aria-hidden />
            {t("residencyShort")}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{t("residency")}</p>
          <p className="mt-1 text-muted">{t("everyAccessLogged")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
