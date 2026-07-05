// @taweed/ingest — real-data remittance intake (EXECUTE B6). CSV/TSV parsing,
// header field-mapping with confidence, and per-tenant dimension resolution.
// XLSX + PDF-EOB OCR are typed adapter stubs (swap in a parser at DEPLOY).
export { parseDelimited, type DelimitedTable } from "./csv.js";
export {
  detectFieldMapping,
  applyMappingOverrides,
  CANONICAL_FIELDS,
  type CanonicalField,
  type FieldMapping,
  type MappingSuggestion,
} from "./mapping.js";
export {
  resolveDimension,
  resolveDimensions,
  type DimensionMatch,
  type ExistingDimension,
} from "./dimensions.js";
export {
  parseXlsx,
  type XlsxAdapter,
} from "./xlsx.js";
export { ocrEob, type OcrAdapter } from "./pdf-ocr.js";
