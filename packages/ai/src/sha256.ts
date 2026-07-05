import { createHash } from "node:crypto";

/**
 * Hex SHA-256 of a UTF-8 string. Used to record prompt/output digests in the
 * llm_calls audit trail WITHOUT ever storing the raw text (plan 04 §3.3, §5:
 * hashes only, never raw prompt/output, never PHI). Pure + deterministic.
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
