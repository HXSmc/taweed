-- App-role provisioning + privilege hardening (audit finding, docs/review.md).
--
-- Previously this entire block (role creation, blanket GRANT, and the
-- REVOKEs that make tenants/audit_logs/llm_calls actually enforced) lived
-- ONLY in packages/db/test/migrate.ts's ensureAppRole(), a TS helper called
-- from a test-only, schema-dropping migration script gated to local/test
-- hosts. Every RLS policy in 0001/0005/0006/0007/0009 depends on app traffic
-- connecting as a non-superuser, NOBYPASSRLS role for RLS to bind at all
-- (superusers always bypass RLS) — so if production were ever provisioned by
-- applying these drizzle/*.sql files through any other tool (a generic CI
-- migration runner, `psql -f`, etc.), none of this would exist: RLS would
-- never bind to app traffic, and the "append-only" guarantee on audit_logs/
-- llm_calls (their only protection against a compromised app role tampering
-- with the compliance trail) would never be established.
--
-- Moving it here means the enforcement travels WITH the SQL: any process
-- that applies drizzle/*.sql in order gets it for free, with no dependency
-- on this specific TS test harness. Placed last (0010, applied after every
-- other migration) so the blanket GRANT below always runs after any
-- per-table GRANT a future migration might add, and the REVOKEs below always
-- run after that blanket GRANT — matching the original ordering guarantee.
--
-- Role name/password mirror the APP_ROLE/APP_PASSWORD constants in
-- packages/db/test/migrate.ts (single source: change both together). The
-- password is a local/dev placeholder only — production must rotate it via
-- the deployment's own secret management, out of band from this file.
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taweed_app') THEN
    CREATE ROLE "taweed_app" LOGIN PASSWORD 'taweed' NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO "taweed_app";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "taweed_app";
--> statement-breakpoint
-- `tenants` is the RLS-less isolation root — the app role must not read/write
-- it directly (that would expose every tenant's identity). Seeding/admin of
-- tenants goes through the superuser/admin connection only.
REVOKE ALL ON TABLE tenants FROM "taweed_app";
--> statement-breakpoint
-- `llm_calls` is an APPEND-ONLY compliance trail (0006 header): the app role
-- may INSERT + SELECT but must NEVER UPDATE or DELETE an audit row.
REVOKE UPDATE, DELETE ON TABLE llm_calls FROM "taweed_app";
--> statement-breakpoint
-- `audit_logs` is the primary APPEND-ONLY PHI-access trail (packages/audit) —
-- same immutability guarantee as llm_calls, enforced by PRIVILEGE (RLS scopes
-- but does not prevent mutating the tenant's own rows).
REVOKE UPDATE, DELETE ON TABLE audit_logs FROM "taweed_app";
