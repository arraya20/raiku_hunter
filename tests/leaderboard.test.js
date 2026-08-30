import assert from "node:assert/strict";
import test from "node:test";

import { createLeaderboardService } from "../src/leaderboard.js";

function response(body, status = 200) {
  return Response.json(body, { status });
}

test("leaderboard client requests filtered verified entries", async () => {
  const requests = [];
  const service = createLeaderboardService(async (url, options) => {
    requests.push({ url, options });
    return response({ data: { source: "verified", entries: [{ rank: 1, username: "NeonDrake7", score: 1200, highestRound: 2, accuracy: 75 }] } });
  });

  const result = await service.list({ mode: "B", period: "allTime", limit: 8 });

  assert.match(requests[0].url, /mode=B&period=allTime&limit=8/u);
  assert.equal(result.entries[0].username, "NeonDrake7");
});

test("run challenge requires the expected contract", async () => {
  const service = createLeaderboardService(async () => response({ data: { seed: 7 } }, 201));

  await assert.rejects(() => service.start({ mode: "A" }), /response/u);
});

test("submission sends username, token, and bounded actions as JSON", async () => {
  let request;
  const service = createLeaderboardService(async (url, options) => {
    request = { url, options };
    return response({ data: { verified: true, score: 2500, status: "created" } }, 201);
  });

  const result = await service.submit({ username: "MossWyrm123", token: "signed.token", actions: [{ type: "expire", tick: 300 }] });

  assert.equal(request.url, "./api/runs/submit");
  assert.equal(request.options.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(request.options.body), { username: "MossWyrm123", token: "signed.token", actions: [{ type: "expire", tick: 300 }] });
  assert.equal(result.verified, true);
});
