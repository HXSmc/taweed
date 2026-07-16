import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getScrubRows, getBranches, resolveBranchId } from "@/lib/data";
import { recordPhiAccess } from "@/lib/audit";
import { formatMoney, toNumber } from "@/lib/money";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ScrubberTable } from "@/components/modules/scrubber-table";

export const dynamic = "force-dynamic";

export default async function ScrubberPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ q?: string; branch?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const t = await getTranslations("scrubber");

  const branches = await getBranches(session.tenantId);
  const sp = (await searchParams) ?? {};
  const branchId = resolveBranchId(sp.branch, branches);

  let rows = await getScrubRows(session.tenantId, 60, branchId);
  // Reading claim + patient rows is a PHI read — record it (no PHI in the log).
  await recordPhiAccess("read", "scrubber-batch", session.tenantId);

  // Global command-bar search (design-brief §7: claims, payers, appeals by ID).
  // Substring-match the loaded (already branch-scoped) page set by claim id /
  // NPHIES id / payer name — a contained filter over what the scrubber already
  // loads, no new search index.
  const needle = sp.q?.trim().toLowerCase() ?? "";
  if (needle) {
    rows = rows.filter(
      (r) =>
        r.claimId.toLowerCase().includes(needle) ||
        (r.nphiesClaimId ?? "").toLowerCase().includes(needle) ||
        r.payerName.toLowerCase().includes(needle),
    );
  }

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
          <div className="mb-5 flex items-center gap-3 rounded-lg border border-hairline bg-at-risk-bg p-4">
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
