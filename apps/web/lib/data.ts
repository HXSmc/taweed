import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { schema, type Database } from "@taweed/db";
import {
  moneyScope,
  reasonPareto,
  trend,
  getLatestBaseline,
  type BaselineSnapshot,
  type DimRate,
  type MoneyScope,
  type ReasonRow,
  type TrendPoint,
} from "@taweed/analytics";
import {
  scrub,
  SCRUBBER_RULES,
  selectRulesForClaim,
  projectClaimFacts,
  type ScrubResult,
} from "@taweed/rules-engine";
import { withSession } from "./db";

// Scrubber "current year" for age derivation. TODO(nphies-creds): once real claims
// carry service dates, derive age at service date, not at wall-clock year.
const SCRUB_YEAR = 2026;

// ---------- Analytics ----------

export interface AnalyticsBundle {
  money: MoneyScope;
  overallRate: number;
  byPayer: DimRate[];
  byBranch: DimRate[];
  pareto: ReasonRow[];
  trend: TrendPoint[];
}

export function getMoneyScope(tenantId: string): Promise<MoneyScope> {
  return withSession(tenantId, (db) => moneyScope(db));
}

/**
 * TRUE denial rate by claim dimension: denied claims / TOTAL claims (0..1), so
 * the hero and ranked bars are a real rate <=100% — unlike @taweed/analytics
 * denialRateBy which reports denials-per-affected-claim. Base is the claims table
 * LEFT JOINed to denials so non-denied claims count in the denominator.
 */
async function denialRateDim(
  db: Database,
  dim: "payer" | "branch",
): Promise<DimRate[]> {
  const keyCol = dim === "payer" ? sql`c.payer_id` : sql`c.branch_id`;
  const nameJoin =
    dim === "payer"
      ? sql`JOIN payers x ON x.id = c.payer_id`
      : sql`JOIN branches x ON x.id = c.branch_id`;
  const res = await db.execute<{
    key: string;
    label: string;
    total_claims: number;
    denied_claims: number;
    at_risk_sar: string;
  }>(sql`
    SELECT ${keyCol} AS key, x.name AS label,
           COUNT(DISTINCT c.id)::int AS total_claims,
           COUNT(DISTINCT c.id) FILTER (WHERE d.id IS NOT NULL)::int AS denied_claims,
           COALESCE(SUM(d.denied_amount), 0)::numeric(14,2)::text AS at_risk_sar
      FROM claims c
      ${nameJoin}
      LEFT JOIN claim_lines cl ON cl.claim_id = c.id
      LEFT JOIN denials d ON d.claim_line_id = cl.id
     GROUP BY ${keyCol}, x.name
     ORDER BY SUM(d.denied_amount) DESC NULLS LAST`);
  return res.rows.map((r) => ({
    key: r.key,
    label: r.label,
    claims: r.total_claims,
    denied: r.denied_claims,
    rate: r.total_claims > 0 ? r.denied_claims / r.total_claims : 0,
    atRiskSar: r.at_risk_sar,
  }));
}

export function getAnalytics(tenantId: string): Promise<AnalyticsBundle> {
  return withSession(tenantId, async (db) => {
    const [money, byPayer, byBranch, pareto, trendPts] = await Promise.all([
      moneyScope(db),
      denialRateDim(db, "payer"),
      denialRateDim(db, "branch"),
      reasonPareto(db),
      trend(db),
    ]);
    const totalClaims = byPayer.reduce((a, r) => a + r.claims, 0);
    const deniedClaims = byPayer.reduce((a, r) => a + r.denied, 0);
    const overallRate = totalClaims > 0 ? deniedClaims / totalClaims : 0;
    return { money, overallRate, byPayer, byBranch, pareto, trend: trendPts };
  });
}

// ---------- Scrubber ----------

export interface ScrubRow {
  claimId: string;
  nphiesClaimId: string | null;
  patientLabel: string;
  payerName: string;
  sbsCodes: string[];
  amount: string;
  result: ScrubResult;
  // ruleId -> the version-resolved rule version used for this claim (B7 scope).
  // Lets the AI-1 explainer dedupe by (rule, version) without widening ScrubFlag.
  ruleVersions: Record<string, number>;
}

