-- Shared, cross-instance rate-limit store (audit finding, docs/review.md:669).
-- apps/web/lib/rate-limit.ts previously kept RateWindow state in a per-process
-- Map, so under horizontal scale (N instances behind a load balancer) each
-- instance counted independently and the effective ceiling became N x
-- `limit` -- the one throttle guarding the billable AI actions failed open at
-- scale. This table is the shared backing store every instance now reads and
-- writes through a single atomic INSERT .. ON CONFLICT / SELECT .. FOR UPDATE
-- transaction (see createRateLimitStore in that file), so concurrent writers
-- for the same key serialize on the Postgres row lock instead of racing a
-- read-modify-write across instances.
--
-- Not tenant-scoped / no RLS: callers already bake tenant+actor into `key`
-- (e.g. "explain:<tenantId>:<userId>"), and some keys (e.g. "dev-signin") have
-- no tenant at all -- a tenant_id column would not fit every caller.
--> statement-breakpoint
CREATE TABLE "rate_limit_windows" (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL,
  "window_start" bigint NOT NULL
);
--> statement-breakpoint
-- taweed_app's blanket GRANT (drizzle/0010_app_role_grants.sql) only covered
-- tables that existed when it ran; a table added afterward needs its own
-- grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "rate_limit_windows" TO "taweed_app";
