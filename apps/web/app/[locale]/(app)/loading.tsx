import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Streamed instantly as the Suspense fallback for every (app) page while its
// per-request, tenant-scoped fetch (getRecovery, getAnalytics, getScrubRows,
// ...) is in flight, so navigation shows a shaped skeleton instead of a blank
// tab for the full server render. Shared across all 9 dynamic pages since
// they follow the same header + card-grid shape (design-brief §8, §13: every
// loading state is a skeleton shaped to the real layout, not a spinner).
export default function AppLoading() {
  const t = useTranslations("common");

  return (
    <div aria-busy="true" role="status">
      <span className="sr-only">{t("loading")}</span>
      <div className="mb-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6 md:p-8">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-12 w-64" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-5">
          <Card>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-8 w-40" />
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-5">
            <Card>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-3 h-6 w-16" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-3 h-6 w-16" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
