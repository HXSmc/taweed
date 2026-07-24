/**
 * Production-safe seed (IMPLEMENT). Loads the SAME synthetic multi-tenant demo
 * data as `seed.ts` into an ALREADY-MIGRATED hosted database — no destructive
 * `migrate()`, no schema/role assumptions beyond "already applied forward-only".
 *
 * For a REAL hosted DB. Hard guard: this script REFUSES to run if
 * `TAWEED_ALLOW_DESTRUCTIVE_MIGRATE` is set in its environment — that flag is the
 * destructive-test path's opt-in, and its presence here means someone has confused
 * this script with the local reset. Better to fail loudly than silently mutate a
 * production database under the wrong assumption.
 *
 * Run:  env DATABASE_URL=<hosted-url> pnpm --filter @taweed/web seed:prod
 */
import { getPool } from "@taweed/db";
import { seedData } from "./seed-data.js";

// Mirrors apps/web/lib/db.ts's appUrl() — NOT packages/db/test/migrate.ts's
// appConnectionString(), which hardcodes the insecure dev password "taweed"
// with no env override. This script targets the real hosted DB, where the
// app role's password is a rotated secret set via TAWEED_APP_PASSWORD (see
// .orchestrator/handoffs/autopilot-1-plan.md) — reusing the test helper here
// would silently connect with the wrong (or a trivially weak) credential.
function appConnectionString(adminUrl: string): string {
  const role = process.env.TAWEED_APP_ROLE ?? "taweed_app";
  const password = process.env.TAWEED_APP_PASSWORD ?? "taweed";
  const url = new URL(adminUrl);
  url.username = role;
  url.password = password;
  return url.toString();
}

async function main(): Promise<void> {
  if (process.env.TAWEED_ALLOW_DESTRUCTIVE_MIGRATE !== undefined) {
    throw new Error(
      "seed-prod refuses to run with TAWEED_ALLOW_DESTRUCTIVE_MIGRATE set — " +
        "that flag belongs to the destructive dev/test reset, not this " +
        "production-safe loader. Unset it and re-run.",
    );
  }

  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) {
    throw new Error("DATABASE_URL is required for seed-prod (the hosted DB).");
  }

  const admin = getPool(adminUrl);
  const app = getPool(appConnectionString(adminUrl));

  await seedData(admin, app);

  await app.end();
  await admin.end();
}

main().catch((err: unknown) => {
  console.error("[seed-prod] failed:", err);
  process.exitCode = 1;
});
