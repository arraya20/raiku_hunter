import assert from "node:assert/strict";
import test from "node:test";

import {
  handleListLeaderboard,
  handleStartRun,
  handleSubmitRun,
  validateRunPayload,
} from "../server/leaderboard-api.js";

const RUN_ID = "5a6a88fc-0ec8-4e31-8f16-72b452fb1f52";
const RUN_SECRET = "test-only-dragon-hunt-signing-secret-32-bytes";
const TERMINAL_ACTIONS = Array.from({ length: 30 }, (_, index) => ({
  type: "shot",
  tick: index + 1,
  x: 5,
  y: 595,
}));

function createDb({ changes = 1, results = [], existingHash = null, fail = false } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) { call.bindings = bindings; return this; },
        async run() {
          if (fail) throw new Error("private D1 failure");
          return { success: true, meta: { changes } };
        },
        async all() {
          if (fail) throw new Error("private D1 failure");
          return { success: true, results };
        },
        async first() {
          if (fail) throw new Error("private D1 failure");
          if (/rate_limits/u.test(sql)) return { count: 1 };
          return existingHash ? { transcriptHash: existingHash } : null;
        },
      };
    },
  };
}

async function issueRun(overrides = {}) {
  const db = overrides.env?.DB ?? createDb();
  const response = await handleStartRun({
    request: new Request("https://hunt.example/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.8" },
      body: JSON.stringify({ mode: "A" }),
    }),
    env: { DB: db, RUN_SIGNING_SECRET: RUN_SECRET, ...overrides.env },
    now: () => new Date("2026-08-28T00:00:00.000Z"),
    randomUUID: () => RUN_ID,
    randomSeed: () => 20260828,
    ...overrides,
  });
  assert.equal(response.status, 201);
  return (await response.json()).data;
}

test("start issues a mode-bound signed challenge", async () => {
  const challenge = await issueRun();

  assert.equal(challenge.runId, RUN_ID);
  assert.equal(challenge.seed, 20260828);
  assert.equal(challenge.mode, "A");
  assert.equal(challenge.engineVersion, 1);
  assert.equal(challenge.expiresAt, "2026-08-28T01:00:00.000Z");
  assert.match(challenge.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
});

test("start rejects invalid modes and fails closed without service bindings", async () => {
  const invalid = await handleStartRun({
    request: new Request("https://hunt.example/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "C" }),
    }),
    env: { DB: createDb(), RUN_SIGNING_SECRET: RUN_SECRET },
  });
  const unavailable = await handleStartRun({
    request: new Request("https://hunt.example/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "A" }),
    }),
    env: {},
  });

  assert.equal(invalid.status, 422);
  assert.equal(unavailable.status, 503);
});

test("payload validation rejects client score fields and malformed actions", async () => {
  const challenge = await issueRun();
  const valid = { username: "NeonDrake7", token: challenge.token, actions: TERMINAL_ACTIONS };

  assert.equal(validateRunPayload(valid).valid, true);
  assert.equal(validateRunPayload({ ...valid, score: 9_999_999 }).valid, false);
  assert.equal(validateRunPayload({ ...valid, username: "<dragon>" }).valid, false);
  assert.equal(validateRunPayload({ ...valid, actions: [{ type: "shot", tick: 1, x: 4, y: 4, score: 99 }] }).valid, false);
});

test("submission replays and stores only server-calculated terminal results", async () => {
  const challenge = await issueRun();
  const db = createDb();
  const response = await handleSubmitRun({
    request: new Request("https://hunt.example/api/runs/submit", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.8" },
      body: JSON.stringify({ username: "NeonDrake7", token: challenge.token, actions: TERMINAL_ACTIONS }),
    }),
    env: { DB: db, RUN_SIGNING_SECRET: RUN_SECRET },
    now: () => new Date("2026-08-28T00:10:00.000Z"),
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.data.verified, true);
  assert.equal(body.data.score, 0);
  assert.equal(body.data.highestRound, 1);
  assert.equal(body.data.accuracy, 0);
  const insert = db.calls.find((call) => /INSERT INTO leaderboard_runs/u.test(call.sql));
  assert.ok(insert);
  assert.match(insert.sql, /ON CONFLICT\s*\(run_id\)\s*DO NOTHING/iu);
  assert.equal(insert.bindings.includes(9_999_999), false);
});

test("submission rejects changed tokens, expiry, and non-terminal transcripts before run insert", async () => {
  const challenge = await issueRun();
  const db = createDb();
  const makeRequest = (token, actions) => new Request("https://hunt.example/api/runs/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "NeonDrake7", token, actions }),
  });
  const changed = await handleSubmitRun({
    request: makeRequest(`${challenge.token}x`, TERMINAL_ACTIONS),
    env: { DB: db, RUN_SIGNING_SECRET: RUN_SECRET },
  });
  const expired = await handleSubmitRun({
    request: makeRequest(challenge.token, TERMINAL_ACTIONS),
    env: { DB: db, RUN_SIGNING_SECRET: RUN_SECRET },
    now: () => new Date("2026-08-28T02:00:00.000Z"),
  });
  const unfinished = await handleSubmitRun({
    request: makeRequest(challenge.token, [{ type: "shot", tick: 1, x: 5, y: 595 }]),
    env: { DB: db, RUN_SIGNING_SECRET: RUN_SECRET },
    now: () => new Date("2026-08-28T00:10:00.000Z"),
  });

  assert.equal(changed.status, 422);
  assert.equal(expired.status, 410);
  assert.equal(unfinished.status, 422);
  assert.equal(db.calls.some((call) => /INSERT INTO leaderboard_runs/u.test(call.sql)), false);
});

test("leaderboard filters verified personal bests by mode and period", async () => {
  const db = createDb({ results: [{ username: "NeonDrake7", score: 12300, highestRound: 3, accuracy: 75, completedAt: "2026-08-28T02:00:00.000Z" }] });
  const response = await handleListLeaderboard({
    request: new Request("https://hunt.example/api/leaderboard?mode=B&period=daily&limit=8"),
    env: { DB: db },
    now: () => new Date("2026-08-28T12:00:00.000Z"),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.entries[0].rank, 1);
  assert.equal(body.data.entries[0].username, "NeonDrake7");
  assert.match(db.calls[0].sql, /verification_status = 'verified'/iu);
  assert.deepEqual(db.calls[0].bindings, ["B", "2026-08-28T00:00:00.000Z", 8]);
});
