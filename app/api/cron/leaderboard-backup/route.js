// app/api/cron/leaderboard-backup/route.js  ->  GET /api/cron/leaderboard-backup
//
// Runs once a day (see vercel.json "crons"). Snapshots every game's full
// leaderboard (top 100, including the entry hashes) into a separate
// dated key with a 30-day TTL, in the same Redis instance — no git commits,
// no Vercel redeploys, entries just expire on their own after a month.
// Restoring is manual and rare: read the backup key, re-ZADD/HSET its
// contents back into the live keys.

import { getRedis, redisConfigured } from "../../../lib/redis";
import { GAMES } from "../../../games/gamesList";

export const dynamic = "force-dynamic";

const BACKUP_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_BACKUP_ENTRIES = 100;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function backupGame(redis, game, date) {
  const raw = await redis.zrange(
    `${game}:leaderboard`,
    0,
    MAX_BACKUP_ENTRIES - 1,
    { rev: true, withScores: true }
  );

  const ids = [];
  const scores = [];
  for (let i = 0; i < raw.length; i += 2) {
    ids.push(raw[i]);
    scores.push(Number(raw[i + 1]));
  }

  const entries = {};
  if (ids.length) {
    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(`${game}:entry:${id}`));
    const results = await pipeline.exec();
    ids.forEach((id, i) => {
      entries[id] = results[i];
    });
  }

  const snapshot = {
    leaderboard: ids.map((id, i) => ({ id, score: scores[i] })),
    entries,
  };

  await redis.setex(`${game}:backup:${date}`, BACKUP_TTL_SECONDS, snapshot);
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!redisConfigured()) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const redis = getRedis();
  const date = todayKey();
  await Promise.all(GAMES.map((g) => backupGame(redis, g.slug, date)));

  return Response.json({ ok: true, date, games: GAMES.map((g) => g.slug) });
}
