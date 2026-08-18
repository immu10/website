// app/api/games/tetris/session/route.js  ->  POST /api/games/tetris/session
//
// Mints a one-time-use session token when a game starts. The score endpoint
// requires this token and uses its server-recorded issue time to sanity-check
// the submitted score against how much time has actually elapsed — see
// leaderboardRules.js for the reasoning.

import { randomUUID } from "crypto";
import { getRedis, redisConfigured } from "../../../../lib/redis";
import { SESSION_TTL_SECONDS } from "../../../../games/tetris/leaderboardRules";
import { checkRateLimit } from "../../../../lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!redisConfigured()) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await checkRateLimit("tetris-session", ip, 20, "1 m");
  if (!allowed) {
    return Response.json(
      { error: "Too many attempts, try again later." },
      { status: 429 }
    );
  }

  const token = randomUUID();
  await getRedis().setex(`tetris:session:${token}`, SESSION_TTL_SECONDS, {
    issuedAt: Date.now(),
  });

  return Response.json({ token });
}
