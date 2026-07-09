import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getBranches, getMoneyScope } from "@/lib/data";
import { toNumber } from "@/lib/money";
import { Rail } from "@/components/shell/rail";
import { CommandBar } from "@/components/shell/command-bar";
import { SkipLink } from "@/components/shell/skip-link";

// Every authenticated surface is per-request dynamic: the data is tenant-scoped
// and session-derived, so it must NEVER be statically prerendered and shared
// across tenants. This is a hard tenant-isolation requirement.
export const dynamic = "force-dynamic";

// The authenticated shell. Auth is enforced here (redirect to login when no
// verified session), and tenant_id is derived from that session for every read.
export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await requireSession(locale);
  const t = await getTranslations("common");

  const [money, branches] = await Promise.all([
    getMoneyScope(session.tenantId),
    getBranches(session.tenantId),
  ]);

  const scopeLabel = `${session.tenantName}, ${t("allBranches")}, ${t("lastMonths", { n: 6 })}`;

  return (
    <div className="flex min-h-screen bg-bg">
      <SkipLink label={t("skipToContent")} />
      <Rail role={session.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CommandBar
          tenantName={session.tenantName}
          role={session.role}
          email={session.email}
          recovered={toNumber(money.recoveredSar)}
          atRisk={toNumber(money.atRiskSar)}
          scopeLabel={scopeLabel}
          branches={branches}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1400px] flex-1 p-5 md:p-6 focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
