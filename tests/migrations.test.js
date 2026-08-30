import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("rate-limit cleanup is installed as an additive expiry trigger", async () => {
  const migration = await readFile(
    new URL("../migrations/0002_cleanup_expired_rate_limits.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE TRIGGER IF NOT EXISTS cleanup_expired_rate_limits/iu);
  assert.match(migration, /AFTER INSERT ON rate_limits/iu);
  assert.match(migration, /DELETE FROM rate_limits/iu);
  assert.match(migration, /expires_at\s*<=\s*strftime/iu);
});
