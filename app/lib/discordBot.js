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

// Asteroids' two leaderboards share one page/mode-select screen.
const GAME_PLAY_URL = {
  tetris: "https://www.immu10.com/games/tetris",
  typewriter: "https://www.immu10.com/games/typewriter",
  "asteroids-classic": "https://www.immu10.com/games/asteroids",
  "asteroids-chase": "https://www.immu10.com/games/asteroids",
};

const GAME_THUMBNAIL = {
  tetris: "https://www.immu10.com/games/tetris-thumb.png",
  typewriter: "https://www.immu10.com/games/typewriter-thumb.png",
  "asteroids-classic": "https://www.immu10.com/games/asteroids-thumb.png",
  "asteroids-chase": "https://www.immu10.com/games/asteroids-thumb.png",
};

// One gif per rank, self-hosted under public/discord/ — a third-party CDN
// link (Klipy, Tenor, whatever) can change its URL structure or hotlink
// policy at any time with no warning; a file we actually own can't break
// unless we remove it ourselves. www, not the bare domain — immu10.com
// 308-redirects to it, and Discord's embed fetcher doesn't follow that.
const RANK_GIF = [
  "https://www.immu10.com/discord/rank1.gif",
  "https://www.immu10.com/discord/rank2.gif",
  "https://www.immu10.com/discord/rank3.gif",
];

// Gold / silver / bronze — the embed's left-border accent color, Carl-bot-
// style boxed look.
const RANK_COLOR = [0xffd700, 0xc0c0c0, 0xcd7f32];

// Fire-and-forget-safe: every failure here is caught and swallowed, never
// thrown — this is called from score-submission routes, and a Discord or
// DB hiccup here must never break someone's actual score submission. Takes
// the caller's already-constructed Redis client (see notifyIfTopScore)
// since it needs to read the current top 3, not just the one entry that
// changed.
export async function broadcastTopScore(redis, game, name, rank) {
  if (!discordConfigured() || !dbConfigured()) return;
  try {
    const label = GAME_LABELS[game] ?? game;
    const gif = RANK_GIF[rank] ?? "";
    const playUrl = GAME_PLAY_URL[game] ?? "https://www.immu10.com/games";
    const thumbnail = GAME_THUMBNAIL[game];

    // Current top 3 as of this change, not just the entry that moved —
    // same read shape as app/lib/leaderboard.js's fetchLeaderboard.
    const raw = await redis.zrange(`${game}:leaderboard`, 0, 2, {
      rev: true,
      withScores: true,
    });
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

    // Play link tucked onto the end of the Player column instead of its
    // own field — a whole extra field adds its own margin plus (with the
    // zero-width-space name trick needed for an unlabeled field) an
    // invisible header line, both of which just read as a big gap.
    const playerLines = names.map((n, i) => `${i + 1}. ${n ?? "???"}`);
    playerLines.push(`[Play the game ↗](${playUrl})`);
    const scoreLines = scores.map((s) => s.toLocaleString());

    const body = {
      embeds: [
        {
          title: `New #${rank + 1} on ${label}!`,
          description: `**${name}** just took **#${rank + 1}**!`,
          color: RANK_COLOR[rank] ?? 0xffffff,
          fields: [
            { name: "Player", value: playerLines.join("\n"), inline: true },
            { name: "Score", value: scoreLines.join("\n"), inline: true },
          ],
          // thumbnail: small box, top-right — the game's own icon.
          ...(thumbnail ? { thumbnail: { url: thumbnail } } : {}),
          // image: big block at the bottom — the rank gif, inside the
          // embed's own image field so it renders in the boxed card
          // itself, not as a separate unfurled block below it.
          ...(gif ? { image: { url: gif } } : {}),
        },
      ],
    };

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
          body: JSON.stringify(body),
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
//
// beforeRank (optional): this same id's rank right before this write — only
// meaningful for logged-in accounts, whose id is stable across submissions
// (guests get a fresh id every time, so there's no "before" to compare).
// If the rank didn't actually move (still #1, still #2, etc.), the visible
// top 3 didn't change, so there's nothing worth announcing — just the same
// person padding their own score further ahead.
export async function notifyIfTopScore(redis, game, id, name, beforeRank = null) {
  try {
    const rank = await redis.zrevrank(`${game}:leaderboard`, id);
    if (rank === null || rank === undefined || rank >= TOP_RANK_THRESHOLD) return;
    if (rank === beforeRank) return;
    await broadcastTopScore(redis, game, name, rank);
  } catch {
    // Never let this affect the score submission that triggered it.
  }
}
