# Ryku Hunt — Game Design

## Status

Design approved on 2026-08-28. Working title: **Ryku Hunt**.

## Understanding Summary

- Build an original browser shooting game inspired by the timing and round structure of classic light-gun games.
- Game A presents one dragon per wave; Game B presents two dragons per wave.
- Each round contains 10 targets, has a minimum hit requirement, and becomes progressively harder.
- An original jungle companion retrieves a signal token after a hit and laughs after a fully missed wave.
- Support mouse, touch, and keyboard input across desktop and mobile.
- Players choose or generate a username without creating an account.
- Provide a shared online leaderboard through Cloudflare Pages Functions and D1 with server-verified scores.

## Scope

### Included

- Game A and Game B
- Responsive Canvas 2D gameplay
- Original replaceable placeholder characters
- Progressive rounds, scoring, combo, accuracy, and three bullets per wave
- Online leaderboard with daily and all-time views per mode
- Sound, optional haptics, pause, reduced-motion support, and accessible menu controls
- Offline gameplay fallback when the leaderboard service is unavailable

### Non-goals for Version 1

- Game C or clay-target equivalent
- Login or account system
- Real-time multiplayer
- Wallet, NFT, or purchases
- Official Raiku logos, characters, avatars, or other protected visual assets

## Assumptions and Non-functional Requirements

- Use vanilla JavaScript, HTML, CSS, and Canvas 2D with Node.js 20+ tooling.
- Target 60 FPS on modern devices and playable performance on mid-range mobile devices.
- Deploy the static client and Pages Functions on Cloudflare Pages; use D1 for leaderboard data.
- Store no personal data beyond username and run results.
- Validate usernames and payloads, escape rendered values, rate-limit submissions, and replay runs on the server.
- Keep gameplay usable if images, audio, or the leaderboard API fails.
- Keep assets and rules modular so one maintainer can replace characters without editing gameplay code.
- Test pure logic with `node:test`, API boundaries with integration tests, and critical flows with browser smoke tests.

## Architecture

The client has three layers:

1. HTML/CSS UI for home, username entry, mode selection, briefing, HUD, results, game over, and leaderboard.
2. Canvas 2D renderer for the arena, dragons, companion, crosshair, projectiles, particles, and feedback.
3. Pure game modules for deterministic state, ammunition, waves, hit detection, scoring, difficulty, and transcripts.

Navigation flow:

```text
Home -> Username -> Mode -> Briefing -> Round
                                      |
                              10 targets resolved
                                      |
                         Pass -> next round
                         Fail -> game over -> leaderboard submission
```

The server issues a run challenge containing a run ID, seed, mode, rules version, and expiry. The browser records a quantized action transcript. The server replays the transcript using the same deterministic rules and calculates the accepted score.

## Gameplay Rules

- A round always contains 10 targets.
- Game A uses 10 waves with one dragon in each wave.
- Game B uses 5 waves with two dragons in each wave.
- Every wave starts with three bullets.
- A wave ends when every target is hit, ammunition is exhausted, or the target timer expires.
- Initial pass requirement is 6/10 and progressively increases to a maximum of 9/10.
- Difficulty increases through speed, shorter exposure, direction changes, and fair size variation.
- Losing focus automatically pauses the game.

### Initial Scoring Model

- Base hit: 1,000 points.
- First-shot accuracy awards the largest ammunition bonus.
- Faster hits award a time bonus.
- Hitting every target in a wave awards a perfect-wave bonus.
- A miss breaks the combo but does not subtract points.

Exact scoring constants may be tuned without changing the model, provided client and server use the same versioned rules.

## Characters and Assets

Characters are data-driven. Gameplay code consumes a manifest containing the image path, rendered dimensions, animation frames, animation speed, and normalized hitbox. Version 1 uses original placeholder SVG or raster assets.

The manifest must support both a static image (`frames: 1`) and a future sprite sheet. Normalized hitboxes remain independent from transparent image bounds and scale consistently on desktop and mobile.

The companion is initially an original small jungle lizard. It retrieves a dragon signal token after a successful wave and performs a short laugh after a completely missed wave. Dragons are not shown dying or being injured.

## Visual and Interaction Design

