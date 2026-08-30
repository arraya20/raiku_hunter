# Threat Model

## Trust boundaries

- Browser form input: username, mode selection, and pointer actions are untrusted.
- Public HTTP API: request headers, JSON bodies, query parameters, and client clocks are untrusted.
- Browser transcript: every action may be forged, reordered, duplicated, or oversized.
- D1: only parameterized statements may receive request-derived values.

## Assets

- Integrity of the shared leaderboard
- Availability of gameplay and leaderboard endpoints
- Run-signing secret and non-reversible network-rate-limit key
- Minimal stored player data (username and run statistics)

## Abuse cases and controls

| Abuse case | Control |
| --- | --- |
| Submit a fabricated score | Server replays a signed, seeded transcript and calculates score. |
| Reuse or alter a challenge | HMAC signature, expiry, run ID uniqueness, and transcript hash. |
| Inject HTML through username | Strict ASCII username pattern and text-only DOM rendering. |
| Inject SQL through query/input | Fixed SQL plus D1 prepared-statement bindings. |
| Exhaust replay CPU or request memory | Body byte cap, action cap, numeric ranges, and bounded rounds. |
| Flood start/submit endpoints | Per-network keyed rate-limit records with short windows. |
| Leak internal details | Stable public error codes; logs exclude request bodies and secrets. |
| Embed or misuse browser capabilities | CSP, frame denial, and restrictive Permissions-Policy. |

No authentication or sensitive personal data is part of version 1.
