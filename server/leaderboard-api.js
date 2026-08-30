import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ENGINE_VERSION,
  MAX_RUN_ACTIONS,
  replayRun,
} from "../src/game.js";

const MAX_BODY_BYTES = 65_536;
const RUN_TTL_MS = 60 * 60 * 1_000;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MODES = new Set(["A", "B"]);
const RUN_FIELDS = new Set(["username", "token", "actions"]);
const TOKEN_FIELDS = new Set(["runId", "seed", "mode", "engineVersion", "issuedAt", "expiresAt"]);

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function jsonResponse(body, status = 200, cacheControl = "no-store") {
  return Response.json(body, { status, headers: { ...JSON_HEADERS, "cache-control": cacheControl } });
}

function apiError(status, code, message) {
  return jsonResponse({ error: { code, message } }, status);
}

function requireDatabase(env) {
  return env?.DB && typeof env.DB.prepare === "function" ? env.DB : null;
}

function requireSigningSecret(env) {
  return typeof env?.RUN_SIGNING_SECRET === "string" && env.RUN_SIGNING_SECRET.length >= 32
    ? env.RUN_SIGNING_SECRET
    : null;
}

function isIsoTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

async function readJsonBody(request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return { error: apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json") };
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { error: apiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large") };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { error: apiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large") };
  }
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: apiError(400, "INVALID_JSON", "Request body must be valid JSON") };
  }
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("invalid base64url");
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function importSigningKey(secret, cryptoImpl) {
  return cryptoImpl.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmacBytes(value, secret, cryptoImpl) {
  return new Uint8Array(await cryptoImpl.subtle.sign(
    "HMAC",
    await importSigningKey(secret, cryptoImpl),
    new TextEncoder().encode(value),
  ));
}

async function issueToken(claims, secret, cryptoImpl) {
  const payload = new TextEncoder().encode(JSON.stringify(claims));
  const signature = await cryptoImpl.subtle.sign("HMAC", await importSigningKey(secret, cryptoImpl), payload);
  return `${encodeBase64Url(payload)}.${encodeBase64Url(new Uint8Array(signature))}`;
}

function validClaims(claims) {
  return claims
    && typeof claims === "object"
    && !Array.isArray(claims)
    && Object.keys(claims).length === TOKEN_FIELDS.size
    && Object.keys(claims).every((field) => TOKEN_FIELDS.has(field))
    && UUID_PATTERN.test(claims.runId ?? "")
    && Number.isInteger(claims.seed)
    && claims.seed >= 1
    && claims.seed <= 0xffffffff
    && MODES.has(claims.mode)
    && claims.engineVersion === ENGINE_VERSION
    && isIsoTimestamp(claims.issuedAt)
    && isIsoTimestamp(claims.expiresAt)
    && Date.parse(claims.expiresAt) - Date.parse(claims.issuedAt) === RUN_TTL_MS;
}

async function verifyToken(token, secret, cryptoImpl) {
  try {
    const [payloadPart, signaturePart, extra] = token.split(".");
    if (!payloadPart || !signaturePart || extra) return null;
    const payload = decodeBase64Url(payloadPart);
    const signature = decodeBase64Url(signaturePart);
    const valid = await cryptoImpl.subtle.verify(
      "HMAC",
      await importSigningKey(secret, cryptoImpl),
      signature,
      payload,
    );
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(payload));
    return validClaims(claims) ? claims : null;
  } catch {
    return null;
  }
}

async function hashTranscript(actions, cryptoImpl) {
  const digest = await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(actions)));
  return encodeBase64Url(new Uint8Array(digest));
}

async function enforceRateLimit({ request, db, secret, now, bucket, maximum, cryptoImpl }) {
  const network = request.headers.get("cf-connecting-ip") ?? "unknown";
  const networkHash = encodeBase64Url(await hmacBytes(network, secret, cryptoImpl));
  const windowMs = 5 * 60 * 1_000;
  const nowMs = now().getTime();
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs).toISOString();
  const expiresAt = new Date(nowMs + (windowMs * 2)).toISOString();
  const result = await db.prepare(`
    INSERT INTO rate_limits (rate_key, window_start, count, expires_at)
    VALUES (?1, ?2, 1, ?3)
    ON CONFLICT (rate_key, window_start)
    DO UPDATE SET count = count + 1, expires_at = excluded.expires_at
    RETURNING count
  `).bind(`${bucket}:${networkHash}`, windowStart, expiresAt).first();
  return Number(result?.count ?? maximum + 1) <= maximum;
}

