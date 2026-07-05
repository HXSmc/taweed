import { describe, it, expect } from "vitest";
import { resolveDimension, resolveDimensions } from "@taweed/ingest";

// EXECUTE B6 — per-tenant dimension resolution (NEXT_STEP §B item 6): create the
// partner's branches/providers/payers/patients from THEIR data, not round-robin
// onto seeded rows. Pure find-or-create against the existing rows.

const EXISTING = [
  { id: "b1", name: "Riyadh, Olaya" },
  { id: "b2", name: "Jeddah, Al Rawdah" },
];

describe("resolveDimension", () => {
  it("matches an existing dimension by normalized name (case/space insensitive)", () => {
    const r = resolveDimension(EXISTING, "  riyadh,  OLAYA ");
    expect(r.id).toBe("b1");
    expect(r.create).toBe(false);
  });

  it("signals create for a name that is not present", () => {
    const r = resolveDimension(EXISTING, "Dammam, Al Faisaliyah");
    expect(r.id).toBeNull();
    expect(r.create).toBe(true);
    expect(r.name).toBe("Dammam, Al Faisaliyah");
  });

  it("treats an empty/whitespace name as unresolvable, never a silent match", () => {
    const r = resolveDimension(EXISTING, "   ");
    expect(r.id).toBeNull();
    expect(r.create).toBe(false);
    expect(r.name).toBe("");
  });
});

describe("resolveDimensions", () => {
  it("dedupes distinct spellings of the same name to one create", () => {
    const res = resolveDimensions(EXISTING, ["Dammam Center", "dammam center", "Riyadh, Olaya"]);
    const toCreate = res.filter((r) => r.create);
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0]!.name).toBe("Dammam Center");
  });
});
