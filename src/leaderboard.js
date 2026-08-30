const MODES = new Set(["A", "B"]);
const PERIODS = new Set(["daily", "allTime"]);

async function requestJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Invalid server response");
  }
  if (!response.ok) {
    const error = new Error(body?.error?.message ?? "Leaderboard unavailable");
    error.code = body?.error?.code ?? "REQUEST_FAILED";
    throw error;
  }
  if (!body?.data || typeof body.data !== "object") throw new Error("Invalid server response");
  return body.data;
}

function validChallenge(data, mode) {
  return typeof data.runId === "string"
    && typeof data.token === "string"
    && data.token.length >= 16
    && Number.isInteger(data.seed)
    && data.seed >= 1
    && data.seed <= 0xffffffff
    && data.mode === mode
    && Number.isInteger(data.engineVersion)
    && typeof data.expiresAt === "string";
}

function validEntry(entry) {
  return entry
    && Number.isInteger(entry.rank)
    && typeof entry.username === "string"
    && Number.isFinite(entry.score)
    && Number.isInteger(entry.highestRound)
    && Number.isFinite(entry.accuracy);
}

export function createLeaderboardService(fetchImpl = globalThis.fetch.bind(globalThis)) {
  return {
    async start({ mode }) {
      if (!MODES.has(mode)) throw new Error("Invalid mode");
      const data = await requestJson(fetchImpl, "./api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!validChallenge(data, mode)) throw new Error("Invalid challenge response");
      return data;
    },

    async submit({ username, token, actions }) {
      if (!Array.isArray(actions)) throw new Error("Invalid actions");
      const data = await requestJson(fetchImpl, "./api/runs/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, token, actions }),
      });
      if (data.verified !== true || !Number.isFinite(data.score)) throw new Error("Invalid submission response");
      return data;
    },

    async list({ mode = "A", period = "daily", limit = 10 } = {}) {
      if (!MODES.has(mode) || !PERIODS.has(period) || !Number.isInteger(limit) || limit < 1 || limit > 50) {
        throw new Error("Invalid leaderboard filters");
      }
      const query = new URLSearchParams({ mode, period, limit: String(limit) });
      const data = await requestJson(fetchImpl, `./api/leaderboard?${query}`, { headers: { accept: "application/json" } });
      if (!Array.isArray(data.entries) || !data.entries.every(validEntry)) throw new Error("Invalid leaderboard response");
      return data;
    },
  };
}