function isExactObject(value, fields) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === fields.size
    && Object.keys(value).every((field) => fields.has(field));
}

function isRunAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) return false;
  if (action.type === "nextRound") return Object.keys(action).length === 1;
  if (action.type === "expire") {
    return Object.keys(action).length === 2 && Number.isInteger(action.tick) && action.tick >= 0 && action.tick <= 10_000_000;
  }
  if (action.type === "shot") {
    return Object.keys(action).length === 4
      && Number.isInteger(action.tick) && action.tick >= 0 && action.tick <= 10_000_000
      && Number.isInteger(action.x) && action.x >= 0 && action.x <= ARENA_WIDTH
      && Number.isInteger(action.y) && action.y >= 0 && action.y <= ARENA_HEIGHT;
  }
  return false;
}

export function validateRunPayload(payload) {
  if (!isExactObject(payload, RUN_FIELDS)) return { valid: false };
  if (!USERNAME_PATTERN.test(payload.username ?? "")) return { valid: false };
  if (typeof payload.token !== "string" || payload.token.length < 32 || payload.token.length > 2_048) return { valid: false };
  if (!Array.isArray(payload.actions) || payload.actions.length === 0 || payload.actions.length > MAX_RUN_ACTIONS) return { valid: false };
  if (!payload.actions.every(isRunAction)) return { valid: false };
  return { valid: true, data: payload };
}

function randomSeed() {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] || 1;
}

export async function handleStartRun({
  request,
  env,
  now = () => new Date(),
  randomUUID = () => globalThis.crypto.randomUUID(),
  randomSeed: makeSeed = randomSeed,
  cryptoImpl = globalThis.crypto,
  logger = console,
}) {
  const db = requireDatabase(env);
  const secret = requireSigningSecret(env);
  if (!db || !secret) return apiError(503, "SERVICE_UNAVAILABLE", "Verified runs unavailable");
  const body = await readJsonBody(request);
  if (body.error) return body.error;
  const fields = new Set(["mode"]);
  if (!isExactObject(body.data, fields) || !MODES.has(body.data.mode)) {
    return apiError(422, "VALIDATION_ERROR", "Invalid run mode");
  }
  try {
    const allowed = await enforceRateLimit({ request, db, secret, now, bucket: "start", maximum: 30, cryptoImpl });
    if (!allowed) return apiError(429, "RATE_LIMITED", "Too many run requests");
  } catch (error) {
    logger.error?.("Run rate limit failed", { name: error?.name ?? "Error" });
    return apiError(503, "SERVICE_UNAVAILABLE", "Verified runs unavailable");
  }
  const issuedAt = now();
  const claims = {
    runId: randomUUID(),
    seed: makeSeed(),
    mode: body.data.mode,
    engineVersion: ENGINE_VERSION,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + RUN_TTL_MS).toISOString(),
  };
  const token = await issueToken(claims, secret, cryptoImpl);
  return jsonResponse({ data: { ...claims, token } }, 201);
}

function verificationError() {
  return apiError(422, "VERIFICATION_FAILED", "Run verification failed");
}

