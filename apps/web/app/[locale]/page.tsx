import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/session";
import { landingModule } from "@/lib/rbac";
import { Landing } from "@/components/marketing/landing";

// Session-dependent; must run per request.
export const dynamic = "force-dynamic";

// Entry: authenticated users go to their role's landing module; everyone else
// sees the marketing landing (the number-as-hero pre-login page, design-brief §12).
export default async function LocaleIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (session) redirect(`/${locale}/${landingModule(session.role)}`);
  return <Landing />;
}
