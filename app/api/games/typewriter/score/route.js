// app/api/games/typewriter/score/route.js  ->  POST /api/games/typewriter/score
//
// Validates and records a leaderboard submission. Every check here must be
// server-side and authoritative — this route can be hit directly, so nothing
// the client claims (except the opaque session token) is trusted as-is.
//
// Logged-in players get a stable, one-row-per-account entry that only ever
// updates upward (ZADD ... GT) — see lib/auth.js. Anonymous players keep the
// original free-text-name, fresh-row-per-submission behavior.

import { randomUUID } from "crypto";
import { getRedis, redisConfigured } from "@/app/lib/redis";
import { validateName } from "@/app/lib/profanity";
import { getSession } from "@/app/lib/auth";
import { checkRateLimit } from "@/app/lib/ratelimit";
import { getClientIp } from "@/app/lib/ip";
import {
  MIN_ELAPSED_SECONDS,
  maxPlausibleScore,
} from "@/app/games/typewriter/leaderboardRules";

export const dynamic = "force-dynamic";

// Keep the sorted set from growing unbounded from spam — only the top
// MAX_ENTRIES scores are ever kept.
const MAX_ENTRIES = 100;

export async function POST(request) {
  if (!redisConfigured()) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const ip = getClientIp(request);
  const allowed = await checkRateLimit("typewriter-score", ip, 20, "1 m");
  if (!allowed) {
    return Response.json(
      { error: "Too many attempts, try again later." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { name: rawName, score, token } = body ?? {};

  if (typeof token !== "string" || !token) {
    return Response.json({ error: "missing session token" }, { status: 400 });
  }
  if (!Number.isInteger(score) || score < 0) {
    return Response.json({ error: "invalid score" }, { status: 400 });
  }

  const account = await getSession();

  let displayName;
  if (account) {
    displayName = account.username;
  } else {
    const nameCheck = validateName(rawName);
    if (!nameCheck.ok) {
      return Response.json({ error: nameCheck.reason }, { status: 400 });
    }
    displayName = nameCheck.name;
  }

  const redis = getRedis();

  // GETDEL: read the anti-cheat session and delete it in one step, so a
  // token can only ever be redeemed once (no replaying it for multiple
  // submissions). Unrelated to the login session above.
  const playSession = await redis.getdel(`typewriter:session:${token}`);
  if (!playSession || typeof playSession.issuedAt !== "number") {
    return Response.json(
      { error: "invalid or expired session" },
      { status: 400 }
    );
  }

  const elapsedSeconds = (Date.now() - playSession.issuedAt) / 1000;
  if (elapsedSeconds < MIN_ELAPSED_SECONDS) {
    return Response.json({ error: "too fast" }, { status: 400 });
  }
  if (score > maxPlausibleScore(elapsedSeconds)) {
    return Response.json({ error: "implausible score" }, { status: 400 });
  }

  // ip (recorded for the owner's own moderation use only, viewed directly
  // in the Upstash console, never returned by any API response) was already
  // computed above for the rate-limit check.

  if (account) {
    const id = `user:${account.userId}`;
    // gt: only replace the stored score if this one is higher. ch: report
    // whether the score actually changed, so the hash below doesn't record
    // a "score" that doesn't match what's actually in the sorted set.
    const changed = await redis.zadd(
      "typewriter:leaderboard",
      { gt: true, ch: true },
      { score, member: id }
    );
    await redis.hset(`typewriter:entry:${id}`, {
      name: displayName,
      ip,
      ts: Date.now(),
      ...(changed > 0 ? { score } : {}),
    });
  } else {
    const id = randomUUID();
    await redis.hset(`typewriter:entry:${id}`, {
      name: displayName,
      score,
      ip,
      ts: Date.now(),
    });
    await redis.zadd("typewriter:leaderboard", { score, member: id });
  }

  await redis.zremrangebyrank("typewriter:leaderboard", 0, -(MAX_ENTRIES + 1));

  return Response.json({ ok: true });
}
