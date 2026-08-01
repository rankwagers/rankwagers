-- Sprint 20B-B, stage B1 — candidate lifecycle.
--
-- WHY THIS EXISTS (deliberate reversal of a Sprint 20B-A restriction)
--
-- 20260726_create_builder_approval.sql shipped candidates as DRAFT-only and said:
--   "Sprint 20B-A supports exactly one status ... Sprint 20B-B must widen it explicitly and
--    deliberately, so no transition can be introduced by accident."
-- This migration IS that deliberate widening. It is not a correction and not an accident.
--
-- WHAT IS AND IS NOT RELAXED
--   Relaxed : the status CHECK, so a candidate may progress through its lifecycle.
--   Retained: business-payload immutability. The application still issues no UPDATE that
--             touches payload, builder_config, source identifiers, checksum, fingerprint,
--             idempotency_key or created_at. The single UPDATE statement in the codebase
--             (lib/builder-approval/adapters/postgres.ts) writes only the lifecycle columns
--             added below, and is guarded by candidate_id + status + version.
--
-- Legal transitions, enforced in lib/builder-approval/lifecycle.ts and by the application:
--   DRAFT -> APPROVED, DRAFT -> REJECTED, APPROVED -> CONVERTED.
-- Everything else, including same-state transitions, is rejected as a typed conflict.
-- The CHECK below constrains the VALUE SET only; SQL alone cannot express the edge set.
--
-- DATA PRESERVATION
--   * No row is rewritten, deleted or re-keyed.
--   * Existing rows keep status = 'DRAFT'.
--   * version defaults to 1 for existing rows, giving them a valid optimistic-concurrency
--     starting point.
--   * status_changed_at / status_actor / rejection_reason / converted_acca_id stay NULL for
--     existing rows. Nothing invents a historical operator or a historical timestamp.
--
-- REVERSIBILITY
--   The repository ships forward-only .sql migrations (see db/migrations/) with no down
--   files, so this follows that convention. The down path is documented here instead:
--     ALTER TABLE builder_publication_candidates
--       DROP CONSTRAINT builder_publication_candidates_status_chk,
--       ADD  CONSTRAINT builder_publication_candidates_status_chk CHECK (status = 'DRAFT');
--     -- only safe while no row has advanced past DRAFT; the added columns may be left in
--     -- place harmlessly, or dropped if no lifecycle data exists.
--
-- NOT EXECUTED as part of stage B1. Apply separately per docs/migration-runbook.md.

ALTER TABLE builder_publication_candidates
  ADD COLUMN IF NOT EXISTS version           INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_actor      TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT,
  ADD COLUMN IF NOT EXISTS converted_acca_id TEXT;

-- Widen the value set. Dropped and re-added because a CHECK cannot be altered in place.
ALTER TABLE builder_publication_candidates
  DROP CONSTRAINT IF EXISTS builder_publication_candidates_status_chk;

ALTER TABLE builder_publication_candidates
  ADD CONSTRAINT builder_publication_candidates_status_chk
    CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED', 'CONVERTED'));

-- Optimistic concurrency must always be usable.
ALTER TABLE builder_publication_candidates
  DROP CONSTRAINT IF EXISTS builder_publication_candidates_version_chk;
ALTER TABLE builder_publication_candidates
  ADD CONSTRAINT builder_publication_candidates_version_chk
    CHECK (version >= 1);

-- Coarse actor only, matching the existing actor column's constraint.
ALTER TABLE builder_publication_candidates
  DROP CONSTRAINT IF EXISTS builder_publication_candidates_status_actor_chk;
ALTER TABLE builder_publication_candidates
  ADD CONSTRAINT builder_publication_candidates_status_actor_chk
    CHECK (status_actor IS NULL OR status_actor = 'admin');

-- Bounded operator note; the application sanitizes and length-checks before it reaches here.
ALTER TABLE builder_publication_candidates
  DROP CONSTRAINT IF EXISTS builder_publication_candidates_rejection_reason_chk;
ALTER TABLE builder_publication_candidates
  ADD CONSTRAINT builder_publication_candidates_rejection_reason_chk
    CHECK (rejection_reason IS NULL OR char_length(rejection_reason) <= 500);

-- A reason belongs only to a rejection, and an Acca link only to a conversion. Enforced in
-- the domain too; duplicated here so a direct SQL writer cannot create an inconsistent row.
ALTER TABLE builder_publication_candidates
  DROP CONSTRAINT IF EXISTS builder_publication_candidates_lifecycle_metadata_chk;
ALTER TABLE builder_publication_candidates
  ADD CONSTRAINT builder_publication_candidates_lifecycle_metadata_chk
    CHECK (
      (rejection_reason IS NULL OR status = 'REJECTED')
      AND (converted_acca_id IS NULL OR status = 'CONVERTED')
    );

-- Admin queue filtering by lifecycle state.
CREATE INDEX IF NOT EXISTS builder_publication_candidates_status_created_idx
  ON builder_publication_candidates (status, created_at DESC, candidate_id DESC);

-- At most one candidate may ever be linked to a given Acca.
CREATE UNIQUE INDEX IF NOT EXISTS builder_publication_candidates_converted_acca_uidx
  ON builder_publication_candidates (converted_acca_id)
  WHERE converted_acca_id IS NOT NULL;