- Dark futuristic jungle with layered canopy silhouettes, green mist, scanning grids, translucent black panels, neon lime, and ammunition amber.
- A fixed logical Canvas aspect ratio scales without stretching. Target coordinates avoid HUD and device safe areas.
- Desktop uses side mission/score panels; mobile uses a compact HUD above the main arena.
- Mouse aims and clicks; touch taps; keyboard uses arrows/WASD, Space to fire, and P/Escape to pause.
- Web Audio API supplies synthesized feedback after the first user interaction. Mute preference persists locally.
- Haptics are optional and capability-checked.
- Reduced-motion removes or shortens parallax, recoil, mist, camera movement, and long transitions.
- Live regions announce important state; ammunition and results never rely on color alone.

If an image fails to load, the renderer uses a geometric fallback with the same hitbox. Audio failure never interrupts gameplay.

## Leaderboard and Security

D1 stores the normalized username, mode, verified score, highest round, accuracy, completion time, transcript hash, and creation time. Rankings are filterable by Game A/Game B and daily/all-time periods.

Server protections include:

- Username restricted to 3–16 ASCII letters, digits, or underscores
- Strict request schemas and transcript size limits
- Expiring, single-use run challenges
- Deterministic server replay and server-calculated scores
- Duplicate-submission protection
- Basic rate limiting using a non-reversible network identifier
- Versioned rules so old challenges cannot be evaluated with incompatible logic

Client-clock time is never trusted; gameplay actions use deterministic simulation ticks.

## Error Handling and Edge Cases

- Resize and orientation changes preserve simulation coordinates.
- Only the first eligible contact in a multi-touch or duplicate-click event consumes a shot.
- Loss of tab focus pauses the run.
- Late or failed assets use stable fallbacks.
- Failed leaderboard calls retain gameplay and present an offline state.
- Repeated submissions, expired challenges, oversized transcripts, and invalid actions are rejected safely.
- Pending eligible submissions may be retried without accepting the same challenge twice.

## Testing Strategy

- Unit tests: round state, ammunition, mode wave composition, hitboxes, scoring, seeded randomness, pass thresholds, difficulty, and deterministic replay.
- Integration tests: challenge creation, valid and invalid submissions, expiry, duplicate prevention, leaderboard queries, and rate limits.
- Browser smoke tests: username generation, mode selection, firing, pausing, results, responsive mobile layout, keyboard controls, and API fallback.
- Release checks: syntax/lint, complete tests, production build, dependency audit, and desktop/mobile visual inspection.

## Decision Log

| Decision | Alternatives considered | Reason |
| --- | --- | --- |
| Ship Game A and Game B only | Include Game C | Keeps version 1 focused on dragon gameplay. |
| Canvas 2D gameplay with HTML/CSS UI | Raster-only sprite engine; DOM/CSS arena | Best balance of performance, responsiveness, accessibility, effects, and maintenance. |
| Data-driven external character assets | Draw characters directly in engine code | Allows placeholder art to be replaced without changing gameplay. |
| Support static images and future sprite sheets | Static images only | Preserves a simple first release while enabling final animated art later. |
| Original jungle companion | Copy the recognizable hound character | Maintains the playful feedback role without copying protected character design. |
| Ten targets per round | Endless or timer-only play | Matches the desired readable retro round structure. |
| Three bullets per wave | Shared ammunition per round | Creates the intended accuracy pressure and clear wave cadence. |
| Server-seeded deterministic runs | Trust client-submitted score | Enables meaningful score verification for a shared leaderboard. |
| Username without login | Account authentication; anonymous only | Low-friction identity that still supports recognizable rankings. |
| Cloudflare Pages Functions + D1 | Local-only scores; separate backend | Matches the existing deployment ecosystem and enables shared rankings. |
| Offline-tolerant gameplay | Require API connectivity | Keeps the core game reliable during service or network failures. |
| Mouse, touch, and keyboard controls | Pointer-only controls | Supports desktop, mobile, and keyboard accessibility. |

## Approved Risks

- A public browser game cannot be made completely cheat-proof; deterministic server replay substantially raises the cost of simple score manipulation.
- Placeholder geometry may need hitbox tuning when final art arrives; normalized per-character hitboxes contain this change to asset metadata.
- Mobile browser audio and haptics vary by platform; both are optional enhancements rather than gameplay dependencies.
