import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/session";
import { isVisible } from "@/lib/rbac";
import { getRecovery } from "@/lib/data";
import { formatPct, toNumber } from "@/lib/money";
import { PageHeader, Provenance } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyFigure } from "@/components/money/money-figure";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const t = await getTranslations("overview");
  const tc = await getTranslations("common");

  const { money, winRate, medianDays } = await getRecovery(session.tenantId);

  return (
    <div>
      <PageHeader title={t("title")} lead={t("welcome")} />

      {/* The number is the product: recovered SAR is the emerald hero. */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6 md:p-8">
            <p className="text-label font-medium uppercase tracking-wide text-muted">
              {t("recoveredHero")}
            </p>
            <div className="mt-2">
              <MoneyFigure value={toNumber(money.recoveredSar)} tone="recovered" size="hero" />
            </div>
            <Provenance>
              {tc("syntheticData")}, {tc("lastMonths", { n: 6 })}
            </Provenance>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-5">
          <Card>
            <CardContent className="p-5">
              <p className="text-label uppercase tracking-wide text-muted">{t("atRiskHero")}</p>
              <MoneyFigure value={toNumber(money.atRiskSar)} tone="atRisk" size="stat" />
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-5">
            <Stat label={t("winRate")} value={formatPct(winRate)} />
            <Stat label={t("medianDays")} value={String(medianDays)} />
          </div>
        </div>
      </section>

      {/* Forward loop (peak-end): the last feeling is agency. The owner-report
          card 404s for roles with recovery hidden (rbac), so only render it
          when the role can actually see recovery — the scrubber card always
          shows. */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <ForwardCard href="/scrubber" label={t("runScrubber")} />
        {isVisible(session.role, "recovery") && (
          <ForwardCard href="/recovery/owner-report" label={t("buildReport")} />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-label uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 num text-display font-display font-medium">{value}</p>
      </CardContent>
    </Card>
  );
}

function ForwardCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="focus-ring group flex items-center justify-between rounded-lg border border-hairline bg-surface-1 p-5 transition-colors hover:bg-surface-2"
    >
      <span className="text-h3 font-medium">{label}</span>
      <ArrowRight
        className="size-5 text-accent transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180"
        aria-hidden
      />
    </Link>
  );
}
