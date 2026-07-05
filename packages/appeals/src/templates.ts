import type { DocChecklistItem } from "./types.js";

// Deterministic templates — NO LLM. Arabic authored natively in formal MSA with
// proper honorifics (design-brief §8.4: AR-medical LLM reliability gap → keep
// human review). {placeholders} are merged in generate.ts; Latin ids/SBS codes
// appear verbatim and are LTR-isolated by the PDF model.
//
// TODO(nphies-creds): reason wording, doc checklists and payer conventions are
// PLACEHOLDER, pending real NPHIES CARC/RARC taxonomy + KSA-RCM-SME review
// (build-plan §8 CREATE exit gate).

export interface AppealTemplate {
  subject_en: string;
  body_en: string;
  subject_ar: string;
  body_ar: string;
  docChecklist: DocChecklistItem[];
}

// Shared letter frame — salutation + claim-reference intro + closing. Keeping it
// in one place keeps per-reason entries to just subject + one paragraph.
const SALUTATION_EN = "To the Claims Review Department at {payerName},";
const INTRO_EN =
  "We formally appeal the denial of claim {claimRef} for member {memberId} " +
  "(service date {serviceDate}, SBS {sbsCode}), submitted by {providerName} " +
  "to {payerName}. The amount at risk is SAR {atRiskSar}.";
const CLOSING_EN =
  "We respectfully request re-adjudication and approval of this claim. " +
  "Supporting documentation is attached per the checklist below.\n\n" +
  "Sincerely,\n{providerName} — Revenue Integrity Office";

const SALUTATION_AR = "إلى إدارة مراجعة المطالبات لدى {payerName} المحترمين،";
const INTRO_AR =
  "نتقدّم إليكم باعتراضٍ رسميٍّ على رفض المطالبة رقم {claimRef} الخاصة بالمشترك " +
  "{memberId} (تاريخ الخدمة {serviceDate}، رمز الخدمة {sbsCode})، والمقدَّمة من " +
  "{providerName} إلى {payerName}. وتبلغ قيمة المبلغ المعرَّض للخطر {atRiskSar} ريال سعودي.";
const CLOSING_AR =
  "لذا نأمل من سعادتكم إعادة النظر في المطالبة واعتمادها، وقد أرفقنا المستندات " +
  "المؤيِّدة وفق القائمة أدناه.\n\nوتفضّلوا بقبول فائق الاحترام والتقدير،\n" +
  "{providerName} — مكتب سلامة الإيرادات";

function letter(
  reasonEn: string,
  reasonAr: string,
): {
  body_en: string;
  body_ar: string;
} {
  return {
    body_en: `${SALUTATION_EN}\n\n${INTRO_EN}\n\n${reasonEn}\n\n${CLOSING_EN}`,
    body_ar: `${SALUTATION_AR}\n\n${INTRO_AR}\n\n${reasonAr}\n\n${CLOSING_AR}`,
  };
}

function doc(key: string, en: string, ar: string): DocChecklistItem {
  return { key, label_en: en, label_ar: ar };
}

const SUBJECT_EN = "Formal appeal — claim {claimRef} — {payerName}";
const SUBJECT_AR = "اعتراض رسمي على رفض المطالبة {claimRef} لدى {payerName}";

