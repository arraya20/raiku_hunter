# Gameplay Jungle Background

## Objective

Replace the procedural gameplay background with the supplied pixel-art jungle image so flying dragons feel more naturally situated in the arena, while preserving target and crosshair readability.

## Scope

- Apply the new image only to the active gameplay canvas.
- Keep the dashboard, mode selection, HUD, scoring, leaderboard, and game timing unchanged.
- Preserve the existing 0.25-second successful-hit transition and falling/spinning target animation.

## Rendering design

The supplied image will be stored as a local, replaceable game asset and preloaded with the existing visual assets. The canvas renderer will draw it first using a `cover` crop: aspect ratio is preserved, the complete canvas is filled, and excess vertical content is cropped evenly rather than stretching the image.

A subtle dark green-black overlay will be drawn over the image. It should retain the bright daytime jungle appearance while improving contrast for dragons, shot effects, and the crosshair.

The render order is:

1. Jungle image.
2. Subtle readability overlay.
3. Active flying dragons.
4. Falling/spinning hit dragons.
5. Shot effects and crosshair.

If the image is unavailable, the current procedural jungle renderer remains the fallback.

## Maintainability and responsiveness

The asset path will live in the asset configuration so the artwork can be replaced without changing gameplay logic. The `cover` calculation will support the current desktop and mobile canvas presentation without distortion.

## Verification

- Test background asset registration and loading.
- Test proportional `cover` crop calculations.
- Test the procedural fallback when the image is unavailable.
- Run the project test, lint, and production-build commands.
- Visually inspect gameplay at desktop and mobile sizes.
