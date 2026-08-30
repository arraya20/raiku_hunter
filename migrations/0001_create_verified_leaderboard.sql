CREATE TABLE IF NOT EXISTS leaderboard_runs (
  run_id TEXT PRIMARY KEY,
  username TEXT NOT NULL CHECK (length(username) BETWEEN 3 AND 16),
  username_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('A', 'B')),
  score INTEGER NOT NULL CHECK (score >= 0),
  highest_round INTEGER NOT NULL CHECK (highest_round BETWEEN 1 AND 10),
  total_hits INTEGER NOT NULL CHECK (total_hits >= 0),
  total_shots INTEGER NOT NULL CHECK (total_shots >= total_hits),
  accuracy INTEGER NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  best_combo INTEGER NOT NULL CHECK (best_combo >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('gameover', 'victory')),
  created_at TEXT NOT NULL,
  seed INTEGER NOT NULL CHECK (seed BETWEEN 1 AND 4294967295),
  engine_version INTEGER NOT NULL CHECK (engine_version >= 1),
  transcript_hash TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status = 'verified')
);

CREATE INDEX IF NOT EXISTS idx_runs_mode_score
  ON leaderboard_runs (mode, score DESC, highest_round DESC, accuracy DESC, created_at ASC)
  WHERE verification_status = 'verified';

CREATE INDEX IF NOT EXISTS idx_runs_daily
  ON leaderboard_runs (mode, created_at, score DESC)
  WHERE verification_status = 'verified';

CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
  expires_at TEXT NOT NULL,
  PRIMARY KEY (rate_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON rate_limits (expires_at);
