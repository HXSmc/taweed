import { randomUUID } from "node:crypto";

/**
 * Single seam for id generation so ids stay swappable/mockable across the
 * pipeline (normalizer output, db seeds). Returns a v4 UUID.
 */
export function newId(): string {
  return randomUUID();
}
