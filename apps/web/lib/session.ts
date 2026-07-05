import "server-only";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { isRole, type Role } from "./rbac";

export interface AppSession {
  userId: string;
  tenantId: string;
  tenantName: string;
  role: Role;
  email: string;
}

/** Resolve the verified session, or null. */
export async function getSession(): Promise<AppSession | null> {
  const session = await auth();
  if (!session?.user?.tenantId || !isRole(session.user.role)) return null;
  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    tenantName: session.user.tenantName,
    role: session.user.role,
    email: session.user.email ?? session.user.id,
  };
}

/** Require a session; otherwise redirect to the locale-prefixed login. */
export async function requireSession(locale: string): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  return session;
}
