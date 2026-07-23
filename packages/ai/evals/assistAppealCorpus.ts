// AI-2 assistAppeal eval corpus — hand-authored AppealFacts + surrounding
// input fields spanning every real denial reason code (@taweed/shared
// DENIAL_REASON_CODES), varied SBS-code presence/absence, and varied amounts.
// No PHI: memberId here is a synthetic eval-only value, run through the same
// pseudonymization path assistAppeal() always applies to real member ids.

import { DENIAL_REASON_CODES } from "@taweed/shared";
import type { AppealFacts } from "../src/appeal-guardrails.js";
import type { AssistAppealInput } from "../src/features/assistAppeal.js";

export interface AssistAppealFixture {
  id: string;
  input: AssistAppealInput;
}

function facts(over: Partial<AppealFacts> & { claimRef: string }): AppealFacts {
  return {
    sbsCode: null,
    denialCode: "TWD-D01",
    atRiskSar: "1000.00",
    serviceDate: "2026-01-15",
    ...over,
  };
}

// One fixture per real denial code, alternating SBS-code presence and payer,
// with a spread of at-risk amounts (including a large one to stress the
// paragraph gate's "no invented numbers" check against a bigger figure).
export const ASSIST_APPEAL_CORPUS: AssistAppealFixture[] = DENIAL_REASON_CODES.map(
  (denial, i): AssistAppealFixture => {
    const claimRef = `CLM-EVAL-${1000 + i}`;
    const hasSbs = i % 2 === 0;
    const amounts = ["450.00", "1200.50", "3800.00", "95.00", "15000.00"];
    return {
      id: `${denial.code}-${i}`,
      input: {
        facts: facts({
          claimRef,
          denialCode: denial.code,
          sbsCode: hasSbs ? `SBS-000${(i % 9) + 1}` : null,
          atRiskSar: amounts[i % amounts.length]!,
          serviceDate: `2026-0${(i % 9) + 1}-1${i % 3}`,
        }),
        memberId: `eval-member-${1000 + i}`,
        payerName: i % 3 === 0 ? "Bupa Arabia" : i % 3 === 1 ? "Tawuniya" : "MedGulf",
        denialReasonLabel: denial.label,
      },
    };
  },
);
