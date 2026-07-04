import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/shell/page-header";
import { IngestPanel } from "@/components/modules/ingest-panel";

export const dynamic = "force-dynamic";

export default async function IngestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSession(locale);
  const t = await getTranslations("ingest");

  return (
    <div>
      <PageHeader title={t("title")} lead={t("emptyBody")} />
      <IngestPanel />
    </div>
  );
}
