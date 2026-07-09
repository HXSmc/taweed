import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check, X } from "lucide-react";
import { requireSession } from "@/lib/session";
import { isVisible } from "@/lib/rbac";
import { getRecovery, type AppealPipelineRow } from "@/lib/data";
import { markAppealOutcomeForm } from "@/lib/actions/recovery";
import { formatMoney, formatPct, toNumber } from "@/lib/money";
import { PageHeader, Provenance } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyFigure } from "@/components/money/money-figure";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const STAGE_ORDER = ["submitted", "under_review", "won", "lost"];

export default async function RecoveryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  // Server-enforced RBAC gate for the read path: rbac.ts's MATRIX marks
  // recovery "hidden" for clinician — requireSession() alone only
  // authenticates, so without this a direct navigation to /[locale]/recovery
  // reached the full appeal/recovery financial dashboard (recovered/appealed
  // SAR, win rate, per-claim NPHIES ids and payer names) regardless of role.
  // The write path was already safe (authorizeAction('recovery', ['full'])
  // in actions/recovery.ts), but the read-side disclosure happened on render.
  // Same bug class already fixed for ingest and settings.
  if (!isVisible(session.role, "recovery")) notFound();
  const t = await getTranslations("recovery");
  const tc = await getTranslations("common");

  const { money, winRate, medianDays, sharePct, shareSar, rows } =
    await getRecovery(session.tenantId);

  const stageLabel: Record<string, string> = {
    submitted: t("stageSubmitted"),
    under_review: t("stageReview"),
    won: t("stageWon"),
    lost: t("stageLost"),
  };
  const stages = STAGE_ORDER.filter((s) => rows.some((r) => r.status === s));

  return (
    <div>
      <PageHeader title={t("title")} lead={t("lead")} />

      {/* ROI band — recovered is the emerald hero (the product promise made visible). */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <p className="text-label uppercase tracking-wide text-muted">
              {t("roiRecovered")}
            </p>
            <div className="mt-2">
              <MoneyFigure value={toNumber(money.recoveredSar)} tone="recovered" size="hero" />
            </div>
            <Provenance>
              {tc("syntheticData")}, {tc("lastMonths", { n: 6 })}
            </Provenance>
          </CardContent>
        </Card>
        <RoiStat label={t("roiWinRate")} value={formatPct(winRate)} />
        <RoiStat label={t("roiMedian")} value={String(medianDays)} />
        <Card className="lg:col-span-4">
          <CardContent className="flex items-center justify-between p-4">
            <span className="text-body text-muted">
              {t("roiShare")} · {formatPct(sharePct)}
            </span>
            <span className="num text-h2 font-display font-medium text-recovered-text">
              SAR {formatMoney(shareSar)}
            </span>
          </CardContent>
        </Card>
      </section>

      {/* Pipeline grouped by stage with SAR rolled up per stage. */}
      <div className="mt-6 space-y-6">
        {stages.map((stage) => {
          const group = rows.filter((r) => r.status === stage);
          const appealed = group.reduce((a, r) => a + toNumber(r.appealedSar), 0);
          const recovered = group.reduce((a, r) => a + toNumber(r.recoveredSar), 0);
          return (
            <section key={stage}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-h3 font-medium">
                  {stageLabel[stage]}
                  <Badge variant="neutral">{group.length}</Badge>
                </h2>
                <span className="num text-label text-muted">
                  {t("appealedSar")} {formatMoney(appealed)}
                  {recovered > 0 && (
                    <span className="text-recovered-text">
                      {" · "}
                      {t("recoveredSar")} {formatMoney(recovered)}
                    </span>
                  )}
                </span>
              </div>
              <Card>
                <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>{t("owner")}</TH>
                        <TH>{tc("payer")}</TH>
                        <TH className="text-end">{t("appealedSar")}</TH>
                        <TH className="text-end">{t("recoveredSar")}</TH>
                        <TH className="text-end">{t("daysOpen")}</TH>
                        <TH className="text-end">
                          <span className="sr-only">{t("actions")}</span>
                        </TH>
                      </TR>
                    </THead>
                    <TBody>
                      {group.slice(0, 25).map((r) => (
                        <PipelineRow
                          key={r.appealId}
                          row={r}
                          markWon={t("markWon")}
                          markLost={t("markLost")}
                          markWonLabel={t("markWonAriaLabel", {
                            payer: r.payerName,
                            amount: formatMoney(r.appealedSar),
                          })}
                          markLostLabel={t("markLostAriaLabel", {
                            payer: r.payerName,
                            amount: formatMoney(r.appealedSar),
                          })}
                        />
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              </Card>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RoiStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-label uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 num text-display font-display font-medium">{value}</p>
      </CardContent>
    </Card>
  );
}

function PipelineRow({
  row,
  markWon,
  markLost,
  markWonLabel,
  markLostLabel,
}: {
  row: AppealPipelineRow;
  markWon: string;
  markLost: string;
  markWonLabel: string;
  markLostLabel: string;
}) {
  const terminal = row.status === "won" || row.status === "lost";
  return (
    <TR>
      <TD className="mono text-label">{row.nphiesClaimId ?? row.claimId.slice(0, 8)}</TD>
      <TD>{row.payerName}</TD>
      <TD className="text-end num">{formatMoney(row.appealedSar)}</TD>
      <TD className="text-end num text-recovered-text">
        {row.recoveredSar ? formatMoney(row.recoveredSar) : "—"}
      </TD>
      <TD className="text-end num text-muted">{row.daysOpen}</TD>
      <TD className="text-end">
        {!terminal && (
          <div className="flex justify-end gap-1">
            <form action={markAppealOutcomeForm}>
              <input type="hidden" name="appealId" value={row.appealId} />
              <input type="hidden" name="outcome" value="won" />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="gap-1"
                aria-label={markWonLabel}
              >
                <Check className="size-3.5 text-recovered" /> {markWon}
              </Button>
            </form>
            <form action={markAppealOutcomeForm}>
              <input type="hidden" name="appealId" value={row.appealId} />
              <input type="hidden" name="outcome" value="lost" />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="gap-1"
                aria-label={markLostLabel}
              >
                <X className="size-3.5" /> {markLost}
              </Button>
            </form>
          </div>
        )}
      </TD>
    </TR>
  );
}
