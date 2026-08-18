// Manual restore for a daily leaderboard backup (see
// app/api/cron/leaderboard-backup/route.js). Only ever run this by hand,
// when something's actually gone wrong — it's not part of any automated
// flow, and there's no UI for it on purpose.
//
// Usage:
//   node --env-file=.env.local scripts/restore-leaderboard-backup.js <game> <YYYY-MM-DD>
//
// e.g.
//   node --env-file=.env.local scripts/restore-leaderboard-backup.js tetris 2026-08-18
//
// This OVERWRITES the score/name/ip/ts for every id present in that day's
// backup, but does NOT delete anything that exists now but wasn't in the
// backup (e.g. legitimate scores submitted after the backup was taken) — a
// merge, not a full wipe-and-replace.

const { Redis } = require("@upstash/redis");

const [, , game, date] = process.argv;
if (!game || !date) {
  console.error(
    "Usage: node --env-file=.env.local scripts/restore-leaderboard-backup.js <game> <YYYY-MM-DD>"
  );
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

(async () => {
  const snapshot = await redis.get(`${game}:backup:${date}`);
  if (!snapshot) {
    console.error(`No backup found at ${game}:backup:${date}`);
    process.exit(1);
  }

  const { leaderboard, entries } = snapshot;
  console.log(
    `Restoring ${leaderboard.length} entries for "${game}" from ${date}...`
  );

  for (const { id, score } of leaderboard) {
    await redis.zadd(`${game}:leaderboard`, { score, member: id });
    const entry = entries[id];
    if (entry) await redis.hset(`${game}:entry:${id}`, entry);
  }

  console.log("Done.");
})();
