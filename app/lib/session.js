// Minimal signed session cookie — deliberately not pulling in a full auth
// framework (Auth.js etc.) for something this narrow: one credentials-only
// login, no OAuth providers, no email flows. A session is just
// { userId, username, exp } HMAC-signed with AUTH_SECRET; verifying it is a
// signature + expiry check, no DB round-trip required per request.

import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "games_session";

// "Remember me" -> 30 days. Otherwise -> 1 day (long enough for a play
// session, short enough that a shared/public browser isn't left logged in
// for a month).
export const REMEMBER_ME_SECONDS = 30 * 24 * 60 * 60;
export const DEFAULT_SESSION_SECONDS = 24 * 60 * 60;

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64) {
  const secret = process.env.AUTH_SECRET;
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createSessionValue(userId, username, maxAgeSeconds) {
  const payload = JSON.stringify({
    userId,
    username,
    exp: Date.now() + maxAgeSeconds * 1000,
  });
  const payloadB64 = b64url(payload);
  return `${payloadB64}.${sign(payloadB64)}`;
}

// Returns { userId, username } or null (missing, malformed, forged, or expired).
export function verifySessionValue(value) {
  if (!process.env.AUTH_SECRET || typeof value !== "string") return null;

  const [payloadB64, signature] = value.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}