export async function handleSubmitRun({
  request,
  env,
  now = () => new Date(),
  cryptoImpl = globalThis.crypto,
  logger = console,
}) {
  const db = requireDatabase(env);
  const secret = requireSigningSecret(env);
  if (!db || !secret) return apiError(503, "SERVICE_UNAVAILABLE", "Leaderboard service unavailable");
  const body = await readJsonBody(request);
  if (body.error) return body.error;
  const validation = validateRunPayload(body.data);
  if (!validation.valid) return apiError(422, "VALIDATION_ERROR", "Invalid run data");

  const submission = validation.data;
  const claims = await verifyToken(submission.token, secret, cryptoImpl);
  if (!claims) return verificationError();
  if (Date.parse(claims.expiresAt) < now().getTime()) return apiError(410, "RUN_EXPIRED", "Run challenge expired");

  let verified;
  try {
    verified = replayRun({ seed: claims.seed, mode: claims.mode, actions: submission.actions }).result;
    if (verified.status !== "gameover" && verified.status !== "victory") return verificationError();
    const allowed = await enforceRateLimit({ request, db, secret, now, bucket: "submit", maximum: 20, cryptoImpl });
    if (!allowed) return apiError(429, "RATE_LIMITED", "Too many submissions");
  } catch {
    return verificationError();
  }

  const accuracy = verified.totalShots ? Math.round((verified.totalHits / verified.totalShots) * 100) : 0;
  const transcriptHash = await hashTranscript(submission.actions, cryptoImpl);
  const createdAt = now().toISOString();
  try {
    const result = await db.prepare(`
      INSERT INTO leaderboard_runs (
        run_id, username, username_key, mode, score, highest_round, total_hits,
        total_shots, accuracy, best_combo, outcome, created_at, seed,
        engine_version, transcript_hash, verification_status
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
      ON CONFLICT (run_id) DO NOTHING
    `).bind(
      claims.runId,
      submission.username,
      submission.username.toLowerCase(),
      claims.mode,
      verified.score,
      verified.highestRound,
      verified.totalHits,
      verified.totalShots,
      accuracy,
      verified.bestCombo,
      verified.status,
      createdAt,
      claims.seed,
      claims.engineVersion,
      transcriptHash,
      "verified",
    ).run();
    const created = Number(result?.meta?.changes ?? 0) > 0;
    if (!created) {
      const existing = await db.prepare(`
        SELECT transcript_hash AS transcriptHash FROM leaderboard_runs
        WHERE run_id = ?1 AND verification_status = 'verified'
      `).bind(claims.runId).first();
      if (existing?.transcriptHash !== transcriptHash) return apiError(409, "RUN_CONFLICT", "Run challenge already used");
    }
    logger.info?.({ event: "run_verified", status: created ? "created" : "duplicate", engineVersion: ENGINE_VERSION });
    return jsonResponse({
      data: {
        runId: claims.runId,
        status: created ? "created" : "duplicate",
        verified: true,
        score: verified.score,
        highestRound: verified.highestRound,
        accuracy,
        bestCombo: verified.bestCombo,
        outcome: verified.status,
      },
    }, created ? 201 : 200);
  } catch (error) {
    logger.error?.("Leaderboard insert failed", { name: error?.name ?? "Error" });
    return apiError(500, "INTERNAL_ERROR", "Leaderboard service unavailable");
  }
}

function parseListRequest(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "A";
  const period = url.searchParams.get("period") ?? "daily";
  const rawLimit = url.searchParams.get("limit") ?? "10";
  if (!MODES.has(mode) || !["daily", "allTime"].includes(period) || !/^\d+$/u.test(rawLimit)) return null;
  const limit = Number(rawLimit);
  return Number.isInteger(limit) && limit >= 1 && limit <= 50 ? { mode, period, limit } : null;
}

function rankingQuery(period) {
  const timeFilter = period === "daily" ? "AND created_at >= ?2" : "";
  const limitBinding = period === "daily" ? "?3" : "?2";
  return `
    WITH personal_bests AS (
      SELECT username, username_key, score, highest_round AS highestRound,
        accuracy, created_at AS completedAt,
        ROW_NUMBER() OVER (
          PARTITION BY username_key
          ORDER BY score DESC, highest_round DESC, accuracy DESC, created_at ASC
        ) AS player_position
      FROM leaderboard_runs
      WHERE mode = ?1 AND verification_status = 'verified' ${timeFilter}
    )
    SELECT username, score, highestRound, accuracy, completedAt
    FROM personal_bests WHERE player_position = 1
    ORDER BY score DESC, highestRound DESC, accuracy DESC, completedAt ASC
    LIMIT ${limitBinding}
  `;
}

export async function handleListLeaderboard({ request, env, now = () => new Date(), logger = console }) {
  const db = requireDatabase(env);
  if (!db) return apiError(503, "SERVICE_UNAVAILABLE", "Leaderboard service unavailable");
  const query = parseListRequest(request);
  if (!query) return apiError(400, "INVALID_QUERY", "Invalid leaderboard query");
  const bindings = [query.mode];
  if (query.period === "daily") {
    const start = now();
    start.setUTCHours(0, 0, 0, 0);
    bindings.push(start.toISOString());
  }
  bindings.push(query.limit);
  try {
    const result = await db.prepare(rankingQuery(query.period)).bind(...bindings).all();
    const entries = (result?.results ?? []).map((entry, index) => ({ rank: index + 1, ...entry }));
    return jsonResponse({ data: { mode: query.mode, period: query.period, source: "verified", entries } }, 200, "public, max-age=30");
  } catch (error) {
    logger.error?.("Leaderboard query failed", { name: error?.name ?? "Error" });
    return apiError(500, "INTERNAL_ERROR", "Leaderboard service unavailable");
  }
}

export function methodNotAllowed(allow) {
  return Response.json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }, {
    status: 405,
    headers: { ...JSON_HEADERS, allow, "cache-control": "no-store" },
  });
}
