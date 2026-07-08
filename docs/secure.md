# Security Audit — Taweed

> Security audit across injection, authn, secrets, and access control, 2026-07-08. Scope:
> `packages/*` + `apps/web` (`.md` files excluded). Method: 4 parallel finder agents by area →
> each candidate adversarially verified (2 independent skeptics, default-to-refute) → every
> CONFIRMED finding fixed with a regression test. Ran in two passes (the workflow hit a session
> rate limit partway through the first pass; resumed and completed). 10 findings confirmed and
> fixed, 1 confirmed-clean (positive finding, no code change needed), several refuted or
> addressed as a side effect of another fix (noted below).
>
> Final verification after all fixes: root+web typecheck clean, lint 0 errors, **unit 533/533**,
> **integration 42/42**, `apps/web` production build green.

## High

### 1. `apps/web/lib/auth.ts:19` — dev-login gate was fail-**open**, not fail-closed
`DEV_AUTH_ENABLED` was `!IS_PROD || TAWEED_ENABLE_DEV_AUTH === "1"`, i.e. the passwordless dev
Credentials provider (an email lookup, no password/OTP/2FA) was **on by default** and only turned
off when `NODE_ENV` matched the literal string `"production"` exactly. A misconfigured host that
never sets `NODE_ENV`, or sets it to `"staging"`/anything else, would silently enable passwordless
sign-in as any user in what is actually a live deployment. `next start` self-forces
`NODE_ENV=production`, which narrows real-world exposure, but the code had no independent guard
against that class of misconfiguration.
**Fix:** rewritten as an explicit allow-list: `DEV_AUTH_ENABLED = (NODE_ENV === "development") ||
TAWEED_ENABLE_DEV_AUTH === "1"`. Only a known-safe signal turns it on; anything else — unset,
misspelled, `"staging"` — now correctly stays off.
**Test:** `apps/web/test/auth-dev-config.test.ts` (8 cases), including the exact `"staging"`
misconfiguration from the finding.

### 2. `apps/web/lib/auth.ts:26` — the same fail-open also swapped in a public, hardcoded JWT secret
`secret: process.env.AUTH_SECRET ?? (IS_PROD ? undefined : "dev-insecure-secret-change-me")` shared
the same trigger as #1: in a misconfigured non-`"production"` environment with `AUTH_SECRET` unset,
sessions were signed with a constant string committed in this open-source repo — anyone who's read
the repo could forge a valid session JWT for any tenant/role, no dev-login UI needed. Auth.js's own
`assertConfig` correctly refuses to start when the secret is genuinely unset in a real production
config (verified against `@auth/core`'s source) — the gap was specifically the narrow misconfigured-
but-actually-prod window.
**Fix:** the secret fallback now shares the same `DEV_AUTH_ENABLED` gate as #1 (extracted into an
exported `RESOLVED_AUTH_SECRET`, and the literal itself into a single shared
`apps/web/lib/dev-auth-secret.ts` module — it had been duplicated a second time in
`playwright.config.ts`, raising drift risk). A misconfigured environment now gets `undefined` and
NextAuth fails closed, same as it always correctly did for a genuine production config.
**Test:** covered by `auth-dev-config.test.ts` (asserts `RESOLVED_AUTH_SECRET` is `undefined` in
the staging-misconfiguration case) and `apps/web/test/playwright-config-auth-secret.test.ts` (2
cases, proves both files now read the one shared constant).

### 3. `apps/web/app/[locale]/(app)/ingest/page.tsx:18` — page render had no RBAC gate
The Ingest page (which now also renders the AI-4 review queue, PHI-adjacent) was gated only by
`requireSession()` — any authenticated user of any role could load it directly by URL, regardless
of whether `rbac.ts`'s MATRIX marks `ingest` as `"hidden"` for their role (owner, clinician). The
nav rail correctly hid the link, but nothing stopped a direct navigation.
**Fix:** `if (!isVisible(session.role, "ingest")) notFound();` right after `requireSession()`,
before any data fetch — matches how every write-side server action already re-checks
`authorizeAction`.
**Test:** `apps/web/test/ingest-page.test.ts` (5 cases: owner/clinician get a 404 with zero data
fetched; finance/rcm/admin render normally).

