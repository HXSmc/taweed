import { ingestBundle, type IngestResult } from "@/lib/actions/ingest";
import {
  extractEobPdfAction,
  type ExtractEobPdfResult,
} from "@/lib/actions/eob-extract";

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export type UploadState =
  | { kind: "json"; result: IngestResult }
  | { kind: "pdf"; result: ExtractEobPdfResult };

// A rejected server-action promise (e.g. the request body exceeds the
// server's size limit and the connection resets, or a transient network
// failure) must still resolve to a displayable UploadState — otherwise the
// caller's setState is skipped entirely and the run ledger is stuck on
// "parsing" forever with no error surfaced (see ingest-panel.test.ts).
export async function resolveUploadState(
  file: File,
  formData: FormData,
): Promise<UploadState> {
  if (isPdfFile(file)) {
    try {
      return { kind: "pdf", result: await extractEobPdfAction(formData) };
    } catch {
      return { kind: "pdf", result: { ok: false, error: "failed" } };
    }
  }
  try {
    return { kind: "json", result: await ingestBundle(formData) };
  } catch {
    return {
      kind: "json",
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
