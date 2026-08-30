import { handleStartRun, methodNotAllowed } from "../../server/leaderboard-api.js";

export function onRequestPost(context) {
  return handleStartRun(context);
}

export function onRequest() {
  return methodNotAllowed("POST");
}
