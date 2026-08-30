export const ENGINE_VERSION = 1;
export const TICKS_PER_SECOND = 60;
export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 600;
export const MAX_ROUNDS = 10;
export const MAX_RUN_ACTIONS = 500;

const MODES = Object.freeze({
  A: { targetsPerWave: 1, totalWaves: 10 },
  B: { targetsPerWave: 2, totalWaves: 5 },
});

const DRAGON_KINDS = ["verdant", "ember", "storm"];

function assertSeed(seed) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
    throw new Error("seed must be an unsigned non-zero integer");
  }
}

function assertMode(mode) {
  if (!Object.hasOwn(MODES, mode)) throw new Error("mode must be A or B");
}

function nextRandom(run) {
  let value = run.rngState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  run.rngState = value >>> 0 || 0x9e3779b9;
  return run.rngState / 0x100000000;
}

function randomBetween(run, minimum, maximum) {
  return minimum + nextRandom(run) * (maximum - minimum);
}

function roundDuration(round) {
  return Math.max(150, 300 - ((round - 1) * 14));
}

export function getPassRequirement(round) {
  if (!Number.isInteger(round) || round < 1) throw new Error("round must be positive");
  return Math.min(9, 6 + Math.floor((round - 1) / 2));
}

function createTarget(run, index) {
  const fromLeft = nextRandom(run) >= 0.5;
  const width = Math.round(randomBetween(run, 92, 118));
  const height = Math.round(width * 0.7);
  return {
    id: `r${run.round}-w${run.waveIndex + 1}-t${index + 1}`,
    kind: DRAGON_KINDS[Math.floor(nextRandom(run) * DRAGON_KINDS.length)],
    startX: fromLeft ? -width : ARENA_WIDTH + width,
    endX: fromLeft ? ARENA_WIDTH + width : -width,
    baseY: randomBetween(run, 105, 390),
    amplitude: randomBetween(run, 24, 74),
    phase: randomBetween(run, 0, Math.PI * 2),
    width,
    height,
    hitbox: { x: 0.18, y: 0.16, width: 0.64, height: 0.66 },
    isHit: false,
  };
}

function createWave(run, startedAtTick) {
  const config = MODES[run.mode];
  const durationTicks = roundDuration(run.round);
  return {
    index: run.waveIndex,
    startedAtTick,
    durationTicks,
    ammo: 3,
    targets: Array.from({ length: config.targetsPerWave }, (_, index) => createTarget(run, index)),
  };
}

export function createRun({ seed, mode }) {
  assertSeed(seed);
  assertMode(mode);
  const config = MODES[mode];
  const run = {
    engineVersion: ENGINE_VERSION,
    seed,
    rngState: seed >>> 0,
    mode,
    round: 1,
    totalWaves: config.totalWaves,
    targetsInRound: 10,
    passRequirement: getPassRequirement(1),
    waveIndex: 0,
    hits: 0,
    misses: 0,
    shots: 0,
    totalHits: 0,
    totalMisses: 0,
    totalShots: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    highestRound: 1,
    status: "playing",
    lastTick: 0,
    wave: null,
  };
  run.wave = createWave(run, 0);
  return run;
}

export function getTargetPosition(target, elapsedTicks, durationTicks) {
  const progress = Math.max(0, Math.min(1, elapsedTicks / durationTicks));
  const eased = progress * progress * (3 - (2 * progress));
  return {
    x: target.startX + ((target.endX - target.startX) * eased),
    y: target.baseY + (Math.sin((progress * Math.PI * 2) + target.phase) * target.amplitude),
  };
}

function targetContains(target, point, elapsedTicks, durationTicks) {
  const position = getTargetPosition(target, elapsedTicks, durationTicks);
  const left = position.x - (target.width / 2) + (target.width * target.hitbox.x);
  const top = position.y - (target.height / 2) + (target.height * target.hitbox.y);
  return point.x >= left
    && point.x <= left + (target.width * target.hitbox.width)
    && point.y >= top
    && point.y <= top + (target.height * target.hitbox.height);
}

function hitScore(run, elapsedTicks) {
  const speedRatio = 1 - Math.min(1, elapsedTicks / run.wave.durationTicks);
  const accuracyBonus = run.wave.ammo * 100;
  const timeBonus = Math.round(speedRatio * 500);
  const comboBonus = run.combo * 75;
  return 1_000 + accuracyBonus + timeBonus + comboBonus;
}

