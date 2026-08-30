import { loadCharacterImages } from "./assets.js";
import { GameFeedback } from "./feedback.js";
import { ARENA_HEIGHT, ARENA_WIDTH, TICKS_PER_SECOND, applyAction, createRun } from "./game.js";
import { createLeaderboardService } from "./leaderboard.js";
import { createRandomUsername, loadUsername, saveUsername, validateUsername } from "./player.js";
import { readPreference, writePreference } from "./storage.js";
import {
  ArenaRenderer, advanceVisualEffects, clientPointToArena, fallingEffectForHit, snapshotActiveTargets,
} from "./renderer.js";
import {
  $, $$, announce, hideCompanion, intermissionDelay, renderBriefing, renderGameOver, renderHud, renderOperator,
  renderRankings, renderRoundResult, renderTimer, showCompanion, showScreen, updateFilters,
} from "./ui.js";

const canvas = $("#game-canvas");
const feedback = new GameFeedback();
const leaderboard = createLeaderboardService();
const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

let selectedMode = "A";
let username = loadUsername();
let run = null;
let renderer = new ArenaRenderer(canvas);
const gameplayImagesReady = loadCharacterImages().then((images) => {
  renderer = new ArenaRenderer(canvas, images);
});
let challenge = null;
let challengePromise = null;
let actions = [];
let pointer = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
let effects = [];
let simulationTick = 0;
let previousFrame = 0;
let gameActive = false;
let paused = false;
let intermission = false;
let intermissionTimer = null;
let leaderboardMode = "A";
let leaderboardPeriod = "daily";

function offlineSeed() {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] || 1;
}

function updateUsernameField({ touched = false } = {}) {
  const input = $("#username");
  const result = validateUsername(input.value);
  const message = touched && !result.valid ? "Use 3–16 letters, numbers, or underscores." : "";
  $("#username-error").textContent = message;
  input.setAttribute("aria-invalid", String(Boolean(message)));
  renderOperator(result.valid ? result.value : username);
  return result;
}

function acceptUsername() {
  const result = updateUsernameField({ touched: true });
  if (!result.valid) {
    $("#username").focus();
    return false;
  }
  username = saveUsername(result.value);
  renderOperator(username);
  return true;
}

function requestChallenge(mode) {
  challengePromise = leaderboard.start({ mode }).catch(() => {
    console.warn("Leaderboard challenge unavailable; using offline mode.");
    return null;
  });
  return challengePromise;
}

function chooseMode(mode) {
  if (!acceptUsername()) return;
  selectedMode = mode;
  challenge = null;
  requestChallenge(mode);
  renderBriefing(mode);
}

async function startGame() {
  if (!acceptUsername()) {
    showScreen("home");
    return;
  }
  feedback.unlock();
  await gameplayImagesReady;
  challenge = await (challengePromise ?? requestChallenge(selectedMode));
  challengePromise = null;
  run = createRun({ seed: challenge?.seed ?? offlineSeed(), mode: selectedMode });
  actions = [];
  effects = [];
  simulationTick = 0;
  previousFrame = performance.now();
  paused = false;
  intermission = false;
  gameActive = true;
  $("#pause-overlay").hidden = true;
  $("#submission-status").textContent = challenge ? "VERIFIED RUN ACTIVE" : "OFFLINE RUN · SCORE WILL NOT SUBMIT";
  renderHud(run);
  renderTimer(run, simulationTick);
  showScreen("game");
  canvas.focus({ preventScroll: true });
  announce(`Game ${selectedMode}, round one. Three bullets ready.`);
}

function setPaused(nextPaused) {
  if (!gameActive || intermission) return;
  paused = nextPaused;
  $("#pause-overlay").hidden = !paused;
  previousFrame = performance.now();
  announce(paused ? "Game paused" : "Game resumed");
}

function effectAt(type, point) {
  effects.push({ type, x: point.x, y: point.y, life: 1 });
}

