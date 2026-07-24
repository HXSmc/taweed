/**
 * Dev seed (IMPLEMENT). Destructively migrates a LOCAL Postgres, then loads
 * realistic multi-tenant synthetic data so the app has real rows to render.
 *
 * The data-generation/insertion logic lives in `./seed-data.ts` and is shared
 * with `./seed-prod.ts` (which loads the same data into an already-migrated
 * hosted DB WITHOUT the destructive reset). This script's only job is the
 * local-only destructive reset + delegation to `seedData()`.
 *
 * NOT for production. Run:
 *   env DATABASE_URL=postgres://taweed:taweed@localhost:5432/taweed pnpm --filter @taweed/web seed
 */
import { getPool } from "@taweed/db";
// migrate helper is a dev/test utility (destructive) — imported by path.
import { migrate, appConnectionString } from "../packages/db/test/migrate.js";
import { seedData } from "./seed-data.js";

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://taweed:taweed@localhost:5432/taweed";
process.env.DATABASE_URL = ADMIN_URL; // migrate() reads this for its local-host guard

async function main(): Promise<void> {
  const admin = getPool(ADMIN_URL);
  const app = getPool(appConnectionString(ADMIN_URL));

  console.log("[seed] migrating (destructive, local only)...");
  await migrate(admin);

  await seedData(admin, app);

  await app.end();
  await admin.end();
}

main().catch((err: unknown) => {
  console.error("[seed] failed:", err);
  process.exitCode = 1;
});
