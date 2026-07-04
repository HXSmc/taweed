import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail } from "./db";

/**
 * Local/dev auth (build-plan §4). A Credentials provider stands in for a real
 * OIDC provider so the whole session → tenant_id → RLS chain is exercised now.
 * The tenant_id and role are read from the identity store at sign-in and carried
 * in the JWT; the app never trusts a client-supplied tenant/role.
 *
 * TODO(ksa-oidc)/DEPLOY: swap Credentials for a KSA-resident managed OIDC
 * provider. The provider is the only thing that changes — callbacks, the session
 * shape, and every withSession call stay identical (typed swap).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me", // TODO(ksa-oidc): secrets manager
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
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
  ],
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