export function getScrubRows(tenantId: string, limit = 60): Promise<ScrubRow[]> {
  return withSession(tenantId, async (db) => {
    const claims = await db
      .select()
      .from(schema.claims)
      .orderBy(desc(schema.claims.total_amount))
      .limit(limit);
    if (claims.length === 0) return [];
    const claimIds = claims.map((c) => c.id);
    const patientIds = Array.from(new Set(claims.map((c) => c.patient_id)));
    const payerIds = Array.from(new Set(claims.map((c) => c.payer_id)));

    const [lines, patients, payers] = await Promise.all([
      db.select().from(schema.claimLines).where(inArray(schema.claimLines.claim_id, claimIds)),
      db.select().from(schema.patients).where(inArray(schema.patients.id, patientIds)),
      db.select().from(schema.payers).where(inArray(schema.payers.id, payerIds)),
    ]);
    const linesByClaim = new Map<string, (typeof lines)[number][]>();
    for (const l of lines) {
      const arr = linesByClaim.get(l.claim_id) ?? [];
      arr.push(l);
      linesByClaim.set(l.claim_id, arr);
    }
    const patientById = new Map(patients.map((p) => [p.id, p]));
    const payerById = new Map(payers.map((p) => [p.id, p]));

    const rows = await Promise.all(
      claims.map(async (claim) => {
        const cl = linesByClaim.get(claim.id) ?? [];
        // projectClaimFacts dispatches on claim.data_origin: a production-tagged
        // claim uses the real column mapping; the synthetic hash projection is
        // hard-blocked on production data (EXECUTE B5 gate, packages/rules-engine).
        const facts = projectClaimFacts(
          claim,
          cl,
          patientById.get(claim.patient_id),
          SCRUB_YEAR,
        );
        // B7: scope the rule library to this claim's payer/tenant before scrubbing
        // (global + this payer's tuned rules + this tenant's overrides).
        const rules = selectRulesForClaim(SCRUBBER_RULES, {
          payerId: claim.payer_id,
          tenantId,
        });
        const result = await scrub(facts, rules);
        // Map each applicable rule id to its resolved version so the client can
        // ask the explainer for the exact (rule, version) that fired.
        const ruleVersions: Record<string, number> = {};
        for (const r of rules) ruleVersions[r.id] = r.version;
        return {
          claimId: claim.id,
          nphiesClaimId: claim.nphies_claim_id,
          patientLabel: patientById.get(claim.patient_id)?.pseudonym ?? "PT-????",
          payerName: payerById.get(claim.payer_id)?.name ?? "Unknown payer",
          sbsCodes: facts.sbsCodes,
          amount: claim.total_amount,
          result,
          ruleVersions,
        } satisfies ScrubRow;
      }),
    );
    // Money-first sort: highest risk first (design-brief §8.6).
    return rows.sort((a, b) => b.result.riskScore - a.result.riskScore);
  });
}

// ---------- Recovery ----------

export interface AppealPipelineRow {
  appealId: string;
  claimId: string;
  nphiesClaimId: string | null;
  payerName: string;
  status: string;
  appealedSar: string;
  recoveredSar: string | null;
  daysOpen: number;
}

export interface RecoveryBundle {
  money: MoneyScope;
  winRate: number;
  medianDays: number;
  sharePct: number;
  shareSar: string;
  // EXECUTE B8: the onboarding baseline, so the ROI band can show progress
  // against a fixed at-risk starting point (null if none captured yet).
  baseline: BaselineSnapshot | null;
  rows: AppealPipelineRow[];
}

export function getRecovery(tenantId: string): Promise<RecoveryBundle> {
  return withSession(tenantId, async (db) => {
    const [money, baseline] = await Promise.all([
      moneyScope(db),
      getLatestBaseline(db),
    ]);
    const rows = await db.execute<{
      appeal_id: string;
      claim_id: string;
      nphies_claim_id: string | null;
      payer_name: string;
      status: string;
      appealed_sar: string;
      recovered_sar: string | null;
      days_open: number;
    }>(sql`
      SELECT a.id AS appeal_id, c.id AS claim_id, c.nphies_claim_id,
             p.name AS payer_name, a.status,
             d.denied_amount AS appealed_sar, a.recovered_amount AS recovered_sar,
             COALESCE(EXTRACT(DAY FROM now() - a.generated_at), 0)::int AS days_open
        FROM appeals a
        JOIN denials d ON d.id = a.denial_id
        JOIN claim_lines cl ON cl.id = d.claim_line_id
        JOIN claims c ON c.id = cl.claim_id
        JOIN payers p ON p.id = c.payer_id
       ORDER BY a.recovered_amount DESC NULLS LAST, d.denied_amount DESC
       LIMIT 200`);

    const list: AppealPipelineRow[] = rows.rows.map((r) => ({
      appealId: r.appeal_id,
      claimId: r.claim_id,
      nphiesClaimId: r.nphies_claim_id,
      payerName: r.payer_name,
      status: r.status,
      appealedSar: r.appealed_sar,
      recoveredSar: r.recovered_sar,
      daysOpen: Number(r.days_open),
    }));

    // Win rate + median days over ALL appeals (not the display-limited/recovered-
    // biased rows), so the ROI metrics are honest.
    const agg = await db.execute<{ won: number; lost: number; median_days: number }>(sql`
      SELECT
        count(*) FILTER (WHERE status = 'won')::int  AS won,
        count(*) FILTER (WHERE status = 'lost')::int AS lost,
        COALESCE(percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(DAY FROM now() - generated_at)), 0)::int AS median_days
      FROM appeals`);
    const a = agg.rows[0];
    const won = Number(a?.won ?? 0);
    const lost = Number(a?.lost ?? 0);
    const winRate = won + lost > 0 ? won / (won + lost) : 0;
    const medianDays = Number(a?.median_days ?? 0);
    const recovered = Number(money.recoveredSar);
    const sharePct = 0.12; // recovery-share model (design-brief §12); DEPLOY: per-contract
    const shareSar = (recovered * sharePct).toFixed(2);

    return { money, winRate, medianDays, sharePct, shareSar, baseline, rows: list };
  });
}

// ---------- Admin / trust ----------

export interface BranchRow {
  id: string;
  name: string;
  city: string | null;
}

export function getBranches(tenantId: string): Promise<BranchRow[]> {
  return withSession(tenantId, async (db) => {
    const rows = await db
      .select({ id: schema.branches.id, name: schema.branches.name, city: schema.branches.city })
      .from(schema.branches)
      .orderBy(schema.branches.name);
    return rows;
  });
}

export function getRules(tenantId: string) {
  return withSession(tenantId, (db) =>
    db
      .select()
      .from(schema.rules)
      .where(eq(schema.rules.active, true))
      .orderBy(schema.rules.severity),
  );
}

export function getAuditLog(tenantId: string, limit = 100) {
  return withSession(tenantId, (db) =>
    db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.at))
      .limit(limit),
  );
}
