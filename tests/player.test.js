import assert from "node:assert/strict";
import test from "node:test";

import {
  createRandomUsername, loadUsername, saveUsername, validateUsername,
} from "../src/player.js";

test("username accepts only 3-16 ASCII letters, numbers, or underscores", () => {
  assert.deepEqual(validateUsername("  Ember_7 "), { valid: true, value: "Ember_7" });
  assert.equal(validateUsername("<dragon>").valid, false);
  assert.equal(validateUsername("ab").valid, false);
  assert.equal(validateUsername("naga panjang sekali").valid, false);
});

test("random usernames always satisfy validation", () => {
  for (let index = 0; index < 100; index += 1) {
    assert.equal(validateUsername(createRandomUsername()).valid, true);
  }
});

test("username storage migrates legacy players and writes new Ryku keys", () => {
  const values = new Map([["dragon-hunt:username", "LegacyHunter7"]]);
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };

  assert.equal(loadUsername(storage), "LegacyHunter7");
  assert.equal(values.get("ryku-hunt:username"), "LegacyHunter7");
  saveUsername("NewHunter8", storage);
  assert.equal(values.get("ryku-hunt:username"), "NewHunter8");
});
