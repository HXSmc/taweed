/**
 * Shared synthetic data loader (IMPLEMENT). Generates and inserts realistic
 * multi-tenant demo data into an EXISTING database:
 *   tenants -> branches/providers/payers/patients
 *   -> claims/lines/responses/denials (via the CREATE pipeline)
 *   -> appeals (for the recovery/ROI loop) -> rules -> users.
 *
 * This module NEVER migrates or touches schema/roles. It assumes the schema,
 * the `taweed_app` role, and RLS policies already exist on the target DB
 * (applied forward-only in prod, or by the destructive `migrate()` helper in
 * dev). Tenant rows go through the admin (superuser) connection; every
 * tenant-scoped write goes through withTenant on the NOBYPASSRLS app role, so
 * RLS is exercised exactly as in prod. Codes stay placeholder (TODO(nphies-creds)).
 */
import { parseBundle } from "@taweed/fhir";
import { normalize, type NormalizeContext } from "@taweed/normalizer";
import { generateBundle, SCENARIOS } from "@taweed/synthetic-fhir";
import { SCRUBBER_RULES } from "@taweed/rules-engine";
import { captureBaseline } from "@taweed/analytics";
import { newId, type NormalizedClaim } from "@taweed/shared";
import {
  withTenant,
  insertNormalizedClaim,
  schema,
  type Database,
  type Pool,
} from "@taweed/db";

const CLEAN_PER_SEED = 14; // accepted claims added per seed to keep denial rate realistic

interface Dim {
  id: string;
  [k: string]: unknown;
}

interface TenantSpec {
  id: string;
  name: string;
  seeds: number;
  branches: { name: string; city: string }[];
  providers: { name: string; specialty: string }[];
  payers: { name: string; type: "insurer" | "tpa" }[];
}

const PAYERS: { name: string; type: "insurer" | "tpa" }[] = [
  { name: "Bupa Arabia", type: "insurer" },
  { name: "Tawuniya", type: "insurer" },
  { name: "MedGulf", type: "insurer" },
];

// Deterministic tenant ids so re-seeding keeps existing dev sessions valid
// (a random id each run would orphan the session's tenant → RLS shows 0 rows).
const TENANT_A_ID = "00000000-0000-4000-8000-000000000001";
const TENANT_B_ID = "00000000-0000-4000-8000-000000000002";

function buildTenants(scale: number): TenantSpec[] {
  return [
    {
      id: TENANT_A_ID,
      name: "Al Salama Dental Group",
      seeds: Math.round(40 * scale),
      branches: [
        { name: "Riyadh, Olaya", city: "Riyadh" },
        { name: "Jeddah, Al Rawdah", city: "Jeddah" },
        { name: "Dammam, Al Faisaliyah", city: "Dammam" },
      ],
      providers: [
        { name: "Dr. Layla Al Harbi", specialty: "General Dentistry" },
        { name: "Dr. Omar Nasser", specialty: "Endodontics" },
        { name: "Dr. Huda Al Qahtani", specialty: "Orthodontics" },
        { name: "Dr. Faisal Al Otaibi", specialty: "Oral Surgery" },
      ],
      payers: PAYERS,
    },
    {
      id: TENANT_B_ID,
      name: "Noor Polyclinic",
      seeds: Math.round(12 * scale),
      branches: [
        { name: "Riyadh, Al Malaz", city: "Riyadh" },
        { name: "Mecca, Al Aziziyah", city: "Mecca" },
      ],
      providers: [
        { name: "Dr. Sara Al Dossari", specialty: "Dermatology" },
        { name: "Dr. Khalid Al Zahrani", specialty: "Internal Medicine" },
      ],
      payers: PAYERS,
    },
  ];
}

const ROLES = ["owner", "finance", "rcm", "clinician", "admin"] as const;
const GENDERS = ["male", "female"] as const;

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function seedTenantRow(admin: Pool, id: string, name: string): Promise<void> {
  const client = await admin.connect();
  try {
    await client.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [id, name]);
  } finally {
    client.release();
  }
}

