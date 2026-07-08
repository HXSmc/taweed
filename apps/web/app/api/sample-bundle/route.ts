import { NextResponse } from "next/server";
import { generateBundle } from "@taweed/synthetic-fhir";

// A downloadable synthetic NPHIES bundle so the Ingest empty state teaches its own
// population path (design-brief §8.1, §9). Zero PHI. TODO(nphies-creds): codes are
// placeholders.
//
// Intentionally unauthenticated and unrate-limited: this is a public, static,
// deterministic sample (fixed scenario + seed, no query/body/tenant input, no
// DB access). Do NOT add `authorizeAction`/`allowRequest` here without first
// deciding whether the endpoint still needs to be public — see
// test/sample-bundle-route.test.ts, which pins this handler to the synthetic,
// input-free contract so any future param that reads real tenant data trips
// the regression test.
export function GET() {
  const bundle = generateBundle("partialDenial", 42);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/fhir+json",
      "content-disposition": 'attachment; filename="taweed-sample-bundle.json"',
    },
  });
}
