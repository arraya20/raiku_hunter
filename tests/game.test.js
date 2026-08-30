import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  createRun,
  getPassRequirement,
  getTargetPosition,
  replayRun,
} from "../src/game.js";

test("Game A creates ten one-dragon waves", () => {
  const run = createRun({ seed: 123, mode: "A" });

  assert.equal(run.totalWaves, 10);
  assert.equal(run.wave.targets.length, 1);
  assert.equal(run.wave.ammo, 3);
  assert.equal(run.targetsInRound, 10);
});

test("Game B creates five two-dragon waves", () => {
  const run = createRun({ seed: 123, mode: "B" });

  assert.equal(run.totalWaves, 5);
  assert.equal(run.wave.targets.length, 2);
  assert.equal(run.wave.ammo, 3);
  assert.equal(run.targetsInRound, 10);
});

test("a shot inside a moving target records a hit and score", () => {
  const run = createRun({ seed: 77, mode: "B" });
  const target = run.wave.targets[0];
  const elapsedTicks = Math.floor(run.wave.durationTicks / 2);
  const tick = run.wave.startedAtTick + elapsedTicks;
  const position = getTargetPosition(target, elapsedTicks, run.wave.durationTicks);

  const event = applyAction(run, { type: "shot", tick, x: position.x, y: position.y });

  assert.equal(event.type, "hit");
  assert.equal(run.hits, 1);
  assert.equal(run.wave.ammo, 2);
  assert.ok(run.score >= 1_000);
});

test("three missed shots end a wave and reload the next wave", () => {
  const run = createRun({ seed: 5, mode: "A" });

  applyAction(run, { type: "shot", tick: 1, x: 10, y: 590 });
  applyAction(run, { type: "shot", tick: 2, x: 10, y: 590 });
  const event = applyAction(run, { type: "shot", tick: 3, x: 10, y: 590 });

  assert.equal(event.type, "waveComplete");
  assert.equal(event.outcome, "miss");
  assert.equal(run.waveIndex, 1);
  assert.equal(run.wave.ammo, 3);
});

test("pass requirement starts at six and caps at nine", () => {
  assert.equal(getPassRequirement(1), 6);
  assert.equal(getPassRequirement(3), 7);
  assert.equal(getPassRequirement(99), 9);
});

test("replay is deterministic and rejects decreasing ticks", () => {
  const first = createRun({ seed: 42, mode: "A" });
  const tick = Math.floor(first.wave.durationTicks / 2);
  const position = getTargetPosition(first.wave.targets[0], tick, first.wave.durationTicks);
  const actions = [{ type: "shot", tick, x: position.x, y: position.y }];

  assert.deepEqual(replayRun({ seed: 42, mode: "A", actions }), replayRun({ seed: 42, mode: "A", actions }));
  assert.throws(() => replayRun({
    seed: 42,
    mode: "A",
    actions: [
      { type: "shot", tick, x: position.x, y: position.y },
      { type: "shot", tick: tick - 1, x: position.x, y: position.y },
    ],
  }), /tick/u);
});

test("verified statistics remain cumulative when the next round starts", () => {
  const run = createRun({ seed: 901, mode: "A" });

  for (let waveIndex = 0; waveIndex < 10; waveIndex += 1) {
    const elapsed = Math.floor(run.wave.durationTicks / 2);
    const tick = run.wave.startedAtTick + elapsed;
    if (waveIndex < 6) {
      const position = getTargetPosition(run.wave.targets[0], elapsed, run.wave.durationTicks);
      applyAction(run, { type: "shot", tick, x: position.x, y: position.y });
    } else {
      applyAction(run, { type: "shot", tick, x: 5, y: 595 });
      applyAction(run, { type: "shot", tick: tick + 1, x: 5, y: 595 });
      applyAction(run, { type: "shot", tick: tick + 2, x: 5, y: 595 });
    }
  }

  assert.equal(run.status, "roundComplete");
  assert.equal(run.totalHits, 6);
  assert.equal(run.totalShots, 18);
  applyAction(run, { type: "nextRound" });
  assert.equal(run.round, 2);
  assert.equal(run.hits, 0);
  assert.equal(run.totalHits, 6);
});