export const APPEAL_TEMPLATES: Readonly<Record<string, AppealTemplate>> = {
  // TWD-D01 Service not covered (CARC)
  "TWD-D01": {
    subject_en: SUBJECT_EN,
    subject_ar: SUBJECT_AR,
    ...letter(
      "The denied service is a covered benefit under the member's active policy on the service date. We enclose the benefit schedule and a letter of medical necessity confirming coverage.",
      "إن الخدمة المرفوضة مشمولة ضمن منافع وثيقة المشترك السارية في تاريخ الخدمة. وقد أرفقنا جدول المنافع وخطاب الضرورة الطبية الذي يؤكد التغطية.",
    ),
    docChecklist: [
      doc(
        "benefit-schedule",
        "Benefit schedule / policy coverage page",
        "جدول المنافع أو صفحة تغطية الوثيقة",
      ),
      doc(
        "medical-necessity",
        "Letter of medical necessity",
        "خطاب الضرورة الطبية",
      ),
      doc(
        "coverage-confirmation",
        "Coverage confirmation for the service date",
        "تأكيد التغطية في تاريخ الخدمة",
      ),
    ],
  },
  // TWD-D02 Prior authorization missing (CARC)
  "TWD-D02": {
    subject_en: SUBJECT_EN,
    subject_ar: SUBJECT_AR,
    ...letter(
      "A valid prior authorization applies to this service. We enclose the authorization reference and, where applicable, a retroactive-authorization request with clinical justification.",
      "تسري على هذه الخدمة موافقة مسبقة سارية. وقد أرفقنا الرقم المرجعي للموافقة، وعند الاقتضاء طلب موافقة بأثر رجعي مشفوعاً بالمبرِّر السريري.",
    ),
    docChecklist: [
      doc(
        "auth-reference",
        "Prior authorization reference number",
        "الرقم المرجعي للموافقة المسبقة",
      ),
      doc(
        "retro-auth-request",
        "Retroactive authorization request",
        "طلب موافقة بأثر رجعي",
      ),
      doc(
        "clinical-justification",
        "Clinical justification for the service",
        "المبرر السريري للخدمة",
      ),
    ],
  },
  // TWD-D03 Diagnosis / procedure mismatch (CARC)
  "TWD-D03": {
    subject_en: SUBJECT_EN,
    subject_ar: SUBJECT_AR,
    ...letter(
      "The recorded diagnosis fully supports the billed procedure. We enclose corrected coding and clinical notes establishing the link between the diagnosis and the service.",
      "يدعم التشخيص المُسجَّل الإجراء المُطالَب به دعماً كاملاً. وقد أرفقنا الترميز المصحَّح والملاحظات السريرية التي تُثبت الارتباط بين التشخيص والخدمة.",
    ),
    docChecklist: [
      doc(
        "corrected-coding",
        "Corrected diagnosis / procedure coding",
        "الترميز المصحَّح للتشخيص والإجراء",
      ),
      doc(
        "clinical-notes",
        "Clinical notes linking diagnosis to service",
        "الملاحظات السريرية الرابطة بين التشخيص والخدمة",
      ),
      doc(
        "physician-statement",
        "Treating physician statement",
        "إفادة الطبيب المُعالِج",
      ),
    ],
  },
  // TWD-D04 Patient not eligible on service date (CARC)
  "TWD-D04": {
    subject_en: SUBJECT_EN,
    subject_ar: SUBJECT_AR,
    ...letter(
      "The member was eligible on the service date. We enclose the eligibility verification and a copy of the insurance card confirming active enrollment.",
      "كان المشترك مؤهَّلاً في تاريخ الخدمة. وقد أرفقنا إثبات الأهلية وصورة من البطاقة التأمينية تؤكد سريان الاشتراك.",
    ),
    docChecklist: [
      doc(
        "eligibility-verification",
        "Eligibility verification for the service date",
        "إثبات الأهلية في تاريخ الخدمة",
      ),
      doc(
        "insurance-card",
        "Copy of the insurance card",
        "صورة من البطاقة التأمينية",
      ),
      doc(
        "enrollment-proof",
        "Active enrollment proof",
        "إثبات سريان الاشتراك",
      ),
    ],
  },
  // TWD-D05 Duplicate claim / service (CARC)
  "TWD-D05": {
    subject_en: SUBJECT_EN,
    subject_ar: SUBJECT_AR,
    ...letter(
      "This claim is not a duplicate; it represents a distinct, separately documented service. We enclose the original claim reference and notes evidencing the separate encounter.",
      "ليست هذه المطالبة مكرَّرة، بل تمثِّل خدمةً مستقلةً موثَّقةً على حِدة. وقد أرفقنا مرجع المطالبة الأصلية والملاحظات التي تُثبت استقلال الزيارة.",
    ),
    docChecklist: [
      doc(
        "original-claim-ref",
        "Original claim reference",
        "مرجع المطالبة الأصلية",
      ),
      doc(
        "distinct-service-note",
        "Note evidencing the distinct encounter",
        "ملاحظة تُثبت استقلال الزيارة",
      ),
      doc(
        "service-timestamps",
        "Service date / time records",
        "سجلات تاريخ ووقت تقديم الخدمة",
      ),
    ],
  },
  // TWD-D06 Missing supporting documentation (RARC)
  "TWD-D06": {
    subject_en: SUBJECT_EN,
    subject_ar: SUBJECT_AR,
    ...letter(
      "The requested supporting documentation is now enclosed in full, including the operative / clinical report and relevant results, to complete the record.",
      "أرفقنا كامل المستندات المؤيِّدة المطلوبة، بما في ذلك التقرير العملياتي أو السريري والنتائج ذات الصلة، لاستكمال الملف.",
    ),
    docChecklist: [
      doc(
        "operative-report",
        "Operative / clinical report",
        "التقرير العملياتي أو السريري",
      ),
      doc(
        "lab-imaging-results",
        "Relevant lab / imaging results",
        "نتائج المختبر أو الأشعة ذات الصلة",
      ),
      doc(
        "itemized-record",
        "Itemized medical record",
        "السجل الطبي المُفصَّل",
      ),
    ],
  },
  // TWD-D07 Procedure bundled into another line (RARC)
  "TWD-D07": {
    subject_en: SUBJECT_EN,
    subject_ar: SUBJECT_AR,
    ...letter(
      "The billed procedure is separately identifiable and should not be bundled. We enclose documentation and the appropriate modifier supporting distinct reporting.",
      "الإجراء المُطالَب به قابل للتمييز بشكلٍ مستقل ولا يجوز دمجه. وقد أرفقنا المستندات والمُعدِّل المناسب الذي يدعم إفراده في الترميز.",
    ),
    docChecklist: [
      doc(
        "unbundling-justification",
        "Unbundling justification",
        "مبرر فك الدمج",
      ),
      doc(
        "distinct-procedure-doc",
        "Documentation of the distinct procedure",
        "توثيق الإجراء المستقل",
      ),
      doc(
        "modifier-support",
        "Supporting modifier evidence",
        "دليل المُعدِّل المؤيِّد",
      ),
    ],
  },
  // TWD-D08 Quantity exceeds allowed limit (RARC)
  "TWD-D08": {
    subject_en: SUBJECT_EN,
    subject_ar: SUBJECT_AR,
    ...letter(
      "The billed quantity is medically necessary. We enclose the physician order and a justification of the dosage / frequency supporting the quantity provided.",
      "الكمية المُطالَب بها ضروريةٌ طبياً. وقد أرفقنا أمر الطبيب ومبرِّر الجرعة أو التكرار الذي يدعم الكمية المقدَّمة.",
    ),
    docChecklist: [
      doc(
        "physician-order",
        "Physician order for the quantity",
        "أمر الطبيب بالكمية",
      ),
      doc(
        "dosage-justification",
        "Dosage / frequency justification",
        "مبرر الجرعة أو التكرار",
      ),
      doc(
        "quantity-necessity",
        "Medical necessity for the quantity",
        "الضرورة الطبية للكمية",
      ),
    ],
  },
};

