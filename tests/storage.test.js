import assert from "node:assert/strict";
import test from "node:test";

import { readPreference, writePreference } from "../src/storage.js";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    values,
  };
}

test("new Ryku storage key takes priority over its legacy value", () => {
  const storage = memoryStorage({
    "ryku-hunt:sound": "false",
    "dragon-hunt:sound": "true",
  });

  assert.equal(readPreference("sound", "true", storage), "false");
});

test("legacy preference is copied to the new key without deleting rollback data", () => {
  const storage = memoryStorage({ "dragon-hunt:sound": "false" });

  assert.equal(readPreference("sound", "true", storage), "false");
  assert.equal(storage.values.get("ryku-hunt:sound"), "false");
  assert.equal(storage.values.get("dragon-hunt:sound"), "false");
});

test("failed storage reads return a fallback and never log stored data", () => {
  const warnings = [];
  const secretValue = "private-player-value";
  const storage = { getItem() { throw new Error(secretValue); } };

  assert.equal(readPreference("sound", "true", storage, { warn: (...args) => warnings.push(args) }), "true");
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(JSON.stringify(warnings), new RegExp(secretValue, "u"));
});

test("writes use only the new Ryku storage key", () => {
  const storage = memoryStorage();

  writePreference("sound", "false", storage);

  assert.equal(storage.values.get("ryku-hunt:sound"), "false");
  assert.equal(storage.values.has("dragon-hunt:sound"), false);
});
