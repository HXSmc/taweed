// EXECUTE B6 — header field-mapping with confidence (design-brief §8.1). Pure so
// the UI can show detected column -> model field suggestions the human confirms or
// overrides. No fuzzy ML; a transparent synonym + token-overlap score the RCM
// manager can reason about.

export const CANONICAL_FIELDS = [
  "claimId",
  "nphiesClaimId",
  "payerName",
  "branchName",
  "providerName",
  "patientRef",
  "sbsCode",
  "icd10amCode",
  "serviceDate",
  "totalAmount",
  "deniedAmount",
  "reasonCode",
  "reasonText",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export interface MappingSuggestion {
  field: CanonicalField;
  sourceColumn: string | null;
  confidence: number; // 0..1
}

export type FieldMapping = Record<CanonicalField, string | null>;

// Synonyms per field, as normalized token strings. Order does not matter; a
// header matches by exact-normalized (1.0), all-tokens-present (0.85), or partial
// token overlap (proportional, min 0.4 to count).
const SYNONYMS: Record<CanonicalField, string[]> = {
  claimId: ["claim id", "claim number", "claim no", "claim ref", "claim"],
  nphiesClaimId: ["nphies claim id", "nphies id", "nphies reference"],
  payerName: ["payer name", "payer", "insurer", "insurance company", "tpa"],
  branchName: ["branch name", "branch", "location", "clinic", "facility"],
  providerName: ["provider name", "provider", "practitioner", "physician", "doctor"],
  patientRef: ["member id", "patient id", "patient", "member", "beneficiary id"],
  sbsCode: ["sbs code", "sbs", "procedure code", "service code", "cpt"],
  icd10amCode: ["icd10am code", "icd 10 am", "diagnosis code", "icd code", "diagnosis"],
  serviceDate: ["service date", "date of service", "claim date", "submitted", "dos"],
  totalAmount: ["total amount", "amount", "billed amount", "claim amount", "net"],
  deniedAmount: ["denied amount", "rejected amount", "denial amount", "disallowed"],
  reasonCode: ["denial reason", "rejection reason", "reason code", "carc", "reason"],
  reasonText: ["reason text", "reason description", "denial description", "remark"],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\-./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

/** Confidence that `header` matches `synonym` (0..1). */
function scorePair(header: string, synonym: string): number {
  const h = normalize(header);
  const s = normalize(synonym);
  if (h === s) return 1;
  const ht = new Set(tokens(h));
  const st = tokens(s);
  if (st.length === 0) return 0;
  const present = st.filter((t) => ht.has(t)).length;
  if (present === st.length) return 0.85; // all synonym tokens present
  const overlap = present / st.length;
  return overlap >= 0.5 ? 0.4 + overlap * 0.3 : 0;
}

/** Best confidence of `header` against any synonym of `field`. */
function scoreField(header: string, field: CanonicalField): number {
  return Math.max(0, ...SYNONYMS[field].map((syn) => scorePair(header, syn)));
}

/**
 * Detect the best source column for every canonical field. Resolves greedily by
 * descending confidence so a column is claimed by only one field, and a field
 * never maps to a column already taken by a stronger match.
 */
export function detectFieldMapping(headers: string[]): MappingSuggestion[] {
  // Score every (field, header) pair.
  const scored: { field: CanonicalField; header: string; score: number }[] = [];
  for (const field of CANONICAL_FIELDS) {
    for (const header of headers) {
      const score = scoreField(header, field);
      if (score > 0) scored.push({ field, header, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const takenColumns = new Set<string>();
  const assigned = new Map<CanonicalField, MappingSuggestion>();
  for (const cand of scored) {
    if (assigned.has(cand.field)) continue;
    if (takenColumns.has(cand.header)) continue;
    assigned.set(cand.field, {
      field: cand.field,
      sourceColumn: cand.header,
      confidence: Math.round(cand.score * 100) / 100,
    });
    takenColumns.add(cand.header);
  }
  return CANONICAL_FIELDS.map(
    (field) =>
      assigned.get(field) ?? { field, sourceColumn: null, confidence: 0 },
  );
}

/**
 * Apply manual overrides ({ field: column }). An override forces confidence 1 and
 * removes that column from any other field, so a human correction is definitive.
 */
export function applyMappingOverrides(
  suggestions: MappingSuggestion[],
  overrides: Partial<Record<CanonicalField, string>>,
): MappingSuggestion[] {
  const overriddenColumns = new Set(Object.values(overrides));
  return suggestions.map((s) => {
    const override = overrides[s.field];
    if (override !== undefined) {
      return { field: s.field, sourceColumn: override, confidence: 1 };
    }
    // Clear a field that pointed at a now-manually-claimed column.
    if (s.sourceColumn !== null && overriddenColumns.has(s.sourceColumn)) {
      return { field: s.field, sourceColumn: null, confidence: 0 };
    }
    return s;
  });
}
