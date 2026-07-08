"use server";
import { DEV_AUTH_ENABLED, signIn, signOut } from "@/lib/auth";

// This is an exported Server Action — effectively a public POST endpoint — so
// it must not rely solely on the credentials provider array being empty when
// dev auth is off. Guard explicitly: this makes the invariant self-evident in
// code, not an accidental side effect of provider wiring.
//
// The passwordless-sign-in throttle itself lives in lib/auth.ts's
// authorize() callback, not here: that callback is the one chokepoint shared
// by both this action and NextAuth's own POST /api/auth/callback/credentials
// endpoint, which bypasses this action entirely. Throttling only here would
// leave that endpoint uncapped; throttling in both places against the same
// key would silently halve the effective budget for every legitimate
// sign-in routed through this action.
export async function signInWithEmail(email: string): Promise<void> {
  if (!DEV_AUTH_ENABLED) {
    throw new Error("Dev auth is disabled");
  }
  await signIn("dev", { email, redirectTo: "/" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
