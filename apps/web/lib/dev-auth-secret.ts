/**
 * SECURITY: single source of truth for the dev/test-only NextAuth secret
 * fallback. This string is never valid in production (see lib/auth.ts, which
 * refuses to fall back to it when NODE_ENV === "production").
 *
 * Keep this literal defined in exactly ONE place. Duplicating it elsewhere
 * (e.g. a copy-pasted string in playwright.config.ts) raises the odds that a
 * future copy-paste carries the known-insecure value into a real environment
 * config, where it would silently become a live, publicly-known AUTH_SECRET.
 */
export const DEV_INSECURE_AUTH_SECRET = "dev-insecure-secret-change-me";
