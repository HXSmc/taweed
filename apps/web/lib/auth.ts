import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail } from "./db";
import { DEV_INSECURE_AUTH_SECRET } from "./dev-auth-secret";

/**
 * Local/dev auth (build-plan §4). A Credentials provider stands in for a real
 * OIDC provider so the whole session → tenant_id → RLS chain is exercised now.
 * The tenant_id and role are read from the identity store at sign-in and carried
 * in the JWT; the app never trusts a client-supplied tenant/role.
 *
 * SECURITY: this provider is PASSWORDLESS (dev/synthetic only). It is enabled
 * ONLY for an explicit, allow-listed signal: NODE_ENV === "development", or an
 * affirmative TAWEED_ENABLE_DEV_AUTH=1 opt-in (used by the e2e webServer, which
 * runs a real `next start` production build). This is deliberately an allow-list
 * ("is this a known-safe environment?"), not a deny-list ("is this not exactly
 * production?") — a deny-list fails OPEN whenever NODE_ENV is unset, misspelled,
 * or something like "staging" (custom Docker/PM2/systemd start scripts, hosts
 * that don't set NODE_ENV), which would otherwise silently expose passwordless
 * sign-in on a live deployment.
 * TODO(ksa-oidc)/DEPLOY: swap Credentials for a KSA-resident managed OIDC
 * provider. The provider is the only thing that changes — callbacks, the session
 * shape, and every withSession call stay identical (typed swap).
 */
const IS_DEV_ENV = process.env.NODE_ENV === "development";
export const DEV_AUTH_ENABLED = IS_DEV_ENV || process.env.TAWEED_ENABLE_DEV_AUTH === "1";

// Only fall back to the public dev secret under the same allow-listed
// DEV_AUTH_ENABLED condition above (never merely "NODE_ENV isn't exactly
// production"). Any other environment must supply a real AUTH_SECRET; if
// unset, NextAuth fails closed (cannot sign/verify) rather than trusting a
// public repo string. Exported (not just inlined below) so this fail-closed
// condition is independently testable.
export const RESOLVED_AUTH_SECRET =
  process.env.AUTH_SECRET ?? (DEV_AUTH_ENABLED ? DEV_INSECURE_AUTH_SECRET : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: RESOLVED_AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: DEV_AUTH_ENABLED
    ? [
    Credentials({
      id: "dev",
      name: "Dev account",
      credentials: { email: { label: "Email", type: "text" } },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        if (!email) return null;
        const user = await findUserByEmail(email);
        if (!user) return null;
        // Shape returned here flows into the jwt callback as `user`.
        return {
          id: user.id,
          email: user.email,
          tenantId: user.tenantId,
          tenantName: user.tenantName,
          role: user.role,
          locale: user.locale,
        };
      },
    }),
      ]
    : [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.role = user.role;
        token.locale = user.locale;
      }
      return token;
    },
    session({ session, token }) {
      // token fields are typed unknown by the base JWT; coerce to the session shape.
      session.user.id = String(token.userId ?? "");
      session.user.tenantId = String(token.tenantId ?? "");
      session.user.tenantName = String(token.tenantName ?? "");
      session.user.role = String(token.role ?? "");
      session.user.locale = String(token.locale ?? "");
      return session;
    },
  },
});
