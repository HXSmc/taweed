import "server-only";
import { getSession, type AppSession } from "./session";
import { capability, type Level, type ModuleKey } from "./rbac";

/**
 * Server-side RBAC gate. Role comes from the verified session; an action is
 * allowed only if the role's capability for the module is in `allowed`. This
 * enforces RBAC server-side, not just by hiding nav (design-brief §7: switching
 * role from the UI is impossible; the server decides). Returns null on
 * unauthorized/forbidden so callers can fail closed with their own result shape.
 */
export async function authorizeAction(
  module: ModuleKey,
  allowed: Level[],
): Promise<AppSession | null> {
  const session = await getSession();
  if (!session) return null;
  return allowed.includes(capability(session.role, module)) ? session : null;
}