function afterIntermission(event) {
  hideCompanion();
  intermission = false;
  previousFrame = performance.now();
  if (event.type === "roundComplete") {
    gameActive = false;
    if (event.passed && run.status === "roundComplete") renderRoundResult(run);
    else finishRun();
    return;
  }
  renderHud(run);
  announce(`Wave ${run.waveIndex + 1}. Three bullets ready.`);
}

function handleResolution(event, point = pointer) {
  if (event.hit) {
    feedback.play("hit");
    feedback.vibrate(18);
    effectAt("hit", point);
  } else if (event.type === "miss") {
    feedback.play("miss");
    effectAt("miss", point);
  }

  if (event.type !== "waveComplete" && event.type !== "roundComplete") {
    renderHud(run);
    return;
  }
  intermission = true;
  feedback.play(event.outcome === "miss" ? "miss" : "clear");
  showCompanion(event.outcome);
  announce(event.outcome === "miss" ? "All targets escaped" : "Signal secured");
  clearTimeout(intermissionTimer);
  intermissionTimer = setTimeout(() => afterIntermission(event), intermissionDelay(event.outcome, reducedMotion));
}

function fire(point = pointer) {
  if (!run || run.status !== "playing" || paused || intermission) return;
  feedback.unlock();
  const deadline = run.wave.startedAtTick + run.wave.durationTicks;
  const tick = Math.max(run.lastTick, Math.floor(simulationTick));
  if (tick > deadline) {
    expireWave(deadline);
    return;
  }
  const action = { type: "shot", tick, x: Math.round(point.x), y: Math.round(point.y) };
  const targetSnapshots = snapshotActiveTargets(run.wave, tick);
  try {
    const event = applyAction(run, action);
    const fallingEffect = fallingEffectForHit(event, targetSnapshots, { reducedMotion });
    if (fallingEffect) effects.push(fallingEffect);
    actions.push(action);
    feedback.play("shot");
    handleResolution(event, point);
  } catch {
    console.warn("Shot resolution failed.");
    announce("Shot could not be resolved");
  }
}

function expireWave(tick) {
  if (!run || run.status !== "playing" || intermission) return;
  const action = { type: "expire", tick };
  try {
    const event = applyAction(run, action);
    actions.push(action);
    handleResolution(event);
  } catch {
    console.warn("Run synchronization failed.");
    gameActive = false;
    announce("Run synchronization stopped");
  }
}

function continueRun() {
  const action = { type: "nextRound" };
  applyAction(run, action);
  actions.push(action);
  simulationTick = run.lastTick;
  previousFrame = performance.now();
  gameActive = true;
  renderHud(run);
  showScreen("game");
  canvas.focus({ preventScroll: true });
  announce(`Round ${run.round}. Hit ${run.passRequirement} of ten targets to advance.`);
}

async function submitRun() {
  const status = $("#submission-status");
  if (!challenge?.token) {
    status.textContent = "OFFLINE RUN · NOT SUBMITTED";
    return;
  }
  status.textContent = "VERIFYING RUN…";
  try {
    const result = await leaderboard.submit({ username, token: challenge.token, actions });
    status.textContent = `VERIFIED · ${Math.round(result.score).toLocaleString("en-US")} POINTS`;
    announce("Verified score submitted");
  } catch (error) {
    status.textContent = error.code === "RUN_EXPIRED" ? "RUN EXPIRED · NOT SUBMITTED" : "SUBMISSION UNAVAILABLE · TRY AGAIN LATER";
  }
}

function finishRun() {
  gameActive = false;
  renderGameOver(run);
  submitRun();
}

function goHome() {
  gameActive = false;
  paused = false;
  intermission = false;
  clearTimeout(intermissionTimer);
  hideCompanion();
  showScreen("home");
}

