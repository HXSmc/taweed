import "server-only";
import { sql } from "drizzle-orm";
import { denialLabel, isDenialReasonCode } from "@taweed/shared";
import {
  generateAppeal,
  appealToPdfModel,
  type AppealContext,
  type AppealDraft,
  type PdfDoc,
} from "@taweed/appeals";
import { withSession } from "./db";

export interface AppealableRow {
  denialId: string;
  claimId: string;
  nphiesClaimId: string | null;
  payerName: string;
  reasonCode: string;
  reasonLabel: string;
  category: string | null;
  deniedSar: string;
  sbsCode: string | null;
  deadlineDays: number;
}

// Deterministic per-denial deadline countdown for the demo (design-brief §8.4
// shows a payer-specific appeal-deadline countdown). TODO(nphies-creds): real
// payer deadlines come from the payer matrix.
function deadlineDays(denialId: string): number {
  let x = 0;
  for (let i = 0; i < denialId.length; i++) x = (x * 31 + denialId.charCodeAt(i)) >>> 0;
  return 3 + (x % 28);
}

type DenialJoinRow = {
  denial_id: string;
  claim_id: string;
  nphies_claim_id: string | null;
  payer_name: string;
  provider_name: string;
  member_id: string;
  reason_code: string;
  category: string | null;
  denied_amount: string;
  sbs_code: string | null;
  service_date: string | null;
}

const DENIAL_JOIN = sql`
  FROM denials d
  JOIN claim_lines cl ON cl.id = d.claim_line_id
  JOIN claims c ON c.id = cl.claim_id
  JOIN payers p ON p.id = c.payer_id
  JOIN providers pr ON pr.id = c.provider_id
  JOIN patients pat ON pat.id = c.patient_id`;

export function getAppealables(tenantId: string, limit = 100): Promise<AppealableRow[]> {
  return withSession(tenantId, async (db) => {
    // Appealable = denials with no won appeal yet, highest SAR first.
    const res = await db.execute<DenialJoinRow>(sql`
      SELECT d.id AS denial_id, c.id AS claim_id, c.nphies_claim_id,
             p.name AS payer_name, pr.name AS provider_name, pat.pseudonym AS member_id,
             d.reason_code, d.category, d.denied_amount, cl.sbs_code,
             c.submitted_at AS service_date
      ${DENIAL_JOIN}
      WHERE NOT EXISTS (
        SELECT 1 FROM appeals a WHERE a.denial_id = d.id AND a.status = 'won'
      )
      ORDER BY d.denied_amount DESC
      LIMIT ${limit}`);
    return res.rows.map((r) => ({
      denialId: r.denial_id,
      claimId: r.claim_id,
      nphiesClaimId: r.nphies_claim_id,
      payerName: r.payer_name,
      reasonCode: r.reason_code,
      reasonLabel: isDenialReasonCode(r.reason_code)
        ? denialLabel(r.reason_code)
        : r.reason_code,
      category: r.category,
      deniedSar: r.denied_amount,
      sbsCode: r.sbs_code,
      deadlineDays: deadlineDays(r.denial_id),
    }));
  });
}

export interface AppealResult {
  context: AppealContext;
  draft: AppealDraft;
  pdfEn: PdfDoc;
  pdfAr: PdfDoc;
  reasonLabel: string;
  deniedSar: string;
}

export function getAppealDraft(
  tenantId: string,
  denialId: string,
): Promise<AppealResult | null> {
  return withSession(tenantId, async (db) => {
    const res = await db.execute<DenialJoinRow>(sql`
      SELECT d.id AS denial_id, c.id AS claim_id, c.nphies_claim_id,
             p.name AS payer_name, pr.name AS provider_name, pat.pseudonym AS member_id,
             d.reason_code, d.category, d.denied_amount, cl.sbs_code,
             c.submitted_at AS service_date
      ${DENIAL_JOIN}
      WHERE d.id = ${denialId}
      LIMIT 1`);
    const r = res.rows[0];
    if (!r) return null;
    const context: AppealContext = {
      claimId: r.claim_id,
      nphiesClaimId: r.nphies_claim_id,
      sbsCode: r.sbs_code,
      denialCode: r.reason_code,
      denialCategory: r.category ?? r.reason_code,
      payerName: r.payer_name,
      providerName: r.provider_name,
      memberId: r.member_id,
      atRiskSar: r.denied_amount,
      serviceDate: r.service_date ?? "",
    };
    const draft = generateAppeal(context);
    return {
      context,
      draft,
      pdfEn: appealToPdfModel(draft, context, "en"),
      pdfAr: appealToPdfModel(draft, context, "ar"),
      reasonLabel: isDenialReasonCode(r.reason_code)
        ? denialLabel(r.reason_code)
        : r.reason_code,
      deniedSar: r.denied_amount,
    };
  });
}
