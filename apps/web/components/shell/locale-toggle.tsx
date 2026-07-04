"use client";
import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

// Flips the whole shell between Arabic (RTL) and English (LTR) by swapping the
// locale on the current path. The <html dir> flip mirrors everything.
export function LocaleToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const next = locale === "ar" ? "en" : "ar";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.replace(pathname, { locale: next })}
      aria-label={`Switch to ${next === "ar" ? "Arabic" : "English"}`}
      className="gap-1.5"
    >
      <Languages className="size-4" />
      <span className="font-medium">{next === "ar" ? "العربية" : "EN"}</span>
    </Button>
  );
}
