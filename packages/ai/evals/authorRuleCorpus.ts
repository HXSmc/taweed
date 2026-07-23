// AI-3 authorRule eval corpus — hand-authored (SME sentence, scope, expected
// structural draft) fixtures spanning AUTHORABLE_FACT_KEYS/SCRUB_OPERATORS
// (@taweed/rules-engine registry) and all 3 severities. Mixed EN/AR sentences,
// matching real SME usage (authorRule.ts accepts either). `expected` feeds
// authorRuleScoring.ts's structural comparison — weightRange and leaves are
// deliberately loose (a real SME sentence rarely pins an exact weight; the
// severity/field/leaf-predicate shape is the meaningfully comparable part).

import type { AuthorRuleFixture } from "./authorRuleScoring.js";

export const AUTHOR_RULE_CORPUS: AuthorRuleFixture[] = [
  {
    id: "preauth-highcost",
    smeText: "Flag any claim over 1000 SAR that has no prior authorization on file.",
    scope: { scope: "global" },
    expected: {
      severity: "high",
      field: "hasPreAuth",
      weightRange: [20, 60],
      leaves: [
        { fact: "hasPreAuth", operator: "equal", value: false },
        { fact: "totalAmount", operator: "greaterThan" },
      ],
    },
  },
  {
    id: "policy-inactive",
    smeText:
      "حذّر عندما لا تكون بوليصة المريض سارية في تاريخ تقديم الخدمة.",
    scope: { scope: "global" },
    expected: {
      severity: "warn",
      field: "policyActive",
      weightRange: [10, 40],
      leaves: [{ fact: "policyActive", operator: "equal", value: false }],
    },
  },
  {
    id: "duplicate-claim",
    smeText: "Flag claims that look like a duplicate submission.",
    scope: { scope: "global" },
    expected: {
      severity: "warn",
      field: "isDuplicate",
      weightRange: [10, 40],
      leaves: [{ fact: "isDuplicate", operator: "equal", value: true }],
    },
  },
  {
    id: "missing-diagnosis",
    smeText:
      "ضع علامة عالية الخطورة عندما تفتقر المطالبة إلى رمز تشخيص داعم.",
    scope: { scope: "global" },
    expected: {
      severity: "high",
      field: "hasDiagnosis",
      weightRange: [20, 60],
      leaves: [{ fact: "hasDiagnosis", operator: "equal", value: false }],
    },
  },
  {
    id: "missing-documentation",
    smeText: "Flag when required documentation is not attached.",
    scope: { scope: "global" },
    expected: {
      severity: "warn",
      field: "hasDocumentation",
      weightRange: [10, 50],
      leaves: [{ fact: "hasDocumentation", operator: "equal", value: false }],
    },
  },
  {
    id: "pediatric-adult-only-procedure",
    smeText:
      "ضع علامة على المطالبات لمرضى تقل أعمارهم عن 18 عامًا عند إجراء الرمز SBS-0004 المخصص للبالغين فقط.",
    scope: { scope: "global" },
    expected: {
      severity: "high",
      field: "patientAgeYears",
      weightRange: [20, 60],
      leaves: [
        { fact: "patientAgeYears", operator: "lessThan", value: 18 },
        { fact: "sbsCodes", operator: "contains", value: "SBS-0004" },
      ],
    },
  },
  {
    id: "many-service-lines",
    smeText: "Advisory flag when a claim has more than 8 service lines.",
    scope: { scope: "global" },
    expected: {
      severity: "info",
      field: "sbsCount",
      weightRange: [1, 25],
      leaves: [{ fact: "sbsCount", operator: "greaterThan", value: 8 }],
    },
  },
  {
    id: "line-quantity-cap",
    smeText: "Flag when any single line's quantity exceeds 10 units.",
    scope: { scope: "global" },
    expected: {
      severity: "warn",
      field: "maxLineUnits",
      weightRange: [10, 45],
      leaves: [{ fact: "maxLineUnits", operator: "greaterThan", value: 10 }],
    },
  },
  {
    id: "payer-excluded-service",
    smeText:
      "ضع علامة على مطالبات الدافع PAYER-NARROW-NET التي تتضمن الرمز SBS-0006 المستبعد من قبل ذلك الدافع.",
    scope: { scope: "payer", payerId: "PAYER-NARROW-NET" },
    expected: {
      severity: "high",
      field: "sbsCodes",
      weightRange: [20, 60],
      leaves: [
        { fact: "payerId", operator: "equal", value: "PAYER-NARROW-NET" },
        { fact: "sbsCodes", operator: "contains", value: "SBS-0006" },
      ],
    },
  },
  {
    id: "gender-mismatch-procedure",
    smeText:
      "Flag claims where the patient's gender does not match the required gender for procedure SBS-0003 (female-only).",
    scope: { scope: "global" },
    expected: {
      severity: "high",
      field: "patientGender",
      weightRange: [20, 60],
      leaves: [
        { fact: "patientGender", operator: "notEqual", value: "female" },
        { fact: "sbsCodes", operator: "contains", value: "SBS-0003" },
      ],
    },
  },
  {
    id: "non-covered-service",
    smeText: "Flag any claim where the non-covered service code SBS-9999 appears.",
    scope: { scope: "global" },
    expected: {
      severity: "high",
      field: "sbsCodes",
      weightRange: [20, 60],
      leaves: [{ fact: "sbsCodes", operator: "contains", value: "SBS-9999" }],
    },
  },
  {
    id: "missing-companion-code",
    smeText:
      "ضع علامة على المطالبات التي لا تتضمن الرمز المرافق المطلوب SBS-0002.",
    scope: { scope: "global" },
    expected: {
      severity: "warn",
      field: "sbsCodes",
      weightRange: [10, 45],
      leaves: [{ fact: "sbsCodes", operator: "doesNotContain", value: "SBS-0002" }],
    },
  },
  {
    id: "high-total-amount",
    smeText: "Flag claims where the total amount is 5000 SAR or more.",
    scope: { scope: "global" },
    expected: {
      severity: "warn",
      field: "totalAmount",
      weightRange: [10, 45],
      leaves: [{ fact: "totalAmount", operator: "greaterThanInclusive", value: 5000 }],
    },
  },
];