// Neutral fallback for unknown / not-yet-mapped codes (payerSpecific=false).
export const GENERIC_TEMPLATE: AppealTemplate = {
  subject_en: SUBJECT_EN,
  subject_ar: SUBJECT_AR,
  ...letter(
    "We appeal this denial and request re-adjudication based on the enclosed clinical and administrative documentation supporting the claim.",
    "نعترض على هذا الرفض ونطلب إعادة النظر في المطالبة استناداً إلى المستندات السريرية والإدارية المرفقة الداعمة للمطالبة.",
  ),
  docChecklist: [
    doc(
      "clinical-documentation",
      "Clinical documentation supporting the claim",
      "المستندات السريرية الداعمة للمطالبة",
    ),
    doc(
      "administrative-documentation",
      "Administrative / billing documentation",
      "المستندات الإدارية والفوترة",
    ),
  ],
};

// Optional payer-specific overrides: payerName → denialCode → template. When a
// match exists, generateAppeal marks the draft payerSpecific=true. This single
// PLACEHOLDER entry demonstrates the mechanism; real payer letter conventions
// are creds + KSA-RCM-SME gated. TODO(nphies-creds).
export const PAYER_TEMPLATE_OVERRIDES: Readonly<
  Record<string, Readonly<Record<string, AppealTemplate>>>
> = {
  Tawuniya: {
    "TWD-D02": {
      subject_en: SUBJECT_EN,
      subject_ar: SUBJECT_AR,
      ...letter(
        "Per Tawuniya pre-authorization policy, a valid authorization applies to this service. We enclose the authorization reference and, where applicable, a retroactive-authorization request with clinical justification.",
        "وفقاً لسياسة الموافقات المسبقة لدى التعاونية، تسري على هذه الخدمة موافقة سارية. وقد أرفقنا الرقم المرجعي للموافقة، وعند الاقتضاء طلب موافقة بأثر رجعي مشفوعاً بالمبرِّر السريري.",
      ),
      docChecklist: [
        doc(
          "auth-reference",
          "Prior authorization reference number",
          "الرقم المرجعي للموافقة المسبقة",
        ),
        doc(
          "retro-auth-request",
          "Retroactive authorization request",
          "طلب موافقة بأثر رجعي",
        ),
        doc(
          "clinical-justification",
          "Clinical justification for the service",
          "المبرر السريري للخدمة",
        ),
      ],
    },
  },
};
