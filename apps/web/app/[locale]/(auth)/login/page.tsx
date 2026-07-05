import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { listDemoAccounts } from "@/lib/db";
import { getSession } from "@/lib/session";
import { DEV_AUTH_ENABLED } from "@/lib/auth";
import { signInWithEmail } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Local/dev sign-in (build-plan §4). Picking a demo account mints a real session
// with that account's tenant + role; every downstream read derives tenant_id
// from it. TODO(ksa-oidc): swap for a KSA-resident managed OIDC provider.
// Dynamic: reads the live identity store + session cookie per request.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getSession()) redirect(`/${locale}`);

  const t = await getTranslations("auth");
  const tr = await getTranslations("roles");
  // Only enumerate demo accounts when dev auth is enabled — never leak the tenant
  // roster on a production login page.
  const accounts = DEV_AUTH_ENABLED ? await listDemoAccounts() : [];

  return (
    <main className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-accent text-accent-fg font-display text-h3">
            T
          </span>
          <span className="font-display text-h2 font-medium">Taweed</span>
        </div>
        <h1 className="text-h1 font-display font-medium">{t("signInTitle")}</h1>
        <p className="mt-1 text-body text-muted">{t("signInSubtitle")}</p>

        <div className="mt-6 rounded-lg border border-hairline bg-surface-1 p-1.5">
          <p className="px-3 py-2 text-label text-muted">{t("chooseAccount")}</p>
          <ul className="flex flex-col">
            {accounts.map((a) => (
              <li key={a.id}>
                <form action={signInWithEmail.bind(null, a.email)}>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-start transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex flex-col">
                      <span className="text-body font-medium">{a.tenantName}</span>
                      <span className="mono text-label text-muted">{a.email}</span>
                    </span>
                    <Badge variant="accent" className="uppercase">
                      {tr(a.role as "owner")}
                    </Badge>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-label text-muted">
          <ShieldCheck className="size-3.5 text-money-neutral" />
          {t("devNote")}
        </p>
      </div>
    </main>
  );
}
