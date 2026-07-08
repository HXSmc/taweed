import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { isVisible } from "@/lib/rbac";
import { listPendingEobExtractions } from "@/lib/eob-review-data";
import { PageHeader } from "@/components/shell/page-header";
import { IngestPanel } from "@/components/modules/ingest-panel";
import { EobReviewQueue } from "@/components/modules/eob-review-queue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function IngestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  // Server-enforced RBAC gate for the read path: rbac.ts's MATRIX marks
  // ingest "hidden" for owner and clinician — the rail already hides the nav
  // link, but a direct navigation to /[locale]/ingest must not be allowed to
  // reach the PHI-adjacent EOB extraction queue below just because the role
  // has a valid session (authz.ts's doc-comment promise: server-enforced, not
  // just hidden nav).
  if (!isVisible(session.role, "ingest")) notFound();
  const t = await getTranslations("ingest");
  const tr = await getTranslations("reviewQueue");

  // AI-4: the review queue is per-tenant pending eob_extractions rows (plan 04
  // §9) — a human reviews every model extraction before it can reach claims.
  const pending = await listPendingEobExtractions(session.tenantId);

  return (
    <div>
      <PageHeader title={t("title")} lead={t("emptyBody")} />
      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">{t("title")}</TabsTrigger>
          <TabsTrigger value="review">
            {tr("tabTitle")}
            {pending.length > 0 && (
              <span className="ms-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent-subtle px-1 text-label text-accent">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <IngestPanel />
        </TabsContent>
        <TabsContent value="review">
          <EobReviewQueue rows={pending} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
