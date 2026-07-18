import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getAppealables } from "@/lib/appeals-data";
import { resolveBranchScope } from "@/lib/data";
import { recordPhiAccess } from "@/lib/audit";
import { PageHeader } from "@/components/shell/page-header";
import { AppealsComposer } from "@/components/modules/appeals-composer";

export const dynamic = "force-dynamic";

export default async function AppealsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  // Optional only so direct unit-test invocation (which calls the component
  // with just `params`) stays safe; Next.js always supplies searchParams at
  // runtime.
  searchParams?: Promise<{ branch?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const t = await getTranslations("appeals");
  const tr = await getTranslations("roles");

  // Resolve the optional ?branch=<id> param against this tenant's real branches
  // (RLS-scoped), then narrow the appeal queue to it. resolveBranchScope ignores
  // attacker-supplied / stale / cross-tenant ids — see data.ts.
  const { branchId } = await resolveBranchScope(session.tenantId, searchParams);

  const queue = await getAppealables(session.tenantId, 100, branchId);
  // The queue joins the patients table (member id) — audit the PHI read.
  await recordPhiAccess("read", "appeal-queue", session.tenantId);

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
