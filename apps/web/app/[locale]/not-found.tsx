import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Renders for every notFound() call under this locale segment — including
// the ingest/recovery/settings pages' server-enforced RBAC gates
// (`if (!isVisible(session.role, "...")) notFound();`) — instead of Next's
// generic default 404 page. `not-found.js` never receives route params
// (Next.js convention), so the locale comes from next-intl's request-scoped
// resolution (set by middleware.ts for this same request) rather than an
// explicit param, same as every other next-intl server API.
export default async function LocaleNotFound() {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-h3 font-medium">{t("notFoundTitle")}</p>
          <p className="text-body text-muted">{t("notFoundBody")}</p>
          <Button asChild className="mt-2">
            <Link href="/overview">{t("backToOverview")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
