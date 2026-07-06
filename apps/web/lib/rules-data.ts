import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema, type Database } from "@taweed/db";
import type { ScrubRule, Severity } from "@taweed/rules-engine";
import { withSession } from "./db";

// AI-3 data access — the authored-rule library on top of the shipped SCRUBBER_RULES
// (plan 04 §2, §4.3). An LLM- (or human-) authored rule is stored in `rules` with
// status='draft', gated, and only executes once a human flips it to 'approved'.
// Everything here is RLS-scoped (tenant from the session), so a tenant only ever
// sees and runs its own authored rules.

type RuleRow = typeof schema.rules.$inferSelect;

/** DB row -> executable ScrubRule. rule_key is the logical id; condition the tree. */
function rowToScrubRule(r: RuleRow): ScrubRule {
  return {
    id: r.rule_key ?? r.id,
    name: r.name ?? "",
    scope: (r.scope as ScrubRule["scope"]) ?? "global",
    version: r.version,
    severity: (r.severity as Severity) ?? "warn",
    weight: r.weight,
    field: r.field ?? "",
    message_en: r.message_en ?? "",
    message_ar: r.message_ar ?? "",
    conditions: r.condition,
    payerId: r.payer_id,
    tenantId: r.scope === "tenant" ? r.tenant_id : null,
  };
}

/**
 * APPROVED authored rules for the active tenant, mapped to executable ScrubRules —
 * runs inside an existing RLS transaction (the scrubber's). Only status='approved'
 * with a rule_key (an authored rule) is returned; drafts and rejected rows never
 * execute.
 */
export async function loadApprovedAuthoredRulesTx(
  db: Database,
): Promise<ScrubRule[]> {
  const rows = await db
    .select()
    .from(schema.rules)
    .where(
      and(
        eq(schema.rules.status, "approved"),
        sql`${schema.rules.rule_key} IS NOT NULL`,
      ),
    );
  return rows.map(rowToScrubRule);
}

/** Own-session variant for the authoring gate's base rule set. */
export function loadApprovedAuthoredRules(
  tenantId: string,
): Promise<ScrubRule[]> {
  return withSession(tenantId, (db) => loadApprovedAuthoredRulesTx(db));
}

export interface AuthoredRuleRow {
  id: string;
  ruleKey: string;
  name: string;
  scope: string;
  payerId: string | null;
  severity: string;
  field: string;
  weight: number;
  version: number;
  messageEn: string;
  messageAr: string;
  rationale: string | null;
  conditions: unknown;
  authoredBy: string;
  status: string;
  model: string | null;
  createdBy: string | null;
  createdAt: string | null;
}

