// Shared sliding-window rate limiting (the piece parked earlier in the
// Tetris leaderboard planning — now needed for real, since login attempts
// are a brute-force target). Uses the same Redis instance as everything
// else; each limiter gets its own key prefix so they don't collide.

import { Ratelimit } from "@upstash/ratelimit";
import { getRedis, redisConfigured } from "./redis";

const limiters = new Map();

// windowSeconds/limit: e.g. (5, "1 m") = 5 requests per rolling minute.
export function getRateLimiter(prefix, limit, window) {
  const key = `${prefix}:${limit}:${window}`;
  if (!limiters.has(key)) {
    limiters.set(
      key,
      new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(limit, window),
        prefix: `ratelimit:${prefix}`,
      })
    );
  }
  return limiters.get(key);
}

// Returns true if the request should proceed, false if it's over the limit.
// Fails open (allows the request) if Redis isn't configured — rate limiting
// is a defense-in-depth layer, not the only thing standing between the site
// and abuse, so an unconfigured Redis shouldn't take the feature down.
export async function checkRateLimit(prefix, identifier, limit, window) {
  if (!redisConfigured()) return true;
  const { success } = await getRateLimiter(prefix, limit, window).limit(
    identifier
  );
  return success;
}
