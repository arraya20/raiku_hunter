import { handleListLeaderboard, methodNotAllowed } from "../../server/leaderboard-api.js";

export function onRequestGet(context) {
  return handleListLeaderboard(context);
}

export function onRequest() {
  return methodNotAllowed("GET");
}
