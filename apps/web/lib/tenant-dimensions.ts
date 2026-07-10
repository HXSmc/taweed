import "server-only";
import { asc } from "drizzle-orm";
import { schema, type Database } from "@taweed/db";
import { withSession } from "@/lib/db";

export interface FirstTenantDimensions {
  branch?: { id: string; name: string };
  provider?: { id: string; name: string };
  payer?: { id: string; name: string };
  patient?: { id: string; pseudonym: string };
}

/**
 * First branch/provider/payer/patient by name (patient by pseudonym — it has
 * no name column) for a tenant. This is the SAME simplification
 * apps/web/lib/actions/ingest.ts already applies to FHIR-bundle uploads:
 * every uploaded claim maps onto the tenant's existing dimensions rather than
 * creating new ones from upload data (out of scope for this pass — see the
 * BLK-1 real-partner-ingest track). Factored out here, as an exact copy of
 * ingestBundle's own query, so the CSV ingest path (ingest-csv.ts) can reuse
 * it without duplicating the query or altering ingestBundle's behavior.
 */
export async function resolveFirstDimensions(
  tenantId: string,
): Promise<FirstTenantDimensions> {
  return withSession(tenantId, async (db: Database) => {
    const [branch] = await db
      .select()
      .from(schema.branches)
      .orderBy(asc(schema.branches.name))
      .limit(1);
    const [provider] = await db
      .select()
      .from(schema.providers)
      .orderBy(asc(schema.providers.name))
      .limit(1);
    const [payer] = await db
      .select()
      .from(schema.payers)
      .orderBy(asc(schema.payers.name))
      .limit(1);
    const [patient] = await db
      .select()
      .from(schema.patients)
      .orderBy(asc(schema.patients.pseudonym))
      .limit(1);
    return { branch, provider, payer, patient };
  });
}
