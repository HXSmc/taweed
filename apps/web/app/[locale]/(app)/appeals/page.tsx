import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getAppealables } from "@/lib/appeals-data";
import { PageHeader } from "@/components/shell/page-header";
import { AppealsComposer } from "@/components/modules/appeals-composer";

export const dynamic = "force-dynamic";

export default async function AppealsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const t = await getTranslations("appeals");
  const tr = await getTranslations("roles");

  const queue = await getAppealables(session.tenantId);

  return (
    <div>
      <PageHeader
        title={t("title")}
        lead={t("readyNudge", { n: queue.length })}
      />
      <AppealsComposer
        queue={queue}
        reviewerName={session.email}
        reviewerRole={tr(session.role)}
      />
    </div>
  );
}
