// Generic "read the top N scores for a game" logic, used by both leaderboard
// API routes (client-side fetch/polling) and the /games/leaderboard page
// (server component, reads directly). Every game's score-writing route uses
// its own `${game}:leaderboard` sorted set + `${game}:entry:{id}` hashes
// (see app/api/games/tetris/score/route.js) — this just reads that shape
// generically so a new game's leaderboard needs no new read-side code.

import { unstable_cache } from "next/cache";
import { getRedis, redisConfigured } from "./redis";

async function fetchLeaderboard(game, limit) {
  if (!redisConfigured()) return { entries: [], configured: false };

  const redis = getRedis();
  const raw = await redis.zrange(`${game}:leaderboard`, 0, limit - 1, {
    rev: true,
    withScores: true,
  });

  // Flat array: [member, score, member, score, ...].
  const ids = [];
  const scores = [];
  for (let i = 0; i < raw.length; i += 2) {
    ids.push(raw[i]);
    scores.push(Number(raw[i + 1]));
  }

  let names = [];
  if (ids.length) {
    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.hget(`${game}:entry:${id}`, "name"));
    names = await pipeline.exec();
  }

  const entries = ids.map((id, i) => ({
    name: names[i] ?? "???",
    score: scores[i],
    // Account-backed entries are keyed `user:{id}` (see the score route's
    // ZADD ... GT path); anything else is a free-text guest submission.
    guest: !id.startsWith("user:"),
  }));

  return { entries, configured: true };
}

// Cached snapshot, shared across every visitor — refreshes at most once a
// minute (revalidate: 60) rather than hitting Redis on every page view or
// panel poll. Only affects production/deployed behavior: Next never caches
// in `next dev`, so this won't be visible while developing locally.
export const getLeaderboard = unstable_cache(fetchLeaderboard, ["leaderboard"], {
  revalidate: 60,
});
