// app/api/games/asteroids-classic/session/route.js  ->  POST /api/games/asteroids-classic/session
//
// Mints a one-time-use session token when a game starts. The score endpoint
// requires this token and uses its server-recorded issue time to sanity-check
// the submitted score against how much time has actually elapsed — see
// leaderboardRules.js for the reasoning. Classic and Chase modes have their
// own session/score/leaderboard routes (and their own Redis keyspace) since
// they score completely differently and are kept as separate boards.

import { randomUUID } from "crypto";
import { getRedis, redisConfigured } from "@/app/lib/redis";
import { SESSION_TTL_SECONDS } from "@/app/games/asteroids/leaderboardRules";
import { checkRateLimit } from "@/app/lib/ratelimit";
import { getClientIp } from "@/app/lib/ip";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!redisConfigured()) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const ip = getClientIp(request);
  const allowed = await checkRateLimit("asteroids-classic-session", ip, 20, "1 m");
  if (!allowed) {
    return Response.json(
      { error: "Too many attempts, try again later." },
      { status: 429 }
    );
  }

  const token = randomUUID();
  // ip recorded for the owner's own moderation use only (viewed directly in
  // the Upstash console, never returned by any API response) — same
  // treatment as the entry-level ip in the score route.
  await getRedis().setex(`asteroids-classic:session:${token}`, SESSION_TTL_SECONDS, {
    issuedAt: Date.now(),
    ip,
  });

  return Response.json({ token });
}
