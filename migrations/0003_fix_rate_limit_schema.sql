DROP TRIGGER IF EXISTS cleanup_expired_rate_limits;

DROP TABLE IF EXISTS rate_limits;

CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
  expires_at TEXT NOT NULL,
  PRIMARY KEY (rate_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON rate_limits (expires_at);

CREATE TRIGGER IF NOT EXISTS cleanup_expired_rate_limits
AFTER INSERT ON rate_limits
BEGIN
  DELETE FROM rate_limits
  WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
END;
