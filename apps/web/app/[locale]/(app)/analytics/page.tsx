import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getAnalytics } from "@/lib/data";
import { formatPct, toNumber } from "@/lib/money";
import { PageHeader, Provenance } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoneyFigure } from "@/components/money/money-figure";
import { RankedBars } from "@/components/charts/ranked-bars";
import { Pareto } from "@/components/charts/pareto";
import { TrendLine } from "@/components/charts/trend-line";
import { denialLabel, isDenialReasonCode } from "@taweed/shared";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const t = await getTranslations("analytics");
  const tc = await getTranslations("common");

  const { money, byPayer, byBranch, pareto, trend } = await getAnalytics(
    session.tenantId,
  );

  const totalClaims = byPayer.reduce((a, r) => a + r.claims, 0);
  const totalDenied = byPayer.reduce((a, r) => a + r.denied, 0);
  const rate = totalClaims > 0 ? totalDenied / totalClaims : 0;

  return (
    <div>
      <PageHeader title={t("title")} />

      {/* Hero strip — the largest type in the app is money they are losing. */}
      <section className="rounded-xl border border-hairline bg-surface-1 p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-label font-medium uppercase tracking-wide text-muted">
              {tc("fromYourData")}
            </p>
            <div className="mt-2 flex items-baseline gap-4">
              <span className="num-hero text-hero font-medium leading-none text-at-risk">
                {formatPct(rate)}
              </span>
              <span className="text-h2 text-muted">{t("denialRate")}</span>
            </div>
            <Provenance>
              {tc("syntheticData")}, {tc("lastMonths", { n: 6 })}
            </Provenance>
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-label font-medium uppercase tracking-wide text-muted">
              {t("atRiskSar")}
            </span>
            <MoneyFigure value={toNumber(money.atRiskSar)} tone="atRisk" size="hero" />
          </div>
        </div>
        <p className="mt-4 border-t border-hairline pt-4 text-body text-muted">
          {t("benchmark")}
        </p>
      </section>

      {/* Broken bento grid — scale contrast carries hierarchy, hairlines separate. */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLine points={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("byReason")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Pareto rows={pareto} />
            <ul className="mt-3 flex flex-col gap-1.5">
              {pareto.slice(0, 4).map((r) => (
                <li key={r.code} className="flex items-center justify-between text-label">
                  <span className="mono text-muted">{r.code.replace("TWD-", "")}</span>
                  <span className="flex-1 truncate px-2 text-muted">
                    {isDenialReasonCode(r.code) ? denialLabel(r.code) : r.label}
                  </span>
                  <span className="num text-at-risk-text">{r.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("byPayer")}</CardTitle>
            <Badge variant="atRisk">SAR</Badge>
          </CardHeader>
          <CardContent>
            <RankedBars
              items={byPayer.map((r) => ({
                key: r.key,
                label: r.label,
                rate: r.rate,
                atRiskSar: r.atRiskSar,
                denied: r.denied,
                claims: r.claims,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("byBranch")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars
              tone="neutral"
              items={byBranch.map((r) => ({
                key: r.key,
                label: r.label,
                rate: r.rate,
                atRiskSar: r.atRiskSar,
                denied: r.denied,
                claims: r.claims,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
