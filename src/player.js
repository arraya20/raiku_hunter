import { readPreference, writePreference } from "./storage.js";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/u;
const ADJECTIVES = ["Neon", "Swift", "Moss", "Night", "Lime", "Wild", "Echo", "Solar"];
const CREATURES = ["Drake", "Gecko", "Raptor", "Wyrm", "Scout", "Hunter", "Talon", "Glider"];

export function validateUsername(input) {
  const value = typeof input === "string" ? input.trim() : "";
  return { valid: USERNAME_PATTERN.test(value), value };
}

export function createRandomUsername(random = Math.random) {
  const adjective = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)];
  const creature = CREATURES[Math.floor(random() * CREATURES.length)];
  const suffix = Math.floor(random() * 900) + 100;
  return `${adjective}${creature}${suffix}`.slice(0, 16);
}

export function loadUsername(storage = globalThis.localStorage, logger = console) {
  const stored = readPreference("username", "", storage, logger);
  return validateUsername(stored).valid ? stored : "";
}

export function saveUsername(username, storage = globalThis.localStorage, logger = console) {
  const result = validateUsername(username);
  if (!result.valid) throw new Error("invalid username");
  writePreference("username", result.value, storage, logger);
  return result.value;
}
