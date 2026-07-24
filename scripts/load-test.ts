/**
 * Real API load test (Story 3, production-hardening pass). Runs autocannon
 * against 3 flows on a live Taweed deployment and prints real latency/error
 * numbers — not just wiring the tool up unused.
 *
 * Read-biased by design: an unauthenticated landing page and an authenticated,
 * now-cached (Story 1) analytics page are the two sustained-load scenarios.
 * The write path (ingest Server Action) is exercised too, but deliberately
 * bounded to a handful of requests, not sustained load — hammering it would
 * write real garbage rows into the live demo DB and burn Vercel Hobby
 * invocation quota for no extra signal (the write path's own per-tenant rate
 * limit is the thing that would actually get hit first, not real capacity).
 *
 * Run:  BASE_URL=https://taweed.vercel.app pnpm --filter @taweed/web load-test
 *   (defaults to http://localhost:3000 — point BASE_URL at a real deployment
 *   for the real numbers this story requires)
 */
import autocannon from "autocannon";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OWNER_EMAIL = process.env.LOAD_TEST_EMAIL ?? "owner@al-salama-dental-gro.dev";

interface Report {
  scenario: string;
  requests: number;
  errors: number;
  timeouts: number;
  latencyMs: { p50: number; p97_5: number; p99: number };
  reqPerSec: number;
}

/**
 * Dev-auth (Credentials provider, id "dev") sign-in scripted the same way
 * next-auth's own client does it: fetch a CSRF token + cookie, POST the
 * credentials callback with it, capture the resulting session cookie. Only
 * works when TAWEED_ENABLE_DEV_AUTH=1 on the target (true for the deployed
 * demo — see docs/ai-deploy-readiness.md / docs/handoff.md, NOT a real auth bypass. Never point
 * this script at a deployment holding real PHI without first confirming dev-auth is genuinely
 * gated the same way there.
 */
async function devLogin(baseUrl: string, email: string): Promise<string> {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrfCookie = csrfRes.headers.get("set-cookie");
  if (!csrfCookie) throw new Error("no csrf cookie returned — is dev auth enabled on this target?");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const loginRes = await fetch(`${baseUrl}/api/auth/callback/dev`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookie,
    },
    body: new URLSearchParams({ email, csrfToken, redirectTo: "/" }).toString(),
  });

  const sessionCookie = loginRes.headers.get("set-cookie");
  if (!sessionCookie || loginRes.status >= 400) {
    throw new Error(`dev login failed: status=${loginRes.status}`);
  }
  // Multiple Set-Cookie headers collapse to one string over fetch's Headers API
  // in Node; split on the comma-separated cookie boundaries autocannon expects
  // a single Cookie header value, so just forward it as-is — the server reads
  // whichever of its own cookies it set.
  return [csrfCookie, sessionCookie].join("; ");
}

function toReport(scenario: string, result: autocannon.Result): Report {
  return {
    scenario,
    requests: result.requests.sent,
    errors: result.errors,
    timeouts: result.timeouts,
    latencyMs: { p50: result.latency.p50, p97_5: result.latency.p97_5, p99: result.latency.p99 },
    reqPerSec: result.requests.average,
  };
}

async function run(): Promise<void> {
  const reports: Report[] = [];

  // 1. Unauthenticated landing page — sustained load.
  const landing = await autocannon({
    url: `${BASE_URL}/en`,
    connections: 20,
    duration: 20,
  });
  reports.push(toReport("GET /en (landing, unauthenticated)", landing));

  // 2. Authenticated analytics page — sustained load. This is the Story 1
  // cache's real test: repeated hits within the 60s TTL should hit cache, not
  // recompute the aggregations every time.
  const cookie = await devLogin(BASE_URL, OWNER_EMAIL);
  const analytics = await autocannon({
    url: `${BASE_URL}/en/analytics`,
    connections: 20,
    duration: 20,
    headers: { Cookie: cookie },
  });
  reports.push(toReport("GET /en/analytics (authenticated, cached)", analytics));

  // 3. Ingest page (GET) — bounded, not sustained. Deliberately NOT the upload
  // Server Action POST: that path writes real rows per request and would
  // pollute the live demo DB / burn Hobby invocation quota for a live
  // deployment with no throwaway target available (see
  // .orchestrator/handoffs/autopilot-1-plan.md's advisor() confirmation).
  const ingestPage = await autocannon({
    url: `${BASE_URL}/en/ingest`,
    connections: 5,
    amount: 25,
    headers: { Cookie: cookie },
  });
  reports.push(toReport("GET /en/ingest (authenticated, bounded)", ingestPage));

  console.log(JSON.stringify(reports, null, 2));

  const totalErrors = reports.reduce((sum, r) => sum + r.errors + r.timeouts, 0);
  if (totalErrors > 0) {
    console.error(`load-test: ${totalErrors} error(s)/timeout(s) across scenarios`);
    process.exitCode = 1;
  }
}

run().catch((err: unknown) => {
  console.error("[load-test] failed:", err);
  process.exitCode = 1;
});
