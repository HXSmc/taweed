import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { isVisible } from "@/lib/rbac";
import { getAnalytics, getBranches, resolveBranchId } from "@/lib/data";
import { formatMoney, formatPct, toNumber } from "@/lib/money";
import { PageHeader, Provenance } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyFigure } from "@/components/money/money-figure";
import { RankedBars } from "@/components/charts/ranked-bars";
import { Pareto } from "@/components/charts/pareto";
import { TrendLine } from "@/components/charts/trend-line";
import { Link } from "@/i18n/navigation";
import { denialLabel, isDenialReasonCode } from "@taweed/shared";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ branch?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const t = await getTranslations("analytics");
  const tc = await getTranslations("common");

  const branches = await getBranches(session.tenantId);
  const sp = (await searchParams) ?? {};
  const branchId = resolveBranchId(sp.branch, branches);

  const { money, overallRate, byPayer, byBranch, pareto, trend } =
    await getAnalytics(session.tenantId, branchId);
  const rate = overallRate;

  // Text alternative for the trend chart (WCAG 1.1.1): describe what the two
  // series actually show, since the SVG itself carries no accessible content.
  const trendChartTitleId = "trend-chart-title";
  const trendSummary =
    trend.length > 0
      ? t("trendChartSummary", {
          start: trend[0].period,
          end: trend[trend.length - 1].period,
          deniedStart: formatMoney(toNumber(trend[0].deniedSar)),
          deniedEnd: formatMoney(toNumber(trend[trend.length - 1].deniedSar)),
          recoveredStart: formatMoney(toNumber(trend[0].recoveredSar)),
          recoveredEnd: formatMoney(
            toNumber(trend[trend.length - 1].recoveredSar),
          ),
        })
      : t("trend");

  // Text alternative for the Pareto chart (WCAG 1.1.1): the adjacent visible
  // list only shows code/label/count, so the summary carries the SAR amount
  // and cumulative-% per reason — the actual analytical point of the chart.
  const paretoChartTitleId = "pareto-chart-title";
  const paretoSummary =
    pareto.length > 0
      ? t("paretoChartSummary", {
          list: pareto
            .slice(0, 4)
            .map((r) =>
              t("paretoReasonItem", {
                code: r.code.replace("TWD-", ""),
                label: isDenialReasonCode(r.code) ? denialLabel(r.code) : r.label,
                sar: formatMoney(toNumber(r.sar)),
                cumulativePct: Math.round(r.cumulativePct),
              }),
            )
            .join(", "),
        })
      : t("byReason");

  return (
    <div>
      <PageHeader
        title={t("title")}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* rcm lands here by default (rbac.landingModule) and has no other
                route to the owner report, which otherwise only links from an
                Overview card rcm never sees on landing. Roles with recovery
                hidden (rbac) hit notFound() on the owner-report page, so don't
                offer them the link at all. */}
            {isVisible(session.role, "recovery") && (
              <Button variant="secondary" asChild>
                <Link href="/recovery/owner-report">{t("buildOwnerReport")}</Link>
              </Button>
            )}
            <Button variant="secondary" asChild>
              <Link href="/analytics/audit-report">{t("buildAuditReport")}</Link>
            </Button>
          </div>
        }
      />

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
            <CardTitle id={trendChartTitleId}>{t("trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLine
              points={trend}
              titleId={trendChartTitleId}
              summary={trendSummary}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle id={paretoChartTitleId}>{t("byReason")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Pareto rows={pareto} titleId={paretoChartTitleId} summary={paretoSummary} />
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
