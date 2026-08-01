-- Sprint 17 Phase C — durable prepared snapshots + refresh jobs
-- Bounded normalized payload in Postgres (single-host; see docs/snapshot-architecture.md).

CREATE TABLE IF NOT EXISTS provider_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  snapshot_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  source_started_at TIMESTAMPTZ,
  source_completed_at TIMESTAMPTZ,
  provider_timestamps JSONB,
  data_snapshot_id TEXT,
  payload JSONB,
  checksum TEXT NOT NULL,
  fixture_count INTEGER NOT NULL DEFAULT 0,
  odds_count INTEGER NOT NULL DEFAULT 0,
  freshness_state TEXT NOT NULL DEFAULT 'unknown',
  error_code TEXT,
  previous_valid_snapshot_id TEXT,
  expires_at TIMESTAMPTZ,
  CONSTRAINT provider_snapshots_status_chk
    CHECK (status IN ('building', 'valid', 'failed', 'expired', 'superseded')),
  CONSTRAINT provider_snapshots_freshness_chk
    CHECK (freshness_state IN (
      'current',
      'recently_updated',
      'stale_but_usable',
      'expired',
      'unknown'
    ))
);

CREATE INDEX IF NOT EXISTS provider_snapshots_type_status_idx
  ON provider_snapshots (snapshot_type, status, created_at DESC);

CREATE TABLE IF NOT EXISTS active_snapshots (
  snapshot_type TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES provider_snapshots (snapshot_id),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_snapshot_id TEXT
);

CREATE TABLE IF NOT EXISTS refresh_jobs (
  job_id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt INTEGER NOT NULL DEFAULT 1,
  result_counts JSONB,
  error_code TEXT,
  snapshot_id TEXT,
  lock_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refresh_jobs_status_chk
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'skipped', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS refresh_jobs_type_created_idx
  ON refresh_jobs (job_type, created_at DESC);
