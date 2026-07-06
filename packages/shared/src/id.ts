/**
 * Single seam for id generation so ids stay swappable/mockable across the
 * pipeline (normalizer output, db seeds). Returns a v4 UUID.
 *
 * Uses the Web Crypto global (`globalThis.crypto`, stable in Node 19+ and every
 * browser) instead of `node:crypto` so `@taweed/shared` stays isomorphic: this
 * barrel is re-exported into client bundles (e.g. the appeals composer imports
 * `levenshtein`), and a `node:` builtin in the graph fails the browser build.
 */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}