/** All authored rules (draft/approved/rejected) for the settings UI, newest first. */
export function listAuthoredRules(
  tenantId: string,
): Promise<AuthoredRuleRow[]> {
  return withSession(tenantId, async (db) => {
    const rows = await db
      .select()
      .from(schema.rules)
      .where(sql`${schema.rules.rule_key} IS NOT NULL`)
      .orderBy(desc(schema.rules.created_at));
    return rows.map((r) => ({
      id: r.id,
      ruleKey: r.rule_key ?? r.id,
      name: r.name ?? "",
      scope: r.scope,
      payerId: r.payer_id,
      severity: r.severity ?? "warn",
      field: r.field ?? "",
      weight: r.weight,
      version: r.version,
      messageEn: r.message_en ?? "",
      messageAr: r.message_ar ?? "",
      rationale: r.rationale,
      conditions: r.condition,
      authoredBy: r.authored_by,
      status: r.status,
      model: r.model,
      createdBy: r.created_by,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
  });
}

export interface PersistDraftInput {
  rule: ScrubRule;
  rationale: string;
  authoredBy: "llm" | "human";
  promptSha256: string | null;
  model: string | null;
  actor: string;
}

/**
 * Persist a validated draft DISABLED (status='draft', never active). Returns the
 * new row id. tenant_id is set from the RLS GUC so a draft can never be attributed
 * to another tenant. The unique (tenant, rule_key, version) index makes a
 * re-authored same-version draft an idempotent upsert instead of a duplicate.
 */
export function persistDraftRule(
  tenantId: string,
  input: PersistDraftInput,
): Promise<string> {
  return withSession(tenantId, async (db) => {
    const rows = await db
      .insert(schema.rules)
      .values({
        tenant_id: sql`current_setting('app.tenant_id')::uuid`,
        rule_key: input.rule.id,
        name: input.rule.name,
        scope: input.rule.scope,
        payer_id: input.rule.payerId ?? null,
        severity: input.rule.severity,
        field: input.rule.field,
        weight: input.rule.weight,
        version: input.rule.version,
        message_en: input.rule.message_en,
        message_ar: input.rule.message_ar,
        condition: input.rule.conditions as object,
        rationale: input.rationale,
        authored_by: input.authoredBy,
        prompt_sha256: input.promptSha256,
        model: input.model,
        status: "draft",
        active: false,
        created_by: input.actor,
      })
      .onConflictDoUpdate({
        target: [
          schema.rules.tenant_id,
          schema.rules.rule_key,
          schema.rules.version,
        ],
        // The matching unique index is PARTIAL (`WHERE rule_key IS NOT NULL`,
        // migration 0007). Postgres can only infer a partial index as the ON
        // CONFLICT arbiter when the statement repeats its predicate — omitting
        // targetWhere raises 42P10 at plan time on EVERY insert. (Pre-existing
        // authored rows all have a non-null rule_key, so the predicate always holds.)
        targetWhere: sql`${schema.rules.rule_key} IS NOT NULL`,
        set: {
          name: input.rule.name,
          scope: input.rule.scope,
          payer_id: input.rule.payerId ?? null,
          severity: input.rule.severity,
          field: input.rule.field,
          weight: input.rule.weight,
          message_en: input.rule.message_en,
          message_ar: input.rule.message_ar,
          condition: input.rule.conditions as object,
          rationale: input.rationale,
          prompt_sha256: input.promptSha256,
          model: input.model,
          // Re-authoring an existing key returns it to draft for re-approval.
          status: "draft",
          active: false,
          created_by: input.actor,
        },
      })
      .returning({ id: schema.rules.id });
    return rows[0]!.id;
  });
}

/**
 * Flip a draft's lifecycle status (approve/reject), server-enforced. Only a
 * still-'draft' authored rule can transition — an already-approved/rejected row is
 * a no-op (returns false). Approval also sets active=true so the scrubber loads it.
 */
export function setRuleStatus(
  tenantId: string,
  rowId: string,
  status: "approved" | "rejected",
): Promise<boolean> {
  return withSession(tenantId, async (db) => {
    const rows = await db
      .update(schema.rules)
      .set({ status, active: status === "approved" })
      .where(
        and(
          eq(schema.rules.id, rowId),
          eq(schema.rules.status, "draft"),
          sql`${schema.rules.rule_key} IS NOT NULL`,
        ),
      )
      .returning({ id: schema.rules.id });
    return rows.length > 0;
  });
}

/** One authored rule row (for the approval action to re-gate before approving). */
export function getAuthoredRule(
  tenantId: string,
  rowId: string,
): Promise<AuthoredRuleRow | null> {
  return withSession(tenantId, async (db) => {
    const rows = await db
      .select()
      .from(schema.rules)
      .where(and(eq(schema.rules.id, rowId), sql`${schema.rules.rule_key} IS NOT NULL`))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      ruleKey: r.rule_key ?? r.id,
      name: r.name ?? "",
      scope: r.scope,
      payerId: r.payer_id,
      severity: r.severity ?? "warn",
      field: r.field ?? "",
      weight: r.weight,
      version: r.version,
      messageEn: r.message_en ?? "",
      messageAr: r.message_ar ?? "",
      rationale: r.rationale,
      conditions: r.condition,
      authoredBy: r.authored_by,
      status: r.status,
      model: r.model,
      createdBy: r.created_by,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    };
  });
}

export interface PayerOption {
  id: string;
  name: string;
}

/** The tenant's payers for the authoring scope picker (id + display name). */
export function getTenantPayers(tenantId: string): Promise<PayerOption[]> {
  return withSession(tenantId, async (db) => {
    const rows = await db
      .select({ id: schema.payers.id, name: schema.payers.name })
      .from(schema.payers)
      .orderBy(schema.payers.name);
    return rows.map((r) => ({ id: r.id, name: r.name }));
  });
}

/** Map an authored-rule row back to an executable ScrubRule (for re-gating). */
export function authoredRowToScrubRule(row: AuthoredRuleRow): ScrubRule {
  return {
    id: row.ruleKey,
    name: row.name,
    scope: row.scope as ScrubRule["scope"],
    version: row.version,
    severity: row.severity as Severity,
    weight: row.weight,
    field: row.field,
    message_en: row.messageEn,
    message_ar: row.messageAr,
    conditions: row.conditions,
    payerId: row.payerId,
    tenantId: null,
  };
}
