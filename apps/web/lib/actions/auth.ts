"use server";
import { DEV_AUTH_ENABLED, signIn, signOut } from "@/lib/auth";
import { allowRequest } from "@/lib/rate-limit";

// This is an exported Server Action — effectively a public POST endpoint — so
// it must not rely solely on the credentials provider array being empty when
// dev auth is off. Guard explicitly: this makes the invariant self-evident in
// code, not an accidental side effect of provider wiring.
//
// The underlying 'dev' provider authenticates by email alone (no password), so
// without a throttle a misconfigured deploy would let an attacker iterate
// arbitrary/guessed emails with no ceiling. Key the limiter globally (not per
// email) — the threat is enumerating many different addresses, and a
// per-email key would hand each guessed address its own fresh budget.
const DEV_SIGNIN_RATE_LIMIT = 20;
const DEV_SIGNIN_WINDOW_MS = 60_000;

export async function signInWithEmail(email: string): Promise<void> {
  if (!DEV_AUTH_ENABLED) {
    throw new Error("Dev auth is disabled");
  }
  if (
    !(await allowRequest(
      "dev-signin",
      DEV_SIGNIN_RATE_LIMIT,
      DEV_SIGNIN_WINDOW_MS,
    ))
  ) {
    throw new Error("Too many sign-in attempts, try again shortly");
  }
  await signIn("dev", { email, redirectTo: "/" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
