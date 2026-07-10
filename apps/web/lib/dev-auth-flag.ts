/**
 * SECURITY: single source of truth for whether dev/demo auth is allowed —
 * an explicit allow-list (is this a known-safe environment?), not a deny-list
 * (is this not exactly production?), so an unset/misspelled NODE_ENV never
 * silently enables passwordless sign-in on a live deployment.
 *
 * Kept in its own dependency-free module (not lib/auth.ts) so lib/db.ts's
 * listDemoAccounts() can import it without a circular import — lib/auth.ts
 * already imports findUserByEmail from lib/db.ts. Every other file that
 * needs this gate (auth.ts, actions/auth.ts, db.ts) should import it from
 * HERE, not hand-roll an independent NODE_ENV check — two separately
 * hand-rolled checks are exactly how this drifted before: listDemoAccounts()
 * checked NODE_ENV === "development" only, so it returned an empty list in
 * CI's E2E job (a `next start` production build, NODE_ENV="production")
 * even though TAWEED_ENABLE_DEV_AUTH=1 correctly enabled dev auth itself —
 * breaking login for every E2E test.
 */
export const DEV_AUTH_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.TAWEED_ENABLE_DEV_AUTH === "1";
