CREATE TABLE IF NOT EXISTS odds_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fixture_id BIGINT NOT NULL,
  operator_id INTEGER NOT NULL,
  operator_name TEXT NOT NULL,
  market VARCHAR(32) NOT NULL,
  line NUMERIC(6, 3) NOT NULL,
  odd NUMERIC(10, 4) NOT NULL CHECK (odd > 1),
  observed_at TIMESTAMPTZ NOT NULL
);

-- Read patterns: per-fixture odds charts, market comparisons, operator history,
-- and time-window retention/export jobs.
CREATE INDEX IF NOT EXISTS odds_history_fixture_observed_at_idx
  ON odds_history (fixture_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS odds_history_market_observed_at_idx
  ON odds_history (market, observed_at DESC);

CREATE INDEX IF NOT EXISTS odds_history_operator_observed_at_idx
  ON odds_history (operator_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS odds_history_observed_at_idx
  ON odds_history (observed_at DESC);