async function seedDimensions(db: Database, t: TenantSpec) {
  const branches: Dim[] = t.branches.map((b) => ({
    id: newId(),
    tenant_id: t.id,
    name: b.name,
    city: b.city,
    license: null,
  }));
  const providers: Dim[] = t.providers.map((p) => ({
    id: newId(),
    tenant_id: t.id,
    name: p.name,
    specialty: p.specialty,
    nphies_practitioner_id: null,
  }));
  const payers: Dim[] = t.payers.map((p, i) => ({
    id: newId(),
    tenant_id: t.id,
    name: p.name,
    nphies_payer_id: `payer-${slug(p.name)}-${i}`, // TODO(nphies-creds): real payer id
    type: p.type,
  }));
  const patients: Dim[] = Array.from({ length: 24 }, (_, i) => ({
    id: newId(),
    tenant_id: t.id,
    pseudonym: `PT-${String(i + 1).padStart(4, "0")}`, // PHI-minimized
    birth_year: 1955 + ((i * 7) % 55),
    gender: GENDERS[i % GENDERS.length]!,
  }));

  await db.insert(schema.branches).values(branches as never);
  await db.insert(schema.providers).values(providers as never);
  await db.insert(schema.payers).values(payers as never);
  await db.insert(schema.patients).values(patients as never);
  return { branches, providers, payers, patients };
}

function buildClaims(
  t: TenantSpec,
  dims: Awaited<ReturnType<typeof seedDimensions>>,
): NormalizedClaim[] {
  const out: NormalizedClaim[] = [];
  let i = 0;
  for (let seed = 1; seed <= t.seeds; seed++) {
    for (let s = 0; s < SCENARIOS.length; s++) {
      const scenario = SCENARIOS[s]!;
      const { pairs, issues } = parseBundle(generateBundle(scenario, seed * 100 + s));
      if (issues.length > 0 || pairs.length === 0) continue;
      const ctx: NormalizeContext = {
        tenantId: t.id,
        branchId: dims.branches[i % dims.branches.length]!.id,
        providerId: dims.providers[i % dims.providers.length]!.id,
        payerId: dims.payers[(seed + s) % dims.payers.length]!.id,
        patientId: dims.patients[i % dims.patients.length]!.id,
        dataOrigin: "synthetic",
      };
      const normalized = normalize(pairs[0]!, ctx);
      // Guarantee nphies_claim_id uniqueness per tenant (idempotency index).
      normalized.claim.nphies_claim_id = `${scenario}-${seed}-${s}`;
      // Spread submission dates across ~6 months so the trend chart has a curve.
      normalized.claim.submitted_at = new Date(
        Date.now() - (((i * 37) % 180) + 1) * 86_400_000,
      ).toISOString();
      out.push(normalized);
      i++;
    }
    // Extra clean (accepted) claims so the denial RATE reads realistically
    // (~30-40%) rather than being dominated by the denial-heavy scenario mix.
    for (let k = 0; k < CLEAN_PER_SEED; k++) {
      const { pairs, issues } = parseBundle(generateBundle("clean", seed * 1000 + k));
      if (issues.length > 0 || pairs.length === 0) continue;
      const ctx: NormalizeContext = {
        tenantId: t.id,
        branchId: dims.branches[i % dims.branches.length]!.id,
        providerId: dims.providers[i % dims.providers.length]!.id,
        payerId: dims.payers[(seed + k) % dims.payers.length]!.id,
        patientId: dims.patients[i % dims.patients.length]!.id,
        dataOrigin: "synthetic",
      };
      const normalized = normalize(pairs[0]!, ctx);
      normalized.claim.nphies_claim_id = `clean-x-${seed}-${k}`;
      normalized.claim.submitted_at = new Date(
        Date.now() - (((i * 37) % 180) + 1) * 86_400_000,
      ).toISOString();
      out.push(normalized);
      i++;
    }
  }
  return out;
}

async function seedRules(db: Database, tenantId: string): Promise<number> {
  // Global scrubber library seeded per tenant (rules table is tenant-scoped;
  // scope="global" marks them as the shared library vs a tenant/payer override).
  const rows = SCRUBBER_RULES.map((rule) => ({
    id: newId(),
    tenant_id: tenantId,
    scope: rule.scope,
    condition: rule.conditions,
    severity: rule.severity,
    message_en: rule.message_en,
    message_ar: rule.message_ar,
    version: rule.version,
    // The shipped library is live: `status='approved'` is the authoritative gate
    // (getRules + the scrubber read status), and `active` mirrors it. Seeding both
    // consistently is what stops the two columns from disagreeing (a shipped rule
    // was previously active=true but status defaulted to 'draft').
    status: "approved",
    active: true,
  }));
  await db.insert(schema.rules).values(rows as never);
  return rows.length;
}

