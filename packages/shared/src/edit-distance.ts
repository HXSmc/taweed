// Levenshtein edit distance (AI-2 SME-edit quality metric, plan 04 §4.2). Used to
// measure how much a reviewer changed an AI-suggested paragraph before keeping it —
// the ongoing signal for whether the assist is worth the reviewer's time. Pure;
// O(min(a,b)) space, rolling two-row DP.

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Keep the shorter string as the inner (column) dimension to bound memory.
  const [s, t] = a.length <= b.length ? [a, b] : [b, a];
  let prev = new Array<number>(s.length + 1);
  let curr = new Array<number>(s.length + 1);
  for (let i = 0; i <= s.length; i++) prev[i] = i;
  for (let j = 1; j <= t.length; j++) {
    curr[0] = j;
    const tc = t.charCodeAt(j - 1);
    for (let i = 1; i <= s.length; i++) {
      const cost = s.charCodeAt(i - 1) === tc ? 0 : 1;
      curr[i] = Math.min(
        prev[i]! + 1, // deletion
        curr[i - 1]! + 1, // insertion
        prev[i - 1]! + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[s.length]!;
}
