import type { DefaultSession } from "next-auth";

// Session carries the verified tenant + role. tenant_id is derived from here on
// every data access; it is never read from client input.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      tenantName: string;
      role: string;
      locale: string;
    } & DefaultSession["user"];
  }
  interface User {
    tenantId: string;
    tenantName: string;
    role: string;
    locale: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    tenantId: string;
    tenantName: string;
    role: string;
    locale: string;
  }
}
