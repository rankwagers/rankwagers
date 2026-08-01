-- Sprint 17 Phase B — persistent affiliate attribution
-- Apply with the same Postgres used for odds history (or ATTRIBUTION_DATABASE_URL).

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  click_id TEXT PRIMARY KEY,
  session_id TEXT,
  combo_id TEXT,
  operator_id TEXT NOT NULL,
  country TEXT,
  locale TEXT NOT NULL,
  placement TEXT NOT NULL,
  operator_rank INTEGER,
  target_odds_min DOUBLE PRECISION,
  target_odds_max DOUBLE PRECISION,
  actual_combo_odds DOUBLE PRECISION,
  operator_combo_odds DOUBLE PRECISION,
  selection_count INTEGER,
  market_types JSONB,
  evidence_strength TEXT,
  availability TEXT NOT NULL,
  deeplink_type TEXT NOT NULL,
  campaign_id TEXT,
  offer_id TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT affiliate_clicks_availability_chk
    CHECK (availability IN ('full', 'partial', 'unknown', 'none'))
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_clicks_idempotency_uidx
  ON affiliate_clicks (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS affiliate_clicks_operator_created_idx
  ON affiliate_clicks (operator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS affiliate_clicks_session_idx
  ON affiliate_clicks (session_id)
  WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS affiliate_conversions (
  conversion_id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  click_id TEXT REFERENCES affiliate_clicks (click_id) ON DELETE SET NULL,
  external_transaction_id TEXT,
  type TEXT NOT NULL,
  amount DOUBLE PRECISION,
  currency TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  attributed BOOLEAN NOT NULL DEFAULT FALSE,
  raw_reference_hash TEXT,
  CONSTRAINT affiliate_conversions_status_chk
    CHECK (status IN ('accepted', 'rejected', 'duplicate'))
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_conversions_external_uidx
  ON affiliate_conversions (operator_id, external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS affiliate_conversions_click_idx
  ON affiliate_conversions (click_id)
  WHERE click_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS postback_events (
  id BIGSERIAL PRIMARY KEY,
  operator_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  click_id TEXT,
  external_transaction_id TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  payload_hash TEXT,
  raw_reference_hash TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS postback_events_operator_received_idx
  ON postback_events (operator_id, received_at DESC);

CREATE INDEX IF NOT EXISTS postback_events_click_idx
  ON postback_events (click_id)
  WHERE click_id IS NOT NULL;
