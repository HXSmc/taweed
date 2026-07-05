// EXECUTE B6 — per-tenant dimension resolution (NEXT_STEP §B item 6). Create the
// partner's branches/providers/payers/patients from THEIR data, not round-robin
// onto seeded rows. Pure find-or-create by normalized name; the DB write is done
// by the caller inside withTenant.

export interface ExistingDimension {
  id: string;
  name: string;
}

export interface DimensionMatch {
  /** Matched existing row id, or null when it must be created / is empty. */
  id: string | null;
  /** True when a new row should be created for this name. */
  create: boolean;
  /** The (trimmed) name to create, or "" for an unusable input. */
  name: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Resolve one incoming name against existing dimension rows. An empty/whitespace
 * name is unusable (never a silent match and never a create); a known name
 * matches; anything else is flagged for creation.
 */
export function resolveDimension(
  existing: ExistingDimension[],
  rawName: string,
): DimensionMatch {
  const trimmed = rawName.trim();
  if (trimmed.length === 0) return { id: null, create: false, name: "" };
  const key = norm(trimmed);
  const hit = existing.find((e) => norm(e.name) === key);
  if (hit) return { id: hit.id, create: false, name: trimmed };
  return { id: null, create: true, name: trimmed };
}

/**
 * Resolve a batch of names, deduping distinct spellings of the same name so it is
 * created only once. Returns one match per unique normalized name (input order).
 */
export function resolveDimensions(
  existing: ExistingDimension[],
  rawNames: string[],
): DimensionMatch[] {
  const seen = new Set<string>();
  const out: DimensionMatch[] = [];
  for (const raw of rawNames) {
    const match = resolveDimension(existing, raw);
    if (match.name === "") continue; // skip unusable
    const key = norm(match.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(match);
  }
  return out;
}
