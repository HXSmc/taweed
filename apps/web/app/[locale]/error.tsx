"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// (app)/error.tsx only catches throws from page.tsx files — Next.js error
// boundaries never catch a throw from the layout.tsx of their OWN segment.
// (app)/layout.tsx has the same un-try/caught `await getX(...)` pattern as
// the pages (getMoneyScope, getBranches, both session-scoped DB reads run on
// every authenticated navigation), so without a boundary one level up here,
// a failure there would still bubble to Next's bare default error page. This
// file is that boundary: nested inside [locale]/layout.tsx's
// NextIntlClientProvider (which has already rendered by the time a CHILD
// segment's layout throws), so translations still resolve even though the
// Rail/CommandBar chrome that (app)/layout.tsx would have built is gone.
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <TriangleAlert className="size-8 text-at-risk" aria-hidden="true" />
          <p className="text-h3 font-medium">{t("errorTitle")}</p>
          <p className="text-body text-muted">{t("errorBody")}</p>
          <Button onClick={() => reset()} className="mt-2">
            {t("tryAgain")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