async function seedUsers(db: Database, t: TenantSpec): Promise<void> {
  const domain = slug(t.name).slice(0, 20);
  const rows = ROLES.map((role) => ({
    id: newId(),
    tenant_id: t.id,
    role,
    locale: role === "owner" ? "ar" : "en", // owner default Arabic (design-brief §5)
    email: `${role}@${domain}.dev`,
  }));
  await db.insert(schema.users).values(rows as never);
}

/** Build appeals from a subset of denials so recovery/ROI has data. */
function buildAppeals(tenantId: string, normalized: NormalizedClaim[]) {
  const appeals: Record<string, unknown>[] = [];
  const now = new Date();
  let n = 0;
  for (const nc of normalized) {
    for (const d of nc.denials) {
      n++;
      if (n % 5 === 0) continue; // ~20% of denials never appealed
      const roll = n % 10;
      const denied = Number(d.denied_amount);
      let status: string;
      let recovered: string | null = null;
      let submittedAt: Date | null = null;
      if (roll < 6) {
        status = "won";
        // Integer halalas: no float drift on the ledger cent.
        recovered = (Math.round(Math.round(denied * 100) * 0.85) / 100).toFixed(2);
        submittedAt = now;
      } else if (roll < 8) {
        status = "lost";
        submittedAt = now;
      } else {
        status = "submitted";
        submittedAt = now;
      }
      // Spread generation dates over ~30 days so median-days-to-recovery is real.
      const genAt = new Date(now.getTime() - ((n * 3) % 30) * 86_400_000);
      appeals.push({
        id: newId(),
        tenant_id: tenantId,
        denial_id: d.id,
        template_id: null,
        status,
        recovered_amount: recovered,
        generated_at: genAt,
        submitted_at: submittedAt ? genAt : null,
      });
    }
  }
  return appeals;
}

export interface SeedSummary {
  tenants: number;
  claims: number;
  denials: number;
  appeals: number;
  rules: number;
}

export interface SeedDataOptions {
  /** Multiplier on per-tenant synthetic claim volume. Defaults to SEED_SCALE env, then 1. */
  scale?: number;
  /** Progress sink. Defaults to console.log. */
  log?: (msg: string) => void;
}

/**
 * Load synthetic multi-tenant demo data into an existing, already-migrated DB.
 *
 * `admin` is the superuser pool (used only to INSERT the tenant dimension row);
 * `app` is the NOBYPASSRLS app-role pool through which every tenant-scoped write
 * flows via withTenant, so RLS binds exactly as in prod. Does not migrate.
 */
export async function seedData(
  admin: Pool,
  app: Pool,
  opts: SeedDataOptions = {},
): Promise<SeedSummary> {
  const log = opts.log ?? console.log;
  const scale = opts.scale ?? Number(process.env.SEED_SCALE ?? "1");
  const tenants = buildTenants(scale);

  let totalClaims = 0;
  let totalDenials = 0;
  let totalAppeals = 0;
  let totalRules = 0;

  for (const t of tenants) {
    await seedTenantRow(admin, t.id, t.name);

    const normalized = await withTenant(app, t.id, async (db) => {
      const dims = await seedDimensions(db, t);
      const claims = buildClaims(t, dims);
      for (const nc of claims) await insertNormalizedClaim(db, nc);
      totalRules += await seedRules(db, t.id);
      await seedUsers(db, t);
      // EXECUTE B8: capture the onboarding baseline BEFORE any appeals exist, so
      // it snapshots the true starting at-risk figure (build-plan §11).
      await captureBaseline(db, "seed onboarding baseline");
      return claims;
    });

    const appeals = buildAppeals(t.id, normalized);
    if (appeals.length > 0) {
      await withTenant(app, t.id, async (db) => {
        await db.insert(schema.appeals).values(appeals as never);
      });
    }

    const denials = normalized.reduce((a, nc) => a + nc.denials.length, 0);
    totalClaims += normalized.length;
    totalDenials += denials;
    totalAppeals += appeals.length;
    log(
      `[seed] ${t.name}: ${normalized.length} claims, ${denials} denials, ${appeals.length} appeals`,
    );
  }

  log(
    `[seed] done. tenants=${tenants.length} claims=${totalClaims} denials=${totalDenials} appeals=${totalAppeals} rules=${totalRules}`,
  );

  return { tenants: tenants.length, claims: totalClaims, denials: totalDenials, appeals: totalAppeals, rules: totalRules };
}
