// Shared helpers for the Discord leaderboard-announcement bot: verifying
// incoming slash-command requests (see app/api/discord/interactions), and
// broadcasting a top-3 change to every server that's registered a channel
// via /set-leaderboard-channel (see discord_leaderboard_channels in
// db/schema.sql). No persistent bot process anywhere — everything here is
// a one-off HTTP call, same shape as the rest of this codebase's API routes.

import nacl from "tweetnacl";
import { getDb, dbConfigured } from "./db";

export function discordConfigured() {
  return Boolean(
    process.env.DISCORD_BOT_TOKEN &&
      process.env.DISCORD_APPLICATION_ID &&
      process.env.DISCORD_PUBLIC_KEY
  );
}

// Discord signs every interaction request with the app's Ed25519 public
// key — this check is the only thing standing between the interactions
// route and anyone on the internet POSTing a fake slash-command payload.
export function verifyDiscordSignature(signature, timestamp, rawBody) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!signature || !timestamp || !publicKey) return false;
  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + rawBody),
      Buffer.from(signature, "hex"),
      Buffer.from(publicKey, "hex")
    );
  } catch {
    return false;
  }
}

const GAME_LABELS = {
  tetris: "Tetris",
  typewriter: "Typewriter",
  "asteroids-classic": "Asteroids — Classic",
  "asteroids-chase": "Asteroids — Chase",
};

const RANK_MEDAL = ["🥇", "🥈", "🥉"];

// Fire-and-forget-safe: every failure here is caught and swallowed, never
// thrown — this is called from score-submission routes, and a Discord or
// DB hiccup here must never break someone's actual score submission.
export async function broadcastTopScore(game, name, score, rank) {
  if (!discordConfigured() || !dbConfigured()) return;
  try {
    const label = GAME_LABELS[game] ?? game;
    const medal = RANK_MEDAL[rank] ?? "";
    const content = `${medal} **${name}** just took **#${rank + 1}** on **${label}** with **${score.toLocaleString()}**!`;

    const sql = getDb();
    const rows = await sql`SELECT channel_id FROM discord_leaderboard_channels`;

    await Promise.all(
      rows.map((row) =>
        fetch(`https://discord.com/api/v10/channels/${row.channel_id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        }).catch(() => {})
      )
    );
  } catch {
    // Never let this affect the score submission that triggered it.
  }
}

const TOP_RANK_THRESHOLD = 3;

// Called by each game's score route right after writing a genuinely new or
// improved score — checks whether that id's rank actually lands in the top
// 3 right now, and if so fires the broadcast. Takes the already-constructed
// Redis client so callers don't need to import getRedis separately just
// for this.
export async function notifyIfTopScore(redis, game, id, name, score) {
  try {
    const rank = await redis.zrevrank(`${game}:leaderboard`, id);
    if (rank !== null && rank !== undefined && rank < TOP_RANK_THRESHOLD) {
      await broadcastTopScore(game, name, score, rank);
    }
  } catch {
    // Never let this affect the score submission that triggered it.
  }
}
