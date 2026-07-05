import type { TopLevelCondition } from "json-rules-engine";
import type { ScrubRule } from "./types.js";

// The scrubber rule set as DATA (build-plan §3 rules-as-data, §7). Conditions are
// json-rules-engine objects — NO eval. Each rule names the field that failed and
// carries EN + AR operator messages so a flag is always explainable.
//
// TODO(nphies-creds): every SBS code, payer id, threshold and denial mapping
// below is a PLACEHOLDER for pipeline de-risking. Real SBS/NPHIES taxonomy,
// payer pre-auth matrices and clinical age/gender edits are creds + KSA-RCM-SME
// gated (build-plan §8 CREATE exit gate, §12.3 gap #1). Do not treat as clinical truth.

// Placeholder tuning knobs — SME-gated.
const PREAUTH_AMOUNT_THRESHOLD = 1000; // high-value claim needs pre-auth
const PREAUTH_STRICT_PAYER = "PAYER-PREAUTH-STRICT";
const PREAUTH_ALL_PAYER = "PAYER-ALL-PREAUTH";
const PREAUTH_SBS = "SBS-0002"; // procedure whose units drive payer pre-auth
const PREAUTH_SBS_UNIT_THRESHOLD = 5; // "over N units"
const FEMALE_ONLY_SBS = "SBS-0003";
const ADULT_ONLY_SBS = "SBS-0004";
const ADULT_MIN_AGE = 18;
const BUNDLE_A_PRIMARY = "SBS-0007";
const BUNDLE_A_SECONDARY = "SBS-0008";
const BUNDLE_B_PRIMARY = "SBS-0005";
const BUNDLE_B_SECONDARY = "SBS-0009";
const UNIT_CAP = 10; // any line above this exceeds the allowed maximum
const NON_COVERED_SBS = "SBS-9999";
const PAYER_NARROW_NET = "PAYER-NARROW-NET";
const PAYER_EXCLUDED_SBS = "SBS-0006";
const HIGH_LINE_COUNT = 8; // more service lines than this is unusual

// `maxLineUnits` and `sbsCount` are DERIVED facts injected by scrub(); rules may
// reference them directly. `lineUnitsFor` is a params-driven dynamic fact.

