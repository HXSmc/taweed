"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Catches an unhandled throw from any (app) page's per-request data fetch
// (e.g. overview/page.tsx's getRecovery, analytics/page.tsx's getAnalytics,
// scrubber/page.tsx's getScrubRows — none of these calls are wrapped in
// try/catch) so a transient failure renders a scoped, on-brand recovery card
// instead of bubbling to Next's bare default error page. Must be a Client
// Component: Next.js error boundaries require it.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    // Surface the digest client-side too, so it can be correlated with the
    // server-side log line Next.js already emits for this error.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
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
