import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale routing only. Auth is enforced in the (app) layout server component
// (redirect to /login when no verified session) rather than in middleware, so
// the tenant_id is always derived from the resolved session, never a header.
export default createMiddleware(routing);

export const config = {
  // Skip API, Next internals, and static assets.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
