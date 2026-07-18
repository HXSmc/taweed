import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool, type Pool } from "../src/index.js";
import { migrate, appConnectionString } from "./migrate.js";
import { seedTenant } from "./helpers.js";

// Real-DB regression test for the TOCTOU race in markAppealOutcome
// (apps/web/lib/actions/recovery.ts) documented in docs/audit docs/bugs.md #1.
//
// markAppealOutcome derives each won appeal's recovered_amount from a
// sibling-recovered SUM on the same denial, then UPDATEs the appeal, all in one
// READ-COMMITTED transaction. Without a lock, two concurrent resolutions of two
// appeals sharing one denial both read already_recovered = 0 and both commit the
// full denied amount — double-recovering money. The fix serializes those calls
// with `SELECT ... FOR UPDATE OF d` on the owning denials row before the sibling
// SUM is read.
//
// This test proves the lock actually serializes against real Postgres: a mock
// cannot, because a fake db.execute has no real row-lock semantics. It opens two
// real client connections, starts two transactions, and interleaves them to
// force the exact race window — asserting the second transaction's sibling-SUM
// read reflects the first transaction's COMMITTED write (1000 SAR), not 0.
//
// Location note: this lives in packages/db/test/ (not apps/web/test/) because
// vitest.workspace.ts scopes the "integration" project to
// `packages/*/test/**/*.int.test.ts` only; an apps/web `*.int.test.ts` would be
// excluded from the unit project and not discovered by the integration project,
// so it would never run.

const adminUrl = process.env.DATABASE_URL ?? "";
const adminPool: Pool = getPool(adminUrl);
// App role (NOBYPASSRLS) so RLS binds exactly as in production.
const pool: Pool = getPool(appConnectionString(adminUrl));

const TENANT = "55555555-5555-4555-8555-555555555555";
const BRANCH = "51000000-0000-4000-8000-000000000001";
const PROVIDER = "51000000-0000-4000-8000-000000000002";
const PAYER = "51000000-0000-4000-8000-000000000003";
const PATIENT = "51000000-0000-4000-8000-000000000004";
const CLAIM = "51000000-0000-4000-8000-000000000005";
const CLAIM_LINE = "51000000-0000-4000-8000-000000000006";
const CLAIM_RESPONSE = "51000000-0000-4000-8000-000000000007";
const DENIAL = "51000000-0000-4000-8000-000000000008";
const APPEAL_A1 = "51000000-0000-4000-8000-000000000009";
const APPEAL_A2 = "51000000-0000-4000-8000-000000000010";
const DENIED_AMOUNT = "1000.00";

