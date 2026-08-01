-- Sprint 20B-A — Builder publication candidates (internal, DRAFT-only).
-- Additive migration. Creates no dependency for existing features: nothing in the
-- application reads this table unless FF_OPERATOR_APPROVAL_ENABLED is true.
--
-- Scope guard: this sprint introduces NO approval, rejection, publication or scheduling.
-- The status CHECK below allows only 'DRAFT' — Sprint 20B-B must widen it explicitly and
-- deliberately, so no transition can be introduced by accident.
--
-- Candidates are write-once. The application issues no UPDATE and no DELETE against this
-- table (see lib/builder-approval/adapters/postgres.ts).
--
-- NOT EXECUTED as part of Sprint 20B-A. Apply separately per docs/migration-runbook.md.

CREATE TABLE IF NOT EXISTS builder_publication_candidates (
  candidate_id        TEXT PRIMARY KEY,
  schema_version      TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'DRAFT',
  actor               TEXT        NOT NULL,
  source_request_id   TEXT,
  source_snapshot_id  TEXT,
  source_date         TEXT,
  builder_config      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  payload             JSONB       NOT NULL,
  payload_checksum    TEXT        NOT NULL,
  checksum_version    TEXT        NOT NULL,
  idempotency_key     TEXT        NOT NULL,
  request_fingerprint TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sprint 20B-A supports exactly one status. Widening this is a Sprint 20B-B decision.
  CONSTRAINT builder_publication_candidates_status_chk
    CHECK (status = 'DRAFT'),

  -- Coarse-grained actor only; no named operator identity exists yet.
  CONSTRAINT builder_publication_candidates_actor_chk
    CHECK (actor = 'admin'),

  -- Identity must be a minted candidate id, never a reused content hash such as snapshotId.
  CONSTRAINT builder_publication_candidates_candidate_id_chk
    CHECK (candidate_id ~ '^bpc_[0-9a-f]{32}$'),

  CONSTRAINT builder_publication_candidates_checksum_chk
    CHECK (char_length(payload_checksum) = 64),

  CONSTRAINT builder_publication_candidates_checksum_version_chk
    CHECK (char_length(checksum_version) > 0),

  CONSTRAINT builder_publication_candidates_source_date_chk
    CHECK (source_date IS NULL OR source_date ~ '^\d{4}-\d{2}-\d{2}$'),

  CONSTRAINT builder_publication_candidates_idempotency_key_chk
    CHECK (char_length(idempotency_key) BETWEEN 8 AND 200)
);

-- Required for transaction-safe creation: the adapter relies on ON CONFLICT
-- (idempotency_key) DO NOTHING, so concurrent retries can never insert twice.
CREATE UNIQUE INDEX IF NOT EXISTS builder_publication_candidates_idempotency_key_uidx
  ON builder_publication_candidates (idempotency_key);

-- Matches the adapter's hard-coded ORDER BY created_at DESC, candidate_id DESC.
CREATE INDEX IF NOT EXISTS builder_publication_candidates_created_at_idx
  ON builder_publication_candidates (created_at DESC, candidate_id DESC);

CREATE INDEX IF NOT EXISTS builder_publication_candidates_source_request_idx
  ON builder_publication_candidates (source_request_id)
  WHERE source_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS builder_publication_candidates_source_snapshot_idx
  ON builder_publication_candidates (source_snapshot_id)
  WHERE source_snapshot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS builder_publication_candidates_source_date_idx
  ON builder_publication_candidates (source_date)
  WHERE source_date IS NOT NULL;
