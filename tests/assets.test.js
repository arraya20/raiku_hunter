import assert from "node:assert/strict";
import test from "node:test";

import { ARENA_BACKGROUND, CHARACTER_MANIFEST, characterForKind } from "../src/assets.js";
import { clientPointToArena } from "../src/renderer.js";

test("every replaceable character has image, sprite, and normalized hitbox metadata", () => {
  for (const character of Object.values(CHARACTER_MANIFEST)) {
    assert.match(character.image, /^\.\/assets\//u);
    assert.ok(character.sprite.frames >= 1);
    assert.ok(character.sprite.frameWidth > 0);
    assert.ok(character.sprite.frameHeight > 0);
    assert.ok(character.hitbox.x >= 0 && character.hitbox.x <= 1);
    assert.ok(character.hitbox.y >= 0 && character.hitbox.y <= 1);
    assert.ok(character.hitbox.width > 0 && character.hitbox.width <= 1);
    assert.ok(character.hitbox.height > 0 && character.hitbox.height <= 1);
  }
});

test("unknown character kinds use a safe fallback", () => {
  assert.equal(characterForKind("missing"), CHARACTER_MANIFEST.verdant);
});

test("every Ryku target profile uses the approved transparent game sprite", () => {
  for (const kind of ["verdant", "ember", "storm"]) {
    assert.equal(CHARACTER_MANIFEST[kind].image, "./assets/ryku/ryku-game.png");
    assert.deepEqual(CHARACTER_MANIFEST[kind].sprite, {
      frames: 1,
      frameWidth: 1607,
      frameHeight: 979,
      fps: 8,
    });
  }
});

test("responsive pointer coordinates map into fixed arena coordinates", () => {
  const point = clientPointToArena({ clientX: 260, clientY: 170 }, {
    left: 20,
    top: 20,
    width: 480,
    height: 300,
  });

  assert.deepEqual(point, { x: 480, y: 300 });
});

test("gameplay jungle background is registered as a local replaceable asset", () => {
  assert.deepEqual(ARENA_BACKGROUND, {
    id: "arenaBackground",
    image: "./assets/backgrounds/ryku-jungle.png",
  });
});
