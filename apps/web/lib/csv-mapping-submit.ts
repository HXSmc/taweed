import type { CanonicalField, MappingSuggestion } from "@taweed/ingest";
import { previewCsvMapping, commitCsvMapping } from "@/lib/actions/ingest-csv";
import type { IngestResult } from "@/lib/actions/ingest";

// EXECUTE B6 — preview/commit call-and-state-transition logic for the CSV
// field-mapping panel, extracted out of ingest-panel.tsx (mirrors ingest-
// submit.ts's resolveUploadState shape). A rejected server-action promise
// (size-limit connection reset, transient network failure) must still
// resolve to a displayable state, never reject and strand the caller.

export type CsvMappingState =
  | {
      kind: "preview";
      file: File;
      headers: string[];
      suggestions: MappingSuggestion[];
      rowCount: number;
    }
  | { kind: "previewFailed"; error: string }
  | { kind: "committed"; result: IngestResult };

export async function resolveCsvPreview(
  file: File,
  formData: FormData,
): Promise<CsvMappingState> {
  try {
    const res = await previewCsvMapping(formData);
    if (res.ok) {
      return {
        kind: "preview",
        file,
        headers: res.headers,
        suggestions: res.suggestions,
        rowCount: res.rowCount,
      };
    }
    return { kind: "previewFailed", error: res.error ?? "could not read file" };
  } catch {
    return {
      kind: "previewFailed",
      error: "upload failed — check your connection and try again",
    };
  }
}

export async function resolveCsvCommit(
  file: File,
  overrides: Partial<Record<CanonicalField, string | null>>,
): Promise<CsvMappingState> {
  const fd = new FormData();
  fd.set("file", file);
  try {
    const result = await commitCsvMapping(fd, overrides);
    return { kind: "committed", result };
  } catch {
    return {
      kind: "committed",
      result: {
        ok: false,
        fileName: file.name,
        claims: 0,
        denials: 0,
        atRiskSar: "0",
        quarantined: [],
        error: "upload failed — check your connection and try again",
      },
    };
  }
}
