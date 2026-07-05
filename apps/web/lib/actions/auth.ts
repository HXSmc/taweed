"use server";
import { signIn, signOut } from "@/lib/auth";

export async function signInWithEmail(email: string): Promise<void> {
  await signIn("dev", { email, redirectTo: "/" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
