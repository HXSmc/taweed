import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@taweed/db";
import { denialLabel, isDenialReasonCode } from "@taweed/shared";
import type {
  AnalyticsFilters,
  BaselineSnapshot,
  DimRate,
  MoneyScope,
  ReasonRow,
  TrendPoint,
} from "./types.js";
import { cumulativePareto } from "./money.js";

// Rollups over the CANONICAL relational model only (build-plan §3, §6) — never
// raw FHIR. Every function MUST be called inside `withTenant`, so RLS scopes all
// of these queries to a single tenant; we never filter by tenant_id by hand.
//
// Money is summed IN Postgres (numeric is exact) and cast to a 2-decimal text
// string, so no float ever touches a SAR value. Counts are cast to int4 so the
// pg driver returns JS numbers (bigint would come back as a string).

/** Claim-level slicers, as raw SQL predicates against the `claims c` alias. */
function claimConds(f?: AnalyticsFilters): SQL[] {
  const conds: SQL[] = [];
  const branchIds = f?.branchIds;
  if (branchIds && branchIds.length > 0) {
    const list = sql.join(
      branchIds.map((id) => sql`${id}`),
      sql`, `,
    );
    conds.push(sql`c.branch_id IN (${list})`);
  }
  // submitted_at is text; cast to date so range filters are calendar-correct.
  // A null submitted_at fails the cast comparison and is excluded — correct,
  // since an undated claim can't be placed in a date window.
  if (f?.from) conds.push(sql`c.submitted_at::date >= ${f.from}::date`);
  if (f?.to) conds.push(sql`c.submitted_at::date <= ${f.to}::date`);
  return conds;
}

function whereFrom(conds: SQL[]): SQL {
  if (conds.length === 0) return sql``;
  return sql` WHERE ${sql.join(conds, sql` AND `)}`;
}

export type DenialDimension = "payer" | "branch" | "provider" | "reason" | "sbs";

interface DimConfig {
  keyExpr: SQL;
  labelExpr: SQL;
  join: SQL;
  extraConds: SQL[];
}

// Per-dimension key/label source. The base join is always
// denials -> claim_lines -> claims, so `claims` here counts DENIED claims and
// `denied` counts denial rows (build-plan §6). payer/branch/provider read the
// dimension off the claim (+ a name join); reason/sbs read it off the
// denial/line and use the raw value as its own label.
const DIMS: Record<DenialDimension, DimConfig> = {
  payer: {
    keyExpr: sql`c.payer_id`,
    labelExpr: sql`p.name`,
    join: sql` JOIN payers p ON p.id = c.payer_id`,
    extraConds: [],
  },
  branch: {
    keyExpr: sql`c.branch_id`,
    labelExpr: sql`b.name`,
    join: sql` JOIN branches b ON b.id = c.branch_id`,
    extraConds: [],
  },
  provider: {
    keyExpr: sql`c.provider_id`,
    labelExpr: sql`pr.name`,
    join: sql` JOIN providers pr ON pr.id = c.provider_id`,
    extraConds: [],
  },
  reason: {
    keyExpr: sql`d.reason_code`,
    labelExpr: sql`d.reason_code`,
    join: sql``,
    extraConds: [],
  },
  sbs: {
    keyExpr: sql`cl.sbs_code`,
    labelExpr: sql`cl.sbs_code`,
    join: sql``,
    extraConds: [sql`cl.sbs_code IS NOT NULL`],
  },
};

// Row types for db.execute are `type` (not `interface`) so they satisfy the
// `Record<string, unknown>` constraint via an implicit index signature.
type DimRow = {
  key: string;
  label: string | null;
  claims: number;
  denied: number;
  at_risk_sar: string;
};

/**
 * Denials grouped by a dimension: claims = distinct denied claims, denied =
 * denial rows, rate = denied/claims (denials per affected claim), atRiskSar =
 * total denied amount. Ordered by at-risk money descending.
 */
