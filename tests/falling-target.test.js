import assert from "node:assert/strict";
import test from "node:test";

import * as renderer from "../src/renderer.js";

const movingTarget = {
  id: "target-1",
  kind: "verdant",
  startX: 0,
  endX: 100,
  baseY: 120,
  amplitude: 0,
  phase: 0,
  width: 100,
  height: 70,
  isHit: false,
};

test("active target snapshots preserve the hit-time visual state", () => {
  assert.equal(typeof renderer.snapshotActiveTargets, "function");
  const snapshots = renderer.snapshotActiveTargets({
    startedAtTick: 0,
    durationTicks: 100,
    targets: [movingTarget, { ...movingTarget, id: "target-2", isHit: true }],
  }, 50);

  assert.deepEqual(snapshots, [{
    id: "target-1",
    kind: "verdant",
    x: 50,
    y: 120,
    width: 100,
    height: 70,
    direction: 1,
  }]);
});

test("falling target accelerates downward, spins, and fades", () => {
  assert.equal(typeof renderer.createFallingTargetEffect, "function");
  assert.equal(typeof renderer.advanceVisualEffects, "function");
  assert.equal(typeof renderer.fallingTargetFrame, "function");
  const effect = renderer.createFallingTargetEffect({
    id: "target-1", kind: "verdant", x: 100, y: 120, width: 100, height: 70, direction: 1,
  });

  assert.equal(effect.duration, 600);
  const halfway = renderer.advanceVisualEffects([effect], 300)[0];
  const halfwayFrame = renderer.fallingTargetFrame(halfway);
  assert.ok(halfwayFrame.x > 100);
  assert.ok(halfwayFrame.y > 120);
  assert.ok(halfwayFrame.rotation > 0);
  assert.equal(halfwayFrame.alpha, 1);

  const fading = renderer.advanceVisualEffects([effect], 540)[0];
  assert.ok(renderer.fallingTargetFrame(fading).alpha < 0.5);
  assert.deepEqual(renderer.advanceVisualEffects([effect], 600), []);
});

test("reduced motion shortens the fall and limits rotation", () => {
  assert.equal(typeof renderer.createFallingTargetEffect, "function");
  assert.equal(typeof renderer.fallingTargetFrame, "function");
  const normal = renderer.createFallingTargetEffect({ ...movingTarget, x: 50, y: 120, direction: -1 });
  const reduced = renderer.createFallingTargetEffect(
    { ...movingTarget, x: 50, y: 120, direction: -1 },
    { reducedMotion: true },
  );

  assert.equal(reduced.duration, 300);
  assert.ok(Math.abs(renderer.fallingTargetFrame({ ...reduced, age: 150 }).rotation)
    < Math.abs(renderer.fallingTargetFrame({ ...normal, age: 300 }).rotation));
});

test("hit result selects only its matching target snapshot", () => {
  assert.equal(typeof renderer.fallingEffectForHit, "function");
  const snapshots = [
    { id: "target-1", kind: "verdant", x: 10, y: 20, width: 100, height: 70, direction: 1 },
    { id: "target-2", kind: "storm", x: 30, y: 40, width: 90, height: 63, direction: -1 },
  ];

  assert.equal(renderer.fallingEffectForHit({ hit: true, targetId: "target-2" }, snapshots).id, "target-2");
  assert.equal(renderer.fallingEffectForHit({ type: "miss" }, snapshots), null);
});

test("arena renderer draws a falling target with rotation", () => {
  const calls = [];
  const context = new Proxy({
    createLinearGradient() { return { addColorStop() {} }; },
    drawImage(...arguments_) { calls.push(["drawImage", ...arguments_]); },
    rotate(value) { calls.push(["rotate", value]); },
  }, {
    get(target, property) {
      if (property in target) return target[property];
      return () => {};
    },
  });
  const image = { id: "ryku-image" };
  const arena = new renderer.ArenaRenderer({ getContext: () => context }, { verdant: image });
  const effect = {
    type: "fallingTarget", id: "target-1", kind: "verdant", x: 100, y: 120,
    width: 100, height: 70, direction: 1, age: 300, duration: 600, spin: Math.PI * 3,
  };

  arena.draw(null, 0, null, [effect]);

  assert.ok(calls.some(([name, value]) => name === "rotate" && value > 0));
  assert.ok(calls.some(([name, value]) => name === "drawImage" && value === image));
});
