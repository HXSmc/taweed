-- EXECUTE B5 — real-column mapping for the scrubber (docs/NEXT_STEP_PROMPT.md §B item 5).
--
-- The synthetic pipeline derived pre-auth / eligibility / duplicate / documentation
-- signals from a per-claim hash purely to exercise the rule set. Real NPHIES claims
-- carry these as data. This migration adds:
--   * data_origin: the hard gate. 'production' locks out the synthetic hash projection
--     in the app (apps/web/lib/data.ts) so synthetic signals can never touch real PHI.
--   * the four real signal columns. They are NULLABLE on purpose: NULL = the source
--     carries no such signal, so the scrubber marks the dependent rule "unevaluable"
--     (needs data, never a false pass — design-brief §8.3), driven by the fact the rule
--     actually references (packages/rules-engine/src/scrub.ts already does this).
--
-- RLS (0001) is table-level FORCE and the app-role GRANTs are table-level, so both
-- automatically cover the new columns; no policy or grant change needed.

ALTER TABLE claims
  ADD COLUMN data_origin text NOT NULL DEFAULT 'synthetic',
  ADD COLUMN preauth_present boolean,
  ADD COLUMN eligibility_verified boolean,
  ADD COLUMN is_duplicate boolean,
  ADD COLUMN has_documentation boolean;

ALTER TABLE claims
  ADD CONSTRAINT claims_data_origin_check
  CHECK (data_origin IN ('synthetic', 'production'));

-- Scrubber reads claims filtered by origin; index keeps the production path cheap.
CREATE INDEX claims_data_origin_idx ON claims (tenant_id, data_origin);