export async function denialRateBy(
  db: Database,
  dim: DenialDimension,
  f?: AnalyticsFilters,
): Promise<DimRate[]> {
  const cfg = DIMS[dim];
  const where = whereFrom([...cfg.extraConds, ...claimConds(f)]);
  const result = await db.execute<DimRow>(sql`
    SELECT ${cfg.keyExpr} AS key,
           ${cfg.labelExpr} AS label,
           COUNT(DISTINCT c.id)::int AS claims,
           COUNT(DISTINCT d.id)::int AS denied,
           COALESCE(SUM(d.denied_amount), 0)::numeric(14,2)::text AS at_risk_sar
    FROM denials d
    JOIN claim_lines cl ON cl.id = d.claim_line_id
    JOIN claims c ON c.id = cl.claim_id${cfg.join}${where}
    GROUP BY ${cfg.keyExpr}, ${cfg.labelExpr}
    ORDER BY SUM(d.denied_amount) DESC, key ASC
  `);
  return result.rows.map((r) => {
    const label =
      dim === "reason" && isDenialReasonCode(r.key)
        ? denialLabel(r.key)
        : (r.label ?? r.key);
    return {
      key: r.key,
      label,
      claims: r.claims,
      denied: r.denied,
      rate: r.claims > 0 ? Math.round((r.denied / r.claims) * 10000) / 10000 : 0,
      atRiskSar: r.at_risk_sar,
    };
  });
}

type ReasonQueryRow = {
  code: string;
  count: number;
  sar: string;
};

/**
 * Reason-code Pareto: count + at-risk money per reason, ordered by money
 * descending, with a descending cumulative % (via the pure money helper) so the
 * UI can draw the 80-20 line. Labels resolve through the placeholder taxonomy;
 * unknown codes fall back to the raw code.
 */
export async function reasonPareto(
  db: Database,
  f?: AnalyticsFilters,
): Promise<ReasonRow[]> {
  const where = whereFrom(claimConds(f));
  const result = await db.execute<ReasonQueryRow>(sql`
    SELECT d.reason_code AS code,
           COUNT(*)::int AS count,
           COALESCE(SUM(d.denied_amount), 0)::numeric(14,2)::text AS sar
    FROM denials d
    JOIN claim_lines cl ON cl.id = d.claim_line_id
    JOIN claims c ON c.id = cl.claim_id${where}
    GROUP BY d.reason_code
    ORDER BY SUM(d.denied_amount) DESC, d.reason_code ASC
  `);
  const rows = result.rows;
  // Rows already arrive sorted by sar desc; cumulativePareto keeps that order.
  const cumulative = cumulativePareto(
    rows.map((r) => ({ sar: r.sar, count: r.count })),
  );
  return rows.map((r, i) => ({
    code: r.code,
    label: isDenialReasonCode(r.code) ? denialLabel(r.code) : r.code,
    count: r.count,
    sar: r.sar,
    cumulativePct: cumulative[i] ?? 0,
  }));
}

type MoneyScopeRow = {
  recovered_sar: string;
  at_risk_sar: string;
  denied_count: number;
  claim_count: number;
};

/**
 * Headline money KPIs. atRiskSar = denied amount NOT yet recovered (no won
 * appeal on the denial); recoveredSar = recovered amount on won appeals;
 * deniedCount = denial rows in scope; claimCount = claims in scope. Each metric
 * is a scalar subquery so their different bases don't fan out against each
 * other.
 */
export async function moneyScope(
  db: Database,
  f?: AnalyticsFilters,
): Promise<MoneyScope> {
  const cc = claimConds(f);
  const atRiskWhere = whereFrom([sql`a.id IS NULL`, ...cc]);
  const recoveredWhere = whereFrom([sql`a.status = 'won'`, ...cc]);
  const claimScopeWhere = whereFrom(cc);
  const result = await db.execute<MoneyScopeRow>(sql`
    SELECT
      (SELECT COALESCE(SUM(d.denied_amount), 0)::numeric(14,2)::text
         FROM denials d
         JOIN claim_lines cl ON cl.id = d.claim_line_id
         JOIN claims c ON c.id = cl.claim_id
         LEFT JOIN appeals a ON a.denial_id = d.id AND a.status = 'won'
         ${atRiskWhere}) AS at_risk_sar,
      (SELECT COALESCE(SUM(a.recovered_amount), 0)::numeric(14,2)::text
         FROM appeals a
         JOIN denials d ON d.id = a.denial_id
         JOIN claim_lines cl ON cl.id = d.claim_line_id
         JOIN claims c ON c.id = cl.claim_id
         ${recoveredWhere}) AS recovered_sar,
      (SELECT COUNT(*)::int
         FROM denials d
         JOIN claim_lines cl ON cl.id = d.claim_line_id
         JOIN claims c ON c.id = cl.claim_id
         ${claimScopeWhere}) AS denied_count,
      (SELECT COUNT(*)::int FROM claims c${claimScopeWhere}) AS claim_count
  `);
  const row = result.rows[0];
  return {
    recoveredSar: row?.recovered_sar ?? "0.00",
    atRiskSar: row?.at_risk_sar ?? "0.00",
    deniedCount: row?.denied_count ?? 0,
    claimCount: row?.claim_count ?? 0,
  };
}

