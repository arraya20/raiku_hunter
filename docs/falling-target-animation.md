# Falling Target Animation

## Understanding Summary

- A successfully shot Ryku falls downward while spinning.
- The fall lasts about 0.6 seconds and may overlap the next target.
- The next target still appears after the existing 0.25-second success delay.
- Game A and every independently hit Game B target use the effect.
- Gameplay, scoring, hitboxes, replay, leaderboard, and miss timing remain unchanged.
- The existing target sprite is reused without additional network assets.

## Assumptions

- Rotation follows the target's flight direction.
- The falling target fades near the end of the effect.
- Visual effects are bounded and automatically removed for desktop/mobile performance.
- Reduced-motion uses a shorter fall with substantially less rotation.

## Final Design

Immediately before `applyAction()` mutates the wave, the firing path captures lightweight snapshots of active targets and their current positions. When a shot returns a `targetId`, the matching snapshot becomes a `fallingTarget` effect containing its character kind, position, size, horizontal direction, rotation, and lifetime.

The renderer handles ordinary hit/miss rings and falling-target effects separately. A falling target reuses the loaded gameplay image, preserves horizontal momentum, accelerates downward, spins according to flight direction, and fades during the final part of its roughly 0.6-second lifetime. Because the snapshot lives in the visual effects list rather than game state, it survives a wave transition and can overlap the target that appears after 0.25 seconds.

Each Game B target is captured independently. Falling targets cannot be shot and never participate in scoring, collision detection, replay actions, or leaderboard verification. Tests cover snapshot capture before wave mutation, deterministic fall transforms and fade, effect cleanup, and browser smoke behavior.

## Decision Log

- Chose a canvas-effect snapshot over retaining hit targets in wave state to protect deterministic game and leaderboard behavior.
- Rejected an HTML overlay because responsive coordinate synchronization would be more fragile than drawing in the arena canvas.
- Preserved the 0.25-second next-target delay and allowed visual overlap so the fall remains readable.
- Reused the existing Ryku sprite to avoid extra assets and network requests.

