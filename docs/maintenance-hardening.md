# Ryku Hunt Maintenance Hardening

## Understanding summary

- Implement all maintenance recommendations without changing gameplay or the leaderboard contract.
- Clean expired D1 rate-limit rows through a database trigger.
- Add validation-only GitHub Actions for test, lint, and build.
- Rename package metadata and the design title from Dragon Hunt to Ryku Hunt.
- Migrate browser storage keys without losing existing player preferences.
- Replace empty catches in `main.js` with safe, concise production warnings.
- Add CSS validation through Stylelint and the existing lint entry point.

## Assumptions and non-functional requirements

- Cleanup must have low overhead and require no additional deployed service.
- Request-triggered cleanup is sufficient for the expected community-game traffic.
- Storage migration is idempotent and always prefers the new key.
- CI performs no deployment, database migration, or production-secret access.
- Logs never include usernames, tokens, IP addresses, or stored values.
- Maintenance uses standard npm and GitHub Actions conventions.
- Gameplay availability does not depend on CI or cleanup execution.

## Final design

### D1 cleanup

Add `migrations/0002_cleanup_expired_rate_limits.sql`. It installs an `AFTER INSERT` trigger on `rate_limits` that deletes rows whose `expires_at` is in the past. The existing expiry index remains in use. Migration `0001` stays unchanged so existing databases can receive the cleanup behavior through a normal forward migration.

### Browser storage migration

Centralize compatible reads around `ryku-hunt:*` keys. Reads prefer the new key and fall back to the equivalent `dragon-hunt:*` key. When a legacy value is found, copy it to the new key and use it. Retain legacy keys temporarily to support application rollback. Storage failures return safe defaults and emit concise warnings without stored data.

### Logging

Replace empty catches in `main.js` with safe `console.warn` calls. Messages identify the failed operation but do not expose usernames, tokens, IP addresses, API payloads, or storage contents.

### Package, lint, and CI

Rename the package to `ryku-hunt`. Add Stylelint with its standard configuration and include CSS validation in `npm run lint` alongside the existing JavaScript lint. Add `.github/workflows/ci.yml` for pushes and pull requests using Node.js 20, `npm ci`, `npm test`, `npm run lint`, and `npm run build`. CI receives no secrets and performs neither deployment nor D1 migrations.

Update the `DESIGN.md` title to Ryku Hunt. Avoid unrelated internal renames.

## Verification strategy

- Test new-key priority, legacy fallback, successful copy, and inaccessible storage.
- Confirm warning output does not contain stored values.
- Structurally test the new migration and, when available, apply it to a temporary local D1 database with expired and active rows.
- Run the complete Node test suite, JavaScript lint, Stylelint, production build, high-severity npm audit, and browser smoke tests for desktop Game A and mobile Game B.
- Confirm gameplay scoring, timing, background, animations, and leaderboard API behavior remain unchanged.

## Decision log

- Use an additive migration rather than editing the baseline to support existing databases.
- Use an insert trigger rather than a cron Worker to avoid another deployed service.
- Use dual-read/single-write storage migration rather than immediate replacement to preserve player data.
- Retain legacy keys temporarily to support rollback.
- Emit concise production warnings without sensitive context.
- Route Stylelint through `npm run lint` so local and CI behavior match.
- Keep CI validation-only; exclude deployment and migrations.