type BaselineRow = {
  id: string;
  captured_at: string;
  at_risk_sar: string;
  denied_count: number;
  claim_count: number;
  note: string | null;
};

function toBaseline(r: BaselineRow): BaselineSnapshot {
  return {
    id: r.id,
    capturedAt: r.captured_at,
    atRiskSar: r.at_risk_sar,
    deniedCount: r.denied_count,
    claimCount: r.claim_count,
    note: r.note,
  };
}

/**
 * EXECUTE B8 — snapshot the current at-risk figure as the recovery baseline
 * (build-plan §11). Runs inside withTenant; tenant_id comes from the RLS GUC so a
 * baseline can never be misattributed. Returns the row it wrote.
 */
export async function captureBaseline(
  db: Database,
  note?: string,
): Promise<BaselineSnapshot> {
  const m = await moneyScope(db);
  const res = await db.execute<BaselineRow>(sql`
    INSERT INTO recovery_baselines
      (tenant_id, baseline_at_risk_sar, baseline_denied_count, baseline_claim_count, note)
    VALUES (
      current_setting('app.tenant_id')::uuid,
      ${m.atRiskSar}::numeric, ${m.deniedCount}, ${m.claimCount}, ${note ?? null})
    RETURNING id,
              captured_at,
              baseline_at_risk_sar::numeric(14,2)::text AS at_risk_sar,
              baseline_denied_count AS denied_count,
              baseline_claim_count AS claim_count,
              note`);
  return toBaseline(res.rows[0]!);
}

/** Latest recovery baseline for the tenant, or null if none captured yet. */
export async function getLatestBaseline(
  db: Database,
): Promise<BaselineSnapshot | null> {
  const res = await db.execute<BaselineRow>(sql`
    SELECT id,
           captured_at,
           baseline_at_risk_sar::numeric(14,2)::text AS at_risk_sar,
           baseline_denied_count AS denied_count,
           baseline_claim_count AS claim_count,
           note
      FROM recovery_baselines
     ORDER BY captured_at DESC
     LIMIT 1`);
  const row = res.rows[0];
  return row ? toBaseline(row) : null;
}

type TrendRow = {
  period: string;
  denied_sar: string;
  recovered_sar: string;
};

/**
 * Monthly trend of denied vs recovered money, bucketed by the YYYY-MM prefix of
 * claims.submitted_at. Denied and recovered are computed independently then
 * FULL-joined on the month so a period with only one of them still appears.
 */
export async function trend(
  db: Database,
  f?: AnalyticsFilters,
): Promise<TrendPoint[]> {
  const cc = claimConds(f);
  const datedWhere = whereFrom([sql`c.submitted_at IS NOT NULL`, ...cc]);
  const recoveredWhere = whereFrom([
    sql`a.status = 'won'`,
    sql`c.submitted_at IS NOT NULL`,
    ...cc,
  ]);
  const result = await db.execute<TrendRow>(sql`
    WITH denied AS (
      SELECT substr(c.submitted_at, 1, 7) AS period,
             SUM(d.denied_amount) AS denied_sar
      FROM denials d
      JOIN claim_lines cl ON cl.id = d.claim_line_id
      JOIN claims c ON c.id = cl.claim_id
      ${datedWhere}
      GROUP BY 1
    ),
    recovered AS (
      SELECT substr(c.submitted_at, 1, 7) AS period,
             SUM(a.recovered_amount) AS recovered_sar
      FROM appeals a
      JOIN denials d ON d.id = a.denial_id
      JOIN claim_lines cl ON cl.id = d.claim_line_id
      JOIN claims c ON c.id = cl.claim_id
      ${recoveredWhere}
      GROUP BY 1
    )
    SELECT COALESCE(dn.period, rc.period) AS period,
           COALESCE(dn.denied_sar, 0)::numeric(14,2)::text AS denied_sar,
           COALESCE(rc.recovered_sar, 0)::numeric(14,2)::text AS recovered_sar
    FROM denied dn
    FULL OUTER JOIN recovered rc ON dn.period = rc.period
    WHERE COALESCE(dn.period, rc.period) IS NOT NULL
    ORDER BY period ASC
  `);
  return result.rows.map((r) => ({
    period: r.period,
    deniedSar: r.denied_sar,
    recoveredSar: r.recovered_sar,
  }));
}
