import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("page exposes the complete accessible Game A/B flow", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /data-screen="home"/u);
  assert.match(html, /data-mode="A"/u);
  assert.match(html, /data-mode="B"/u);
  assert.match(html, /id="game-canvas"[^>]+aria-label=/u);
  assert.match(html, /data-screen="round-result"/u);
  assert.match(html, /data-screen="gameover"/u);
  assert.match(html, /data-screen="leaderboard"/u);
  assert.match(html, /id="username"/u);
  assert.match(html, /data-action="randomize"/u);
  assert.match(html, /RYKU <b>HUNT<\/b>/u);
  assert.match(html, /Eyes up\.<br><em>Ryku is coming!<\/em>/u);
  assert.match(html, /HUNTER USERNAME/u);
  assert.doesNotMatch(html, />OPERATOR USERNAME</u);
  assert.equal(html.match(/assets\/ryku\/ryku-game\.png/gu)?.length, 4);
});

test("page loads only same-origin scripts, styles, and images", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//u);
});

test("gameplay waits for Ryku canvas images before opening the arena", async () => {
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

  assert.match(main, /const gameplayImagesReady = loadCharacterImages\(\)/u);
  assert.match(main, /async function startGame\(\)[\s\S]*?await gameplayImagesReady;/u);
});

test("firing snapshots a target before mutation and advances falling effects", async () => {
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

  assert.match(main, /const targetSnapshots = snapshotActiveTargets\(run\.wave, tick\);[\s\S]*?const event = applyAction\(run, action\);/u);
  assert.match(main, /fallingEffectForHit\(event, targetSnapshots, \{ reducedMotion \}\)/u);
  assert.match(main, /effects = advanceVisualEffects\(effects, delta\);/u);
});
