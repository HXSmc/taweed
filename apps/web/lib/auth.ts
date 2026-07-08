import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail } from "./db";
import { DEV_INSECURE_AUTH_SECRET } from "./dev-auth-secret";
import { allowRequest } from "./rate-limit";

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

// The 'dev' provider authenticates by email alone (no password), so without a
// throttle a misconfigured deploy would let an attacker iterate arbitrary/
// guessed emails with no ceiling. The check lives HERE, in authorize()
// itself, rather than only in lib/actions/auth.ts's signInWithEmail: this
// callback is also reachable directly through NextAuth's own catch-all
// POST /api/auth/callback/credentials endpoint (mounted by
// app/api/auth/[...nextauth]/route.ts's `handlers`), which any caller can hit
// with no CSRF-token-holding session and without ever going through the
// app's own server action. authorize() is the one chokepoint both paths
// share, so it's the only place a throttle here can't be bypassed.
//
// Two layers, not one key, because a single GLOBAL key (the original design)
// closes the enumeration hole but opens a worse one: any anonymous caller can
// then burn the entire shared budget and lock out every other user's real
// sign-in attempts for the rest of the window (audit finding — a trivial
// unauthenticated availability attack on the login flow).
//  - A per-caller cap (keyed by client IP off the real `request` Auth.js
//    passes to authorize(), see devSigninCallerKey below) bounds how many
//    attempts ONE caller can spend, so it can no longer exhaust the budget
//    everyone else shares.
//  - The original coarse global cap is kept as a backstop against
//    distributed enumeration (many callers guessing many emails at once),
//    raised well above normal traffic so a single legitimate caller never
//    reaches it on its own.
// Residual, accepted rather than eliminated: if the per-caller IP is
// unavailable (no proxy header) this falls back to keying by the attempted
// email, so an attacker varying both IP and email is bounded only by the
// coarse global cap, same as before this fix.
const DEV_SIGNIN_CALLER_RATE_LIMIT = 20;
const DEV_SIGNIN_CALLER_WINDOW_MS = 60_000;
const DEV_SIGNIN_GLOBAL_RATE_LIMIT = 200;
const DEV_SIGNIN_GLOBAL_WINDOW_MS = 60_000;

/**
 * Best-effort per-caller identity for the dev sign-in throttle. Prefers the
 * client IP off the original `Request` Auth.js hands to authorize() (present
 * behind any reverse proxy/load balancer, including the e2e/staging deploy
 * named in the audit finding). Falls back to the attempted email when no
 * proxy header is present — weaker than true per-IP keying (an attacker can
 * still burn one budget per email guessed), but it still fixes the reported
 * bug: two different callers no longer collapse onto one shared key.
 */
function devSigninCallerKey(email: string, request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  return ip ? `dev-signin:ip:${ip}` : `dev-signin:email:${email}`;
}

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
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        if (!email) return null;
        const callerKey = devSigninCallerKey(email, request);
        if (
          !(await allowRequest(
            callerKey,
            DEV_SIGNIN_CALLER_RATE_LIMIT,
            DEV_SIGNIN_CALLER_WINDOW_MS,
          ))
        ) {
          return null;
        }
        if (
          !(await allowRequest(
            "dev-signin",
            DEV_SIGNIN_GLOBAL_RATE_LIMIT,
            DEV_SIGNIN_GLOBAL_WINDOW_MS,
          ))
        ) {
          return null;
        }
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
