const CURRENT_PREFIX = "ryku-hunt:";
const LEGACY_PREFIX = "dragon-hunt:";

function warn(logger, message) {
  logger?.warn?.(message);
}

export function readPreference(name, fallback, storage = globalThis.localStorage, logger = console) {
  if (!storage) return fallback;
  let current;
  try {
    current = storage.getItem(`${CURRENT_PREFIX}${name}`);
  } catch {
    warn(logger, "Preference storage read failed.");
    return fallback;
  }
  if (current !== null) return current;

  let legacy;
  try {
    legacy = storage.getItem(`${LEGACY_PREFIX}${name}`);
  } catch {
    warn(logger, "Legacy preference storage read failed.");
    return fallback;
  }
  if (legacy === null) return fallback;

  try {
    storage.setItem(`${CURRENT_PREFIX}${name}`, legacy);
  } catch {
    warn(logger, "Preference storage migration failed.");
  }
  return legacy;
}

export function writePreference(name, value, storage = globalThis.localStorage, logger = console) {
  if (!storage) return;
  try {
    storage.setItem(`${CURRENT_PREFIX}${name}`, value);
  } catch {
    warn(logger, "Preference storage write failed.");
  }
}
