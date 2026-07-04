import { NextResponse } from "next/server";
import { generateBundle } from "@taweed/synthetic-fhir";

// A downloadable synthetic NPHIES bundle so the Ingest empty state teaches its own
// population path (design-brief §8.1, §9). Zero PHI. TODO(nphies-creds): codes are
// placeholders.
export function GET() {
  const bundle = generateBundle("partialDenial", 42);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/fhir+json",
      "content-disposition": 'attachment; filename="taweed-sample-bundle.json"',
    },
  });
}
