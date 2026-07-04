import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getScrubRows } from "@/lib/data";
import { recordPhiAccess } from "@/lib/audit";
import { formatMoney, toNumber } from "@/lib/money";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ScrubberTable } from "@/components/modules/scrubber-table";

export const dynamic = "force-dynamic";

export default async function ScrubberPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const t = await getTranslations("scrubber");

  const rows = await getScrubRows(session.tenantId);
  // Reading claim + patient rows is a PHI read — record it (no PHI in the log).
  await recordPhiAccess("read", "scrubber-batch", session.tenantId);

  const flagged = rows.filter((r) => r.result.flags.length > 0);
  const protectsSar = flagged.reduce((a, r) => a + toNumber(r.amount), 0);

  return (
    <div>
      <PageHeader title={t("title")} lead={t("lead")} />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-h3 font-medium">{t("emptyTitle")}</p>
            <p className="mt-1 text-body text-muted">{t("emptyBody")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Prevention in the same money units as recovery (design-brief §8.3). */}
          <div className="mb-5 flex items-center gap-3 rounded-lg border border-hairline bg-at-risk-bg/40 p-4">
            <ShieldAlert className="size-5 shrink-0 text-at-risk" />
            <p className="text-body">
              {t("protects", {
                n: flagged.length,
                amount: formatMoney(protectsSar),
              })}
            </p>
          </div>
          <Card>
            <ScrubberTable rows={rows} />
          </Card>
        </>
      )}
    </div>
  );
}