### 4. `packages/db/test/migrate.ts:67` — tenant-isolation role provisioning lived only in a test helper
The entire enforcement model — the `taweed_app` role (`NOBYPASSRLS`), and the `REVOKE`s that make
`llm_calls`/`audit_logs` append-only and `tenants` inaccessible — was created by a TS function
(`ensureAppRole()`) called only from the integration-test harness. **A production deployment
provisioned by any other tool (a DBA running the raw `.sql` files, a migration runner other than
this repo's test script) would never get these grants at all** — RLS policies would exist, but the
role they're supposed to constrain wouldn't, and the append-only privilege boundary simply wouldn't
apply.
**Fix:** moved the role-creation + grants + revokes into a real migration,
`packages/db/drizzle/0010_app_role_grants.sql` — applying the raw SQL files alone now establishes
the full enforcement model, with no dependency on this repo's test tooling.
**Test:** `packages/db/test/app-role-grants.int.test.ts` (new) applies **only** the raw `.sql`
files via a plain `pg` client (bypassing any `@taweed/db` TS helper) to simulate "provisioned by
some other tool," and asserts the role exists correctly-configured and the revokes hold.

### 5. `apps/web/lib/actions/ingest.ts:36` — the FHIR bundle upload action had zero rate limiting
Every other AI/PHI-adjacent action (`explain-flag`, `author-rule`, `assist-appeal`, `eob-extract`)
was rate-limited; `ingestBundle` — a JSON-parse-plus-per-claim-DB-insert loop, comparable cost —
had no limit at all, an easy target for a resource-exhaustion abuse pattern.
**Fix:** added the same `allowRequest` check used by `eob-extract.ts` (10 req/60s per tenant+actor),
before the parse/insert work runs.
**Test:** `apps/web/test/ingest-rate-limit.test.ts` (3 cases).

## Medium

### 6. `apps/web/lib/db.ts:92` — `listDemoAccounts()` was an unauthenticated cross-tenant user dump
The `/login` page's account picker calls `listDemoAccounts()`, which was gated only by
`DEV_AUTH_ENABLED` at the call site — and `DEV_AUTH_ENABLED` is also `true` when
`TAWEED_ENABLE_DEV_AUTH=1` is deliberately set in a **deployed** environment (used by the e2e
`webServer`). In that legitimate-but-deployed configuration, an unauthenticated visitor to `/login`
would see every tenant's user id/email/role/tenant name in one unfiltered `users JOIN tenants`
query — a real cross-tenant information leak, distinct from finding #1/#2's login bypass.
**Fix:** `listDemoAccounts()` now independently fails closed to `[]` unless
`NODE_ENV === "development"` specifically — a narrower, correct condition than `DEV_AUTH_ENABLED`,
checked inside the data-access function itself, not just at one call site.
**Test:** `apps/web/test/db.test.ts` (2 cases — production returns `[]` with zero DB calls;
development still works).
**Product note (not a security defect, flagged for awareness):** with this fix, a deployed demo
using `TAWEED_ENABLE_DEV_AUTH=1` will now render an empty account list. If a curated demo login
needs to keep working there, the follow-up is an explicit allow-listed email set
(e.g. `TAWEED_DEMO_EMAILS`), not reverting to an unfiltered scan.

### 7. `apps/web/lib/rate-limit.ts:9` — the rate limiter was per-process, in-memory, fails open at scale
The limiter's own code comment already admitted this: a `Map` living in one Node process means
every server instance behind a load balancer enforces its own independent ceiling — 3 instances at
`limit=10` yields an effective 30, not 10, defeating the abuse protection the moment the app scales
horizontally.
**Fix:** replaced the in-memory store with a Postgres-backed one (`rate_limit_windows` table,
migration `0011_rate_limit_windows.sql`). Each check runs one transaction — `INSERT ... ON CONFLICT
DO NOTHING` to claim a new window, `SELECT ... FOR UPDATE` to serialize concurrent callers across
*any* number of instances sharing the database. `allowRequest` is now `async`; all 6 call sites
(`auth`, `author-rule`, `assist-appeal`, `eob-extract`, `ingest`, `explain-flag`) updated to `await`
it.
**Test:** `apps/web/test/rate-limit.test.ts` — models two independent server instances sharing one
fake pool and proves the combined ceiling holds (4 requests round-robined at `limit=3` →
`[true,true,true,false]`, which the old per-process map would have allowed as `[true,true,true,true]`
since each instance had its own separate budget).

## Low

### 8. `packages/ai/src/run.ts:99` — audit-write-failure logging printed the raw caught error
Both audit-write-failure `console.error` calls passed the full caught error object straight
through — stack trace, `.cause` chain, and any nested driver/SDK response detail (which, for a
Postgres or Anthropic error, can include connection strings or partial request bodies) landing
verbatim in server logs.
**Fix:** new `redactAuditError()` helper reduces any caught value to a bounded `"Name: message"`
string (300-char cap) before logging; both `console.error` call sites now log the redacted string.
**Test:** `packages/ai/test/run.test.ts` (5 cases) — proves a message containing an embedded secret
("hunter2") is logged, but the raw Error object and its stack/extra properties never reach
`console.error`.

### 9. `packages/ai/src/config.ts` — the AI kill-switch/API-key module had no `server-only` guard
Every other secret-adjacent file in `@taweed/ai` (`run.ts`, `anthropic-1p.ts`, `audit.ts`) imports
`"server-only"` so a future `"use client"` component accidentally importing them fails the Next.js
build instead of silently bundling server logic into the browser. `config.ts` — which reads
`ANTHROPIC_API_KEY` and drives the feature/tenant kill switches, and is re-exported as a plain
(non-type-only) value from the package barrel — was missing this same tripwire.
**Fix:** added `import "server-only";`.
**Test:** `packages/ai/test/config.test.ts` — asserts the import is present in source (the guard
itself is a build-time failure that can't be observed at runtime under the test environment's
`server-only` stub).

### 10. Duplicated dev-auth-secret literal (`apps/web/playwright.config.ts` / `apps/web/lib/auth.ts`)
See #2 — the same insecure fallback string was hardcoded independently in two files. Folded into
one shared `apps/web/lib/dev-auth-secret.ts` module as part of closing #2, removing the drift risk
of a future edit updating one copy and not the other.

## Confirmed clean (positive finding — no code change)

### `packages/db/src/schema.ts:397` — RLS coverage across all tenant-scoped tables
The audit explicitly verified, not merely trusted: every table in `TENANT_SCOPED_TABLES` (20
entries) has a matching `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + a
`tenant_isolation_*` policy across the migration history (0001/0005/0006/0007/0009), and no
migration anywhere disables or drops that protection. **Turned into a standing regression test**
(`packages/db/test/rls-coverage.test.ts`, 21 cases) so a future table added to
`TENANT_SCOPED_TABLES` without the matching RLS migration statements fails CI immediately, instead
of relying on the next manual audit to catch it.

## Considered, addressed indirectly, or deliberately deferred

- **`apps/web/lib/actions/auth.ts` — `signInWithEmail` has no explicit `DEV_AUTH_ENABLED` guard of
  its own.** Verified safe today because the Credentials provider array is empty when dev auth is
  disabled (so `signIn("dev", ...)` has nothing to authenticate against), and the action now
  inherits rate limiting as one of the 6 call sites updated for finding #7. Not independently
  fixed with its own explicit gate — flagged as defense-in-depth worth adding if this action's
  shape changes.
- **`apps/web/lib/auth.ts:22` — `trustHost: true` unconditionally disables Auth.js's host-header
  validation.** Low severity today: the only provider is Credentials (no OAuth redirect flow to
  poison), so there's no live sink. This becomes a real risk the moment an OAuth/OIDC provider is
  added (the documented `TODO(ksa-oidc)` swap) without re-adding host validation — tracked for
  that swap, not fixed now since the correct trusted-host value depends on the not-yet-chosen
  production domain.
- **Session cookie `secure` flag relies on the resolved request protocol rather than being pinned
  explicitly.** Correct-by-default under Auth.js's own logic for a normal HTTPS deployment; only a
  fragility if this app is ever placed behind a proxy that mishandles `X-Forwarded-Proto`. Worth
  pinning `useSecureCookies: true` explicitly once the production URL scheme is guaranteed at
  DEPLOY time.
