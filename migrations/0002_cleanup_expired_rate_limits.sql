CREATE TRIGGER IF NOT EXISTS cleanup_expired_rate_limits
AFTER INSERT ON rate_limits
BEGIN
  DELETE FROM rate_limits
  WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
END;