export const SCRUBBER_RULES: ScrubRule[] = [
  {
    id: "R-D02-preauth-highcost",
    name: "Missing pre-authorization on high-value claim",
    scope: "global",
    version: 1,
    severity: "high",
    weight: 45,
    field: "hasPreAuth",
    message_en: "High-value claim submitted without prior authorization.",
    message_ar: "تم تقديم مطالبة عالية القيمة دون الحصول على موافقة مسبقة.",
    conditions: {
      all: [
        { fact: "hasPreAuth", operator: "equal", value: false },
        {
          fact: "totalAmount",
          operator: "greaterThanInclusive",
          value: PREAUTH_AMOUNT_THRESHOLD,
        },
      ],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D02-preauth-payer-units",
    name: "Payer requires pre-authorization above unit threshold",
    scope: "payer",
    payerId: PREAUTH_STRICT_PAYER,
    version: 1,
    severity: "high",
    weight: 50,
    field: "hasPreAuth",
    message_en:
      "Payer requires prior authorization for this procedure above the allowed unit threshold.",
    message_ar:
      "تشترط جهة التأمين الحصول على موافقة مسبقة لهذا الإجراء عند تجاوز الحد المسموح به من الوحدات.",
    conditions: {
      all: [
        { fact: "payerId", operator: "equal", value: PREAUTH_STRICT_PAYER },
        { fact: "sbsCodes", operator: "contains", value: PREAUTH_SBS },
        {
          fact: "lineUnitsFor",
          params: { code: PREAUTH_SBS },
          operator: "greaterThan",
          value: PREAUTH_SBS_UNIT_THRESHOLD,
        },
        { fact: "hasPreAuth", operator: "equal", value: false },
      ],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D02-preauth-payer-all",
    name: "Payer requires pre-authorization for all procedures",
    scope: "payer",
    payerId: PREAUTH_ALL_PAYER,
    version: 1,
    severity: "high",
    weight: 45,
    field: "hasPreAuth",
    message_en:
      "Payer requires prior authorization for all procedures; none is present.",
    message_ar:
      "تشترط جهة التأمين موافقة مسبقة لجميع الإجراءات، ولا توجد أي موافقة.",
    conditions: {
      all: [
        { fact: "payerId", operator: "equal", value: PREAUTH_ALL_PAYER },
        { fact: "hasPreAuth", operator: "equal", value: false },
      ],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D03-gender-procedure",
    name: "Procedure inconsistent with patient gender",
    scope: "global",
    version: 1,
    severity: "high",
    weight: 45,
    field: "patientGender",
    message_en: "Procedure is inconsistent with the patient's recorded gender.",
    message_ar: "الإجراء غير متوافق مع جنس المريض المسجل.",
    // Female-only procedure billed for a male patient — the unambiguous case.
    // "unknown"/"other" are left evaluable-but-unflagged to avoid false positives.
    conditions: {
      all: [
        { fact: "sbsCodes", operator: "contains", value: FEMALE_ONLY_SBS },
        { fact: "patientGender", operator: "equal", value: "male" },
      ],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D03-age-procedure",
    name: "Procedure restricted to adult patients",
    scope: "global",
    version: 1,
    severity: "high",
    weight: 45,
    field: "patientAgeYears",
    message_en: "Procedure is restricted to adult patients.",
    message_ar: "هذا الإجراء مقتصر على المرضى البالغين.",
    // References patientAgeYears — when age is null this rule goes UNEVALUABLE
    // (we cannot rule out a pediatric edit), never a silent pass.
    conditions: {
      all: [
        { fact: "sbsCodes", operator: "contains", value: ADULT_ONLY_SBS },
        { fact: "patientAgeYears", operator: "lessThan", value: ADULT_MIN_AGE },
      ],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D04-eligibility-gap",
    name: "Patient policy inactive on service date",
    scope: "global",
    version: 1,
    severity: "high",
    weight: 50,
    field: "policyActive",
    message_en: "Patient's policy is not active on the service date.",
    message_ar: "وثيقة تأمين المريض غير سارية في تاريخ تقديم الخدمة.",
    conditions: {
      all: [{ fact: "policyActive", operator: "equal", value: false }],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D05-duplicate-risk",
    name: "Potential duplicate claim or service",
    scope: "global",
    version: 1,
    severity: "warn",
    weight: 30,
    field: "isDuplicate",
    message_en: "Claim appears to duplicate a previously submitted service.",
    message_ar: "يبدو أن المطالبة مكررة لخدمة سبق تقديمها.",
    conditions: {
      all: [{ fact: "isDuplicate", operator: "equal", value: true }],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D07-bundling-pair",
    name: "Procedures should be bundled into one line",
    scope: "global",
    version: 1,
    severity: "warn",
    weight: 25,
    field: "sbsCodes",
    message_en:
      "Two procedures billed separately should be bundled into one line.",
    message_ar: "إجراءان تمت فوترتهما بشكل منفصل ويجب دمجهما في بند واحد.",
    conditions: {
      all: [
        { fact: "sbsCodes", operator: "contains", value: BUNDLE_A_PRIMARY },
        { fact: "sbsCodes", operator: "contains", value: BUNDLE_A_SECONDARY },
      ],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D07-bundling-pair-2",
    name: "Related procedures should be combined into one bundled line",
    scope: "global",
    version: 1,
    severity: "warn",
    weight: 25,
    field: "sbsCodes",
    message_en:
      "Related procedures should be combined into a single bundled line.",
    message_ar: "يجب دمج الإجراءات المرتبطة في بند واحد مجمّع.",
    conditions: {
      all: [
        { fact: "sbsCodes", operator: "contains", value: BUNDLE_B_PRIMARY },
        { fact: "sbsCodes", operator: "contains", value: BUNDLE_B_SECONDARY },
      ],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D08-qty-exceeds-cap",
    name: "Line quantity exceeds allowed maximum",
    scope: "global",
    version: 1,
    severity: "warn",
    weight: 30,
    field: "lineUnits",
    message_en: "Line quantity exceeds the allowed maximum.",
    message_ar: "الكمية في البند تتجاوز الحد الأقصى المسموح به.",
    conditions: {
      all: [{ fact: "maxLineUnits", operator: "greaterThan", value: UNIT_CAP }],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D03-missing-diagnosis",
    name: "Claim line missing a diagnosis code",
    scope: "global",
    version: 1,
    severity: "high",
    weight: 40,
    field: "hasDiagnosis",
    message_en: "Claim line is missing a supporting diagnosis code.",
    message_ar: "ينقص بند المطالبة رمز تشخيص داعم.",
    conditions: {
      all: [{ fact: "hasDiagnosis", operator: "equal", value: false }],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D01-service-not-covered",
    name: "Service not covered by plan",
    scope: "global",
    version: 1,
    severity: "high",
    weight: 45,
    field: "sbsCodes",
    message_en: "Service is not covered under the patient's plan.",
    message_ar: "الخدمة غير مغطاة ضمن وثيقة المريض.",
    conditions: {
      all: [{ fact: "sbsCodes", operator: "contains", value: NON_COVERED_SBS }],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D01-payer-excluded-service",
    name: "Service excluded under payer network",
    scope: "payer",
    payerId: PAYER_NARROW_NET,
    version: 1,
    severity: "warn",
    weight: 30,
    field: "sbsCodes",
    message_en: "Service is excluded under the payer's network.",
    message_ar: "الخدمة مستثناة ضمن شبكة جهة التأمين.",
    conditions: {
      all: [
        { fact: "payerId", operator: "equal", value: PAYER_NARROW_NET },
        { fact: "sbsCodes", operator: "contains", value: PAYER_EXCLUDED_SBS },
      ],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-D06-missing-docs",
    name: "Missing supporting documentation",
    scope: "global",
    version: 1,
    severity: "warn",
    weight: 25,
    field: "hasDocumentation",
    message_en: "Required supporting documentation is missing.",
    message_ar: "المستندات الداعمة المطلوبة غير مرفقة.",
    conditions: {
      all: [{ fact: "hasDocumentation", operator: "equal", value: false }],
    } satisfies TopLevelCondition,
  },
  {
    id: "R-INFO-line-count",
    name: "Unusually high number of service lines",
    scope: "global",
    version: 1,
    severity: "info",
    weight: 10,
    field: "sbsCodes",
    message_en:
      "Claim has an unusually high number of service lines; review for splitting.",
    message_ar:
      "تحتوي المطالبة على عدد كبير غير معتاد من بنود الخدمة؛ يُنصح بالمراجعة.",
    conditions: {
      all: [{ fact: "sbsCount", operator: "greaterThan", value: HIGH_LINE_COUNT }],
    } satisfies TopLevelCondition,
  },
];
