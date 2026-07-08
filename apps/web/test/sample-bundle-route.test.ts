import { describe, it, expect } from "vitest";
import { generateBundle } from "@taweed/synthetic-fhir";

// Regression coverage for the audit finding: GET /api/sample-bundle has zero
// auth/authz check and zero rate limiting, unlike every other action in the
// ingest surface. Verified as intentional (design-brief §8.1/§9: a public,
// PHI-free sample download for the Ingest empty state) — generateBundle takes
// only a hardcoded scenario + seed, touches no DB, and reflects no
// client-supplied input (no query string, body, or tenant context).
//
// This test does NOT add auth: it pins the "stays public, stays synthetic"
// contract so that if a future edit wires in a query param (e.g. to pick a
// tenant's real claim), the output stops byte-matching the fixed synthetic
// bundle and this test fails — giving the missing auth boundary a tripwire.
import { GET } from "../app/api/sample-bundle/route";

describe("GET /api/sample-bundle — public synthetic sample contract", () => {
  it("returns 200 with no session, auth, or tenant context set up at all", async () => {
    // Arrange/Act: call the handler exactly as an unauthenticated client would —
    // no authz/session mocks are configured anywhere in this test file.
    const response = GET();

    // Assert
    expect(response.status).toBe(200);
  });

  it("returns the fixed synthetic bundle byte-for-byte, proving no tenant/DB input reaches the response", async () => {
    // Arrange
    const expected = generateBundle("partialDenial", 42);

    // Act
    const response = GET();
    const body = await response.text();

    // Assert: exact equality with the hardcoded scenario/seed output. If a
    // future change threads request input (query param, session, DB row)
    // into the bundle, this stops matching and the test fails.
    expect(body).toBe(JSON.stringify(expected, null, 2));
  });

  it("serves the bundle as a FHIR attachment download, not an inline API response", async () => {
    // Act
    const response = GET();

    // Assert
    expect(response.headers.get("content-type")).toBe("application/fhir+json");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="taweed-sample-bundle.json"',
    );
  });
});
