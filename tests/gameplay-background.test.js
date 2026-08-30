import assert from "node:assert/strict";
import test from "node:test";

import { ArenaRenderer, coverCrop } from "../src/renderer.js";

test("cover crop fills a wide arena without stretching a taller image", () => {
  assert.deepEqual(coverCrop(1600, 1200, 960, 600), {
    sx: 0,
    sy: 100,
    sw: 1600,
    sh: 1000,
  });
});

test("arena draws the jungle image before applying its readability overlay", () => {
  const calls = [];
  const context = new Proxy({
    clearRect(...arguments_) { calls.push(["clearRect", ...arguments_]); },
    drawImage(...arguments_) { calls.push(["drawImage", ...arguments_]); },
    fillRect(...arguments_) { calls.push(["fillRect", this.fillStyle, ...arguments_]); },
  }, {
    get(target, property) {
      if (property in target) return target[property];
      return () => {};
    },
  });
  const background = { naturalWidth: 1448, naturalHeight: 1086 };
  const arena = new ArenaRenderer({ getContext: () => context }, { arenaBackground: background });

  arena.draw(null, 0, null);

  const backgroundCall = calls.findIndex(([name, image]) => name === "drawImage" && image === background);
  const overlayCall = calls.findIndex(([name, fillStyle]) => name === "fillRect"
    && fillStyle === "rgba(2, 18, 12, 0.2)");
  assert.ok(backgroundCall >= 0);
  assert.ok(overlayCall > backgroundCall);
  assert.deepEqual(calls[backgroundCall].slice(2), [0, 90.5, 1448, 905, 0, 0, 960, 600]);
});
