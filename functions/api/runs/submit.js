import { handleSubmitRun, methodNotAllowed } from "../../../server/leaderboard-api.js";

export function onRequestPost(context) {
  return handleSubmitRun(context);
}

export function onRequest() {
  return methodNotAllowed("POST");
}
