import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { landingModule } from "@/lib/rbac";

// Session-dependent redirect; must run per request.
export const dynamic = "force-dynamic";

// Entry: send authenticated users to their role's landing module, others to login.
export default async function LocaleIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  redirect(`/${locale}/${landingModule(session.role)}`);
}
