-- Sprint 20B-B, stage B2 — durable Acca persistence.
--
-- Additive. Creates one new table; touches no existing table. The candidate lifecycle
-- columns it depends on were added by 20260727_widen_candidate_status.sql.
--
-- CENTRAL INVARIANT
--   One candidate can create at most one Acca.
--   Enforced here by UNIQUE (source_candidate_id) so it holds even against a direct SQL
--   writer, not only against the application. The application additionally performs the
--   Acca insert and the candidate APPROVED -> CONVERTED transition inside ONE transaction
--   (lib/acca-publication/adapters/postgres.ts), so neither side can commit alone.
--
-- ODDS PRECISION
--   combined_odds is NUMERIC(14,4), not a floating type. The canonical value is computed
--   with exact BigInt fixed-point arithmetic (lib/acca-publication/odds.ts) and must survive
--   the round trip unchanged; DOUBLE PRECISION would reintroduce the drift that calculator
--   exists to remove. Follows the NUMERIC(10,4) precedent in 20260724_create_odds_history.sql.
--   14,4 accommodates the documented ceiling of 1000000.0000.
--
-- VISIBILITY
--   This table stores DRAFT, PUBLISHED and ARCHIVED rows. It does NOT encode public
--   visibility; only status = 'PUBLISHED' is publicly visible, and that rule is applied by
--   the application (lifecycle.isPubliclyVisible). No public route exists yet.
--
-- NOT EXECUTED as part of stage B2. Apply separately per docs/migration-runbook.md.
--
-- Reverse path (repository ships forward-only migrations; documented rather than a down file):
--   DROP TABLE IF EXISTS published_accas;

CREATE TABLE IF NOT EXISTS published_accas (
  acca_id                TEXT PRIMARY KEY,
  source_candidate_id    TEXT         NOT NULL,
  status                 TEXT         NOT NULL DEFAULT 'DRAFT',
  title                  TEXT         NOT NULL,
  summary                TEXT,
  locale                 TEXT         NOT NULL,
  slug                   TEXT         NOT NULL,
  legs                   JSONB        NOT NULL,
  combined_odds          NUMERIC(14,4) NOT NULL,
  evidence_snapshot      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  qualification_snapshot JSONB        NOT NULL DEFAULT '{}'::jsonb,
  source_references      JSONB        NOT NULL,
  schema_version         TEXT         NOT NULL,
  version                INTEGER      NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  published_at           TIMESTAMPTZ,
  archived_at            TIMESTAMPTZ,
  created_by             TEXT         NOT NULL,
  published_by           TEXT,
  archived_by            TEXT,

  CONSTRAINT published_accas_status_chk
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),

  CONSTRAINT published_accas_version_chk
    CHECK (version >= 1),

  CONSTRAINT published_accas_acca_id_chk
    CHECK (acca_id ~ '^acca_[0-9a-f]{32}$'),

  -- Coarse actor vocabulary, consistent with the Builder Approval domain.
  CONSTRAINT published_accas_created_by_chk
    CHECK (created_by = 'admin'),
  CONSTRAINT published_accas_published_by_chk
    CHECK (published_by IS NULL OR published_by = 'admin'),
  CONSTRAINT published_accas_archived_by_chk
    CHECK (archived_by IS NULL OR archived_by = 'admin'),

  CONSTRAINT published_accas_title_chk
    CHECK (char_length(title) BETWEEN 1 AND 160),
  CONSTRAINT published_accas_summary_chk
    CHECK (summary IS NULL OR char_length(summary) <= 400),
  CONSTRAINT published_accas_locale_chk
    CHECK (char_length(locale) BETWEEN 2 AND 16),
  CONSTRAINT published_accas_slug_chk
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),

  -- Decimal odds are strictly greater than 1; matches MIN_DECIMAL_ODDS and the ceiling.
  CONSTRAINT published_accas_combined_odds_chk
    CHECK (combined_odds > 1 AND combined_odds <= 1000000),

  -- Publication metadata may exist only once published, and must exist when published or
  -- archived (an archived Acca was necessarily published first).
  CONSTRAINT published_accas_published_metadata_chk
    CHECK (
      (status = 'DRAFT'     AND published_at IS NULL     AND published_by IS NULL)
      OR (status = 'PUBLISHED' AND published_at IS NOT NULL AND published_by IS NOT NULL)
      OR (status = 'ARCHIVED'  AND published_at IS NOT NULL AND published_by IS NOT NULL)
    ),

  CONSTRAINT published_accas_archived_metadata_chk
    CHECK (
      (status = 'ARCHIVED' AND archived_at IS NOT NULL AND archived_by IS NOT NULL)
      OR (status <> 'ARCHIVED' AND archived_at IS NULL AND archived_by IS NULL)
    )
);

-- One candidate can create at most one Acca. This is the central B2 invariant.
CREATE UNIQUE INDEX IF NOT EXISTS published_accas_source_candidate_uidx
  ON published_accas (source_candidate_id);

-- One public slug, globally. Collisions are resolved deterministically by the application
-- using a stable Acca-id-derived discriminator, never an unbounded retry loop.
CREATE UNIQUE INDEX IF NOT EXISTS published_accas_slug_uidx
  ON published_accas (slug);

-- Admin list by status and creation date; matches the adapter's hard-coded ORDER BY.
CREATE INDEX IF NOT EXISTS published_accas_status_created_idx
  ON published_accas (status, created_at DESC, acca_id DESC);

-- Public list: only published rows, newest first. Partial so drafts and archives never
-- occupy the public index.
CREATE INDEX IF NOT EXISTS published_accas_published_idx
  ON published_accas (published_at DESC, acca_id DESC)
  WHERE status = 'PUBLISHED';

-- Public list scoped by locale.
CREATE INDEX IF NOT EXISTS published_accas_locale_published_idx
  ON published_accas (locale, published_at DESC)
  WHERE status = 'PUBLISHED';
