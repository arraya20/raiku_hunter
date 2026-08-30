const DEMO_RANKINGS = [
  { username: "LimeTalon", score: 82400, highestRound: 9, accuracy: 91 },
  { username: "NightWyrm", score: 75120, highestRound: 8, accuracy: 88 },
  { username: "MossScout", score: 68350, highestRound: 8, accuracy: 84 },
  { username: "EchoDrake", score: 59700, highestRound: 7, accuracy: 82 },
  { username: "WildRaptor", score: 51440, highestRound: 6, accuracy: 79 },
];

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];

export function formatScore(value, padded = false) {
  const score = Math.max(0, Math.round(Number(value) || 0));
  return padded ? String(score).padStart(6, "0") : score.toLocaleString("en-US");
}

export function accuracyFor(run) {
  return run.totalShots ? Math.round((run.totalHits / run.totalShots) * 100) : 0;
}

export function announce(message) {
  const region = $("#announcer");
  region.textContent = "";
  requestAnimationFrame(() => { region.textContent = message; });
}

export function showScreen(name) {
  let active;
  for (const screen of $$('[data-screen]')) {
    const isActive = screen.dataset.screen === name;
    screen.classList.toggle("is-active", isActive);
    screen.setAttribute("aria-hidden", String(!isActive));
    if (isActive) active = screen;
  }
  active?.querySelector("h1, h2, canvas, button, input")?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
  announce(`${name.replaceAll("-", " ")} screen`);
}

export function renderOperator(username) {
  $("#operator-badge").hidden = !username;
  $("#operator-name").textContent = username;
}

export function renderBriefing(mode) {
  const dual = mode === "B";
  $("#briefing-mode").textContent = `GAME ${mode}`;
  $("#briefing-title").textContent = dual ? "Dual Signal" : "Solo Flight";
  $("#briefing-copy").textContent = dual
    ? "Two signals break cover together. Three shots. Prioritize fast."
    : "One signal at a time. Track the path and make every round count.";
  showScreen("briefing");
}

export function renderHud(run) {
  $("#hud-mode").textContent = `GAME ${run.mode}`;
  $("#round-number").textContent = String(run.round).padStart(2, "0");
  $("#round-hits").textContent = String(run.hits);
  $("#round-pass").textContent = String(run.passRequirement);
  $("#wave-number").textContent = String(run.waveIndex + 1).padStart(2, "0");
  $("#wave-total").textContent = String(run.totalWaves).padStart(2, "0");
  $("#score").textContent = formatScore(run.score, true);
  $("#combo").textContent = `× ${run.combo}`;
  $("#accuracy").textContent = run.totalShots ? `${accuracyFor(run)}%` : "—";
  $("#hit-progress").style.width = `${Math.min(100, (run.hits / run.passRequirement) * 100)}%`;

  const ammo = $("#ammo-display");
  ammo.replaceChildren(...Array.from({ length: 3 }, (_, index) => {
    const bullet = document.createElement("i");
    bullet.classList.toggle("is-spent", index >= run.wave.ammo);
    return bullet;
  }));
  ammo.parentElement.setAttribute("aria-label", `${run.wave.ammo} bullets remaining`);
}

export function renderTimer(run, tick) {
  if (!run?.wave) return;
  const elapsed = tick - run.wave.startedAtTick;
  const remaining = Math.max(0, 1 - (elapsed / run.wave.durationTicks));
  $("#wave-timer").style.width = `${remaining * 100}%`;
}

export function intermissionDelay(outcome, reducedMotion = false) {
  if (reducedMotion) return 150;
  return outcome === "miss" ? 1_150 : 250;
}

export function showCompanion(outcome) {
  const companion = $("#companion-event");
  if (outcome !== "miss") {
    companion.hidden = true;
    return;
  }
  $("#companion-message").textContent = "HEH-HEH! SIGNAL LOST!";
  companion.hidden = false;
}

export function hideCompanion() {
  $("#companion-event").hidden = true;
}

export function renderRoundResult(run) {
  $("#result-round").textContent = String(run.round).padStart(2, "0");
  $("#result-score").textContent = formatScore(run.score);
  $("#result-hits").textContent = `${run.hits}/10`;
  $("#result-accuracy").textContent = `${accuracyFor(run)}%`;
  $("#result-combo").textContent = `×${run.bestCombo}`;
  showScreen("round-result");
}

export function renderGameOver(run) {
  const victory = run.status === "victory";
  $("#gameover-title").textContent = victory ? "The whole canopy is clear." : "The canopy went quiet.";
  $("#gameover-copy").textContent = victory
    ? "Every sector answered. Your signal run is complete."
    : "Recalibrate your aim and return to the hunt.";
  $("#final-score").textContent = formatScore(run.score);
  $("#final-round").textContent = String(run.highestRound).padStart(2, "0");
  $("#final-hits").textContent = String(run.totalHits);
  $("#final-accuracy").textContent = `${accuracyFor(run)}%`;
  showScreen("gameover");
}

function rankingItem(entry, index) {
  const item = document.createElement("li");
  const rank = document.createElement("span");
  const hunter = document.createElement("span");
  const detail = document.createElement("small");
  const points = document.createElement("span");
  rank.className = "rank";
  hunter.className = "hunter";
  points.className = "points";
  rank.textContent = String(entry.rank ?? index + 1).padStart(2, "0");
  hunter.textContent = entry.username;
  detail.textContent = `ROUND ${String(entry.highestRound).padStart(2, "0")} · ${Math.round(entry.accuracy)}%`;
  hunter.append(detail);
  points.textContent = formatScore(entry.score);
  item.append(rank, hunter, points);
  return item;
}

export function renderRankings(entries = DEMO_RANKINGS, { live = false } = {}) {
  const rows = entries.length ? entries : DEMO_RANKINGS;
  $("#home-ranking").replaceChildren(...rows.slice(0, 5).map(rankingItem));
  $("#full-ranking").replaceChildren(...rows.map(rankingItem));
  $("#home-ranking-status").textContent = live ? "LIVE · VERIFIED" : "DEMO · OFFLINE";
  $("#leaderboard-status").textContent = live ? "LIVE · VERIFIED" : "DEMO · OFFLINE";
}

export function updateFilters({ mode, period }) {
  for (const button of $$('[data-filter-mode]')) button.classList.toggle("is-active", button.dataset.filterMode === mode);
  for (const button of $$('[data-filter-period]')) button.classList.toggle("is-active", button.dataset.filterPeriod === period);
}
