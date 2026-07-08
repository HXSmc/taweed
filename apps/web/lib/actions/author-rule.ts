"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { newId } from "@taweed/shared";
import {
  SCRUBBER_RULES,
  validateAuthoredRule,
  type AuthoredRuleDraft,
  type AuthoredRuleScope,
  type ScrubRule,
} from "@taweed/rules-engine";
import { authorRule, isAiConfigError, isAiDisabledError } from "@taweed/ai";
import { logAudit } from "@taweed/audit";
import { authorizeAction } from "@/lib/authz";
import { appPool, withSession } from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import {
  authoredRowToScrubRule,
  getAuthoredRule,
  getTenantPayers,
  loadApprovedAuthoredRules,
  persistDraftRule,
  setRuleStatus,
} from "@/lib/rules-data";

// AI-3 rule authoring (plan 04 §2, §4.3). Server actions are public endpoints:
// RBAC is server-enforced, input is validated, the billable model call is
// throttled, and the draft only ever persists DISABLED after passing the
// deterministic gate. Only rcm ("rules") + owner/admin ("full") may author.
const AUTHOR_ROLES = ["full", "rules"] as const;

// Paid Opus call per authoring request — throttle per (tenant, actor).
const AUTHOR_RATE_LIMIT = 10;
const AUTHOR_WINDOW_MS = 60_000;

const DraftInput = z
  .object({
    smeText: z.string().trim().min(3).max(1000),
    scope: z.enum(["global", "payer"]),
    payerId: z.string().trim().min(1).max(200).optional(),
  })
  .refine((v) => v.scope !== "payer" || !!v.payerId, {
    message: "payerId is required for a payer-scoped rule",
  });

/** Readable draft for the approval UI (the model's proposal, pre-persist). */
export interface DraftView {
  name: string;
  severity: string;
  field: string;
  messageEn: string;
  messageAr: string;
  weight: number;
  rationale: string;
  conditions: unknown;
  scope: string;
  payerId: string | null;
}

export interface DraftRuleResult {
  ok: boolean;
  /** AI kill switch off — the UI shows the manual-authoring fallback. */
  disabled?: boolean;
  /** feature on but no provider configured — distinct from off (ops signal). */
  misconfigured?: boolean;
  /** the model's proposal, whether or not the gate passed. */
  draft?: DraftView;
  /** persisted draft row id (present only when the gate passed). */
  rowId?: string;
  /** which gate blocked (absent on success) + human-readable reasons. */
  gate?: {
    ok: boolean;
    stage?: "shape" | "dry-run" | "golden";
    errors?: string[];
  };
  error?: string;
}

function toDraftView(
  draft: AuthoredRuleDraft,
  scope: AuthoredRuleScope,
): DraftView {
  return {
    name: draft.name,
    severity: draft.severity,
    field: draft.field,
    messageEn: draft.message_en,
    messageAr: draft.message_ar,
    weight: draft.weight,
    rationale: draft.rationale ?? "",
    conditions: draft.conditions,
    scope: scope.scope,
    payerId: scope.payerId ?? null,
  };
}

/**
 * Draft a scrubber rule from an SME sentence, gate it, and persist it DISABLED on
 * success. A gate failure returns the model's proposal + the reasons so the SME
 * can refine — nothing un-gated is ever persisted. AI-off returns a manual-
 * authoring signal, not an error.
 */