beforeAll(async () => {
  await migrate(adminPool);
  await seedTenant(adminPool, TENANT, "Race Test Clinic");

  // Seed the minimal FK chain (admin bypasses RLS) so a denial + two sibling
  // appeals exist for one tenant. Two appeals on one denial is the exact shape
  // that admits the double-recovery race (e.g. an original + a resubmission).
  const client = await adminPool.connect();
  try {
    await client.query(
      "INSERT INTO branches (id, tenant_id, name, city) VALUES ($1,$2,$3,$4)",
      [BRANCH, TENANT, "Main", "Riyadh"],
    );
    await client.query(
      "INSERT INTO providers (id, tenant_id, name) VALUES ($1,$2,$3)",
      [PROVIDER, TENANT, "Dr. Race"],
    );
    await client.query(
      "INSERT INTO payers (id, tenant_id, name, type) VALUES ($1,$2,$3,$4)",
      [PAYER, TENANT, "Insurer", "insurer"],
    );
    await client.query(
      "INSERT INTO patients (id, tenant_id, pseudonym) VALUES ($1,$2,$3)",
      [PATIENT, TENANT, "pat-race"],
    );
    await client.query(
      `INSERT INTO claims (id, tenant_id, branch_id, provider_id, payer_id, patient_id, status, total_amount, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [CLAIM, TENANT, BRANCH, PROVIDER, PAYER, PATIENT, "submitted", DENIED_AMOUNT, "SAR"],
    );
    await client.query(
      `INSERT INTO claim_lines (id, tenant_id, claim_id, line_number, qty, unit_price, line_amount)
       VALUES ($1,$2,$3,1,1,$4,$5)`,
      [CLAIM_LINE, TENANT, CLAIM, DENIED_AMOUNT, DENIED_AMOUNT],
    );
    await client.query(
      `INSERT INTO claim_responses (id, tenant_id, claim_id, outcome, adjudicated_amount)
       VALUES ($1,$2,$3,$4,$5)`,
      [CLAIM_RESPONSE, TENANT, CLAIM, "denied", "0"],
    );
    await client.query(
      `INSERT INTO denials (id, tenant_id, claim_line_id, reason_code, denied_amount)
       VALUES ($1,$2,$3,$4,$5)`,
      [DENIAL, TENANT, CLAIM_LINE, "CO-50", DENIED_AMOUNT],
    );
    await client.query(
      "INSERT INTO appeals (id, tenant_id, denial_id, status) VALUES ($1,$2,$3,$4)",
      [APPEAL_A1, TENANT, DENIAL, "draft"],
    );
    await client.query(
      "INSERT INTO appeals (id, tenant_id, denial_id, status) VALUES ($1,$2,$3,$4)",
      [APPEAL_A2, TENANT, DENIAL, "draft"],
    );
  } finally {
    client.release();
  }
}, 60_000);

afterAll(async () => {
  await pool.end();
  await adminPool.end();
});

// The exact lock query markAppealOutcome runs (recovery.ts): lock the owning
// denials row through the appeal→denial join before reading the sibling sum.
const LOCK_DENIED_VIA_APPEAL = `
  SELECT d.denied_amount, d.id AS denial_id FROM appeals a
    JOIN denials d ON d.id = a.denial_id
   WHERE a.id = $1
   LIMIT 1
  FOR UPDATE OF d`;

const SIBLING_RECOVERED_SUM = `
  SELECT COALESCE(SUM(a.recovered_amount), 0)::text AS already_recovered
    FROM appeals a
   WHERE a.denial_id = $1
     AND a.id != $2
     AND a.status = 'won'`;

describe("markAppealOutcome TOCTOU — FOR UPDATE on the denial serializes concurrent resolutions", () => {
  it("the second transaction blocks on the denial lock and then sees the first's committed write", async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      // --- Transaction 1: acquire the denial row lock via appeal A1 ---
      await c1.query("BEGIN");
      await c1.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT]);
      await c1.query(LOCK_DENIED_VIA_APPEAL, [APPEAL_A1]);

      // --- Transaction 2: try to acquire the SAME lock via appeal A2 ---
      // Chained as one promise: BEGIN + GUC + the FOR UPDATE. The whole chain
      // stays pending until the FOR UPDATE completes — which cannot happen
      // while T1 holds the lock. This is the racing sibling call.
      const t2Acquire = c2
        .query("BEGIN")
        .then(() => c2.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT]))
        .then(() => c2.query(LOCK_DENIED_VIA_APPEAL, [APPEAL_A2]))
        .then(() => "acquired");

      // Assert T2 is BLOCKED: the lock must serialize, so T2 must NOT resolve
      // within 400ms. (If the FOR UPDATE were removed, T2 would resolve
      // immediately → "acquired" wins the race and this assertion fails, which
      // is exactly the regression this test guards against.)
      const raced = await Promise.race([
        t2Acquire,
        new Promise<"timeout">((resolve) =>
          setTimeout(() => resolve("timeout"), 400),
        ),
      ]);
      expect(raced).toBe("timeout");

      // --- T1 finishes: read sibling sum (0 — A2 not won yet), write A1, COMMIT ---
      const sib1 = await c1.query(SIBLING_RECOVERED_SUM, [DENIAL, APPEAL_A1]);
      expect(Number(sib1.rows[0].already_recovered)).toBe(0);
      await c1.query(
        "UPDATE appeals SET status = 'won', recovered_amount = $1, submitted_at = now() WHERE id = $2",
        [DENIED_AMOUNT, APPEAL_A1],
      );
      await c1.query("COMMIT");

      // --- T2 unblocks now that T1 released the lock at COMMIT ---
      expect(await t2Acquire).toBe("acquired");

      // The crux: T2's sibling-sum read MUST reflect T1's committed write
      // (1000 SAR for A1), NOT 0. With serialization, T2 started its
      // sibling SUM strictly after T1 committed, so it sees A1 as won.
      // Without the lock both would have read 0 and each committed the full
      // 1000 — the double-recovery.
      const sib2 = await c2.query(SIBLING_RECOVERED_SUM, [DENIAL, APPEAL_A2]);
      expect(Number(sib2.rows[0].already_recovered)).toBe(1000);

      await c2.query("ROLLBACK");
    } finally {
      // Best-effort cleanup of any leftover open transaction.
      try {
        await c1.query("ROLLBACK");
      } catch {
        /* already closed */
      }
      try {
        await c2.query("ROLLBACK");
      } catch {
        /* already closed */
      }
      c1.release();
      c2.release();
    }
  }, 15_000);
});