async function loadLeaderboard() {
  updateFilters({ mode: leaderboardMode, period: leaderboardPeriod });
  $("#leaderboard-status").textContent = "LOADING VERIFIED SIGNALS…";
  try {
    const result = await leaderboard.list({ mode: leaderboardMode, period: leaderboardPeriod, limit: 10 });
    renderRankings(result.entries, { live: true });
  } catch {
    console.warn("Leaderboard loading failed.");
    renderRankings();
  }
}

function openLeaderboard() {
  gameActive = false;
  showScreen("leaderboard");
  loadLeaderboard();
}

function handleAction(action) {
  if (action === "home") goHome();
  if (action === "start") startGame();
  if (action === "pause") setPaused(!paused);
  if (action === "continue") continueRun();
  if (action === "retry") startGame();
  if (action === "leaderboard") openLeaderboard();
  if (action === "randomize") {
    $("#username").value = createRandomUsername();
    updateUsernameField();
    $("#username").focus();
  }
  if (action === "sound") {
    feedback.setEnabled(!feedback.enabled);
    writePreference("sound", String(feedback.enabled));
    $("[data-action='sound']").textContent = feedback.enabled ? "♪" : "×";
    $("[data-action='sound']").setAttribute("aria-label", feedback.enabled ? "Mute sound" : "Enable sound");
  }
}

function animate(frameTime) {
  const delta = Math.min(50, Math.max(0, frameTime - previousFrame));
  previousFrame = frameTime;
  if (gameActive && run && !paused && !intermission) {
    simulationTick += (delta / 1_000) * TICKS_PER_SECOND;
    const deadline = run.wave.startedAtTick + run.wave.durationTicks;
    if (simulationTick >= deadline) {
      simulationTick = deadline;
      expireWave(deadline);
    }
  }
  effects = advanceVisualEffects(effects, delta);
  if (run) {
    renderer.draw(run, simulationTick, pointer, effects);
    renderTimer(run, simulationTick);
  }
  requestAnimationFrame(animate);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action) handleAction(button.dataset.action);
  if (button.dataset.mode) chooseMode(button.dataset.mode);
  if (button.dataset.filterMode) {
    leaderboardMode = button.dataset.filterMode;
    loadLeaderboard();
  }
  if (button.dataset.filterPeriod) {
    leaderboardPeriod = button.dataset.filterPeriod;
    loadLeaderboard();
  }
});

$("#username").addEventListener("input", () => updateUsernameField({ touched: true }));
$("#identity-form").addEventListener("submit", (event) => event.preventDefault());

canvas.addEventListener("pointermove", (event) => {
  pointer = clientPointToArena(event, canvas.getBoundingClientRect());
});
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  pointer = clientPointToArena(event, canvas.getBoundingClientRect());
  fire(pointer);
});

document.addEventListener("keydown", (event) => {
  if (!$("[data-screen='game']").classList.contains("is-active")) return;
  const movement = 28;
  if (["ArrowLeft", "a", "A"].includes(event.key)) pointer.x = Math.max(0, pointer.x - movement);
  else if (["ArrowRight", "d", "D"].includes(event.key)) pointer.x = Math.min(ARENA_WIDTH, pointer.x + movement);
  else if (["ArrowUp", "w", "W"].includes(event.key)) pointer.y = Math.max(0, pointer.y - movement);
  else if (["ArrowDown", "s", "S"].includes(event.key)) pointer.y = Math.min(ARENA_HEIGHT, pointer.y + movement);
  else if (event.code === "Space") fire(pointer);
  else if (["p", "P", "Escape"].includes(event.key)) setPaused(!paused);
  else return;
  event.preventDefault();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameActive && !paused) setPaused(true);
});

feedback.setEnabled(readPreference("sound", "true") !== "false");
$("[data-action='sound']").textContent = feedback.enabled ? "♪" : "×";
$("#username").value = username || createRandomUsername();
updateUsernameField();
renderRankings();
requestAnimationFrame((time) => { previousFrame = time; animate(time); });