function roundResult(run) {
  const passed = run.hits >= run.passRequirement;
  if (!passed) {
    run.status = "gameover";
    return { type: "roundComplete", passed: false, status: run.status };
  }
  if (run.round >= MAX_ROUNDS) {
    run.status = "victory";
    return { type: "roundComplete", passed: true, status: run.status };
  }
  run.status = "roundComplete";
  return { type: "roundComplete", passed: true, status: run.status };
}

function finishWave(run, actionTick) {
  const hitCount = run.wave.targets.filter((target) => target.isHit).length;
  const outcome = hitCount === 0 ? "miss" : hitCount === run.wave.targets.length ? "perfect" : "partial";
  if (outcome === "perfect") run.score += 500;
  run.waveIndex += 1;
  if (run.waveIndex >= run.totalWaves) return { ...roundResult(run), outcome };
  run.wave = createWave(run, actionTick);
  return { type: "waveComplete", outcome, waveIndex: run.waveIndex };
}

function applyShot(run, action) {
  const allowedFields = new Set(["type", "tick", "x", "y"]);
  if (Object.keys(action).some((field) => !allowedFields.has(field))) throw new Error("invalid shot fields");
  if (!Number.isFinite(action.x) || !Number.isFinite(action.y)
    || action.x < 0 || action.x > ARENA_WIDTH || action.y < 0 || action.y > ARENA_HEIGHT) {
    throw new Error("shot coordinates are outside the arena");
  }
  const elapsedTicks = action.tick - run.wave.startedAtTick;
  if (elapsedTicks > run.wave.durationTicks) throw new Error("shot tick is after wave expiry");

  run.wave.ammo -= 1;
  run.shots += 1;
  run.totalShots += 1;
  const target = run.wave.targets.find((candidate) => !candidate.isHit
    && targetContains(candidate, action, elapsedTicks, run.wave.durationTicks));

  if (target) {
    target.isHit = true;
    run.hits += 1;
    run.totalHits += 1;
    run.combo += 1;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    const score = hitScore(run, elapsedTicks);
    run.score += score;
    if (run.wave.targets.every((candidate) => candidate.isHit)) {
      return { ...finishWave(run, action.tick), hit: true, targetId: target.id, score };
    }
    return { type: "hit", targetId: target.id, score };
  }

  run.misses += 1;
  run.totalMisses += 1;
  run.combo = 0;
  if (run.wave.ammo === 0) return finishWave(run, action.tick);
  return { type: "miss" };
}

function applyExpire(run, action) {
  if (Object.keys(action).some((field) => field !== "type" && field !== "tick")) throw new Error("invalid expire fields");
  const deadline = run.wave.startedAtTick + run.wave.durationTicks;
  if (action.tick < deadline) throw new Error("expire tick is before wave deadline");
  return finishWave(run, action.tick);
}

function startNextRound(run) {
  if (run.status !== "roundComplete") throw new Error("run is not ready for the next round");
  run.round += 1;
  run.highestRound = run.round;
  run.passRequirement = getPassRequirement(run.round);
  run.waveIndex = 0;
  run.hits = 0;
  run.misses = 0;
  run.status = "playing";
  run.wave = createWave(run, run.lastTick);
  return { type: "roundStarted", round: run.round };
}

export function applyAction(run, action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) throw new Error("action is required");
  if (action.type === "nextRound") return startNextRound(run);
  if (run.status !== "playing") throw new Error("run is not playing");
  if (!Number.isInteger(action.tick) || action.tick < run.lastTick) throw new Error("action tick must be monotonic");
  run.lastTick = action.tick;
  if (action.type === "shot") return applyShot(run, action);
  if (action.type === "expire") return applyExpire(run, action);
  throw new Error("unknown action type");
}

export function replayRun({ seed, mode, actions }) {
  if (!Array.isArray(actions) || actions.length > MAX_RUN_ACTIONS) throw new Error("invalid actions");
  const run = createRun({ seed, mode });
  const events = actions.map((action) => applyAction(run, action));
  return {
    events,
    result: {
      mode: run.mode,
      score: run.score,
      highestRound: run.highestRound,
      hits: run.hits,
      shots: run.shots,
      totalHits: run.totalHits,
      totalShots: run.totalShots,
      bestCombo: run.bestCombo,
      status: run.status,
    },
  };
}