export async function draftRuleAction(
  smeText: string,
  scope: "global" | "payer",
  payerId?: string,
): Promise<DraftRuleResult> {
  const session = await authorizeAction("settings", [...AUTHOR_ROLES]);
  if (!session) return { ok: false, error: "forbidden" };

  const parsed = DraftInput.safeParse({ smeText, scope, payerId });
  if (!parsed.success) return { ok: false, error: "invalid" };

  if (
    !(await allowRequest(
      `author:${session.tenantId}:${session.userId}`,
      AUTHOR_RATE_LIMIT,
      AUTHOR_WINDOW_MS,
    ))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const ruleScope: AuthoredRuleScope = {
    scope: parsed.data.scope,
    payerId: parsed.data.scope === "payer" ? (parsed.data.payerId ?? null) : null,
  };

  // Data-integrity gate: a payer-scoped rule must reference a payer that
  // actually belongs to this tenant, not an arbitrary client-supplied id
  // (payerId is otherwise accepted verbatim and would persist a rule scoped
  // to a nonexistent/wrong payer). Membership is checked against the
  // caller's own tenant via the same RLS-scoped lookup the UI picker uses.
  if (ruleScope.scope === "payer") {
    const tenantPayers = await getTenantPayers(session.tenantId);
    const isKnownPayer = tenantPayers.some((p) => p.id === ruleScope.payerId);
    if (!isKnownPayer) return { ok: false, error: "invalid" };
  }

  let generated;
  try {
    generated = await authorRule({
      actor: session.userId,
      tenantId: session.tenantId,
      pool: appPool(),
      input: { smeText: parsed.data.smeText, scope: ruleScope },
    });
  } catch (err) {
    if (isAiDisabledError(err)) return { ok: false, disabled: true };
    if (isAiConfigError(err)) return { ok: false, misconfigured: true };
    console.error("draftRuleAction generation failed", err);
    return { ok: false, error: "generation" };
  }

  const draft = generated.draft as AuthoredRuleDraft;

  // Base rule set for the golden gate: shipped rules + this tenant's already-
  // approved authored rules, so a new rule is checked against the live library.
  const baseRules: ScrubRule[] = [
    ...SCRUBBER_RULES,
    ...(await loadApprovedAuthoredRules(session.tenantId)),
  ];

  const ruleKey = `R-LLM-${newId().replace(/-/g, "").slice(0, 8)}`;
  const validation = await validateAuthoredRule(draft, ruleScope, {
    id: ruleKey,
    version: 1,
    baseRules,
  });

  const view = toDraftView(draft, ruleScope);
  if (!validation.ok) {
    return {
      ok: true,
      draft: view,
      gate: { ok: false, stage: validation.stage, errors: validation.errors },
    };
  }

  const rowId = await persistDraftRule(session.tenantId, {
    rule: validation.rule,
    rationale: draft.rationale ?? "",
    authoredBy: "llm",
    promptSha256: generated.promptSha256,
    model: generated.model,
    actor: session.email,
  });

  await withSession(session.tenantId, (db) =>
    logAudit(db, {
      actor: session.email,
      action: "write",
      entity: "rule_draft",
      entityId: rowId,
    }),
  );

  revalidatePath("/[locale]/(app)/settings", "page");
  return { ok: true, draft: view, rowId, gate: { ok: true } };
}

export interface ApproveRuleResult {
  ok: boolean;
  /** re-gate blocked approval (the base library changed since drafting). */
  gate?: { ok: boolean; stage?: string; errors?: string[] };
  error?: string;
}

/**
 * Approve a drafted rule so the scrubber loads it — after RE-RUNNING the gate
 * against the current library (a rule that was safe when drafted can regress if
 * another rule was approved since). Server-enforced RBAC; audited.
 */
export async function approveRuleAction(
  rowId: string,
): Promise<ApproveRuleResult> {
  const session = await authorizeAction("settings", [...AUTHOR_ROLES]);
  if (!session) return { ok: false, error: "forbidden" };
  if (typeof rowId !== "string" || rowId.length === 0) {
    return { ok: false, error: "invalid" };
  }

  if (
    !(await allowRequest(
      `author-approve:${session.tenantId}:${session.userId}`,
      AUTHOR_RATE_LIMIT,
      AUTHOR_WINDOW_MS,
    ))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const row = await getAuthoredRule(session.tenantId, rowId);
  if (!row || row.status !== "draft") return { ok: false, error: "not_draft" };

  // Re-gate: rebuild the ScrubRule from the stored row and validate it against the
  // CURRENT approved library (minus itself). A pass is required to approve.
  const rule = authoredRowToScrubRule(row);
  const approved = (await loadApprovedAuthoredRules(session.tenantId)).filter(
    (r) => r.id !== rule.id,
  );
  const draft: AuthoredRuleDraft = {
    name: rule.name,
    severity: rule.severity,
    field: rule.field,
    message_en: rule.message_en,
    message_ar: rule.message_ar,
    weight: rule.weight,
    conditions: rule.conditions as AuthoredRuleDraft["conditions"],
    rationale: row.rationale ?? undefined,
  };
  const validation = await validateAuthoredRule(
    draft,
    { scope: rule.scope, payerId: rule.payerId, tenantId: null },
    { id: rule.id, version: rule.version, baseRules: [...SCRUBBER_RULES, ...approved] },
  );
  if (!validation.ok) {
    return {
      ok: false,
      gate: { ok: false, stage: validation.stage, errors: validation.errors },
    };
  }

  const flipped = await setRuleStatus(session.tenantId, rowId, "approved");
  if (!flipped) return { ok: false, error: "not_draft" };

  await withSession(session.tenantId, (db) =>
    logAudit(db, {
      actor: session.email,
      action: "write",
      entity: "rule_approve",
      entityId: rowId,
    }),
  );
  revalidatePath("/[locale]/(app)", "layout");
  return { ok: true, gate: { ok: true } };
}

/** Reject a drafted rule (never executes). Server-enforced RBAC; audited. */
export async function rejectRuleAction(
  rowId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await authorizeAction("settings", [...AUTHOR_ROLES]);
  if (!session) return { ok: false, error: "forbidden" };
  if (typeof rowId !== "string" || rowId.length === 0) {
    return { ok: false, error: "invalid" };
  }

  if (
    !(await allowRequest(
      `author-reject:${session.tenantId}:${session.userId}`,
      AUTHOR_RATE_LIMIT,
      AUTHOR_WINDOW_MS,
    ))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const flipped = await setRuleStatus(session.tenantId, rowId, "rejected");
  if (!flipped) return { ok: false, error: "not_draft" };
  await withSession(session.tenantId, (db) =>
    logAudit(db, {
      actor: session.email,
      action: "write",
      entity: "rule_reject",
      entityId: rowId,
    }),
  );
  revalidatePath("/[locale]/(app)/settings", "page");
  return { ok: true };
}
