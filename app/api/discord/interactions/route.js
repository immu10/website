// app/api/discord/interactions/route.js  ->  POST /api/discord/interactions
//
// This is the single URL Discord POSTs to for every slash-command use once
// it's set as this app's "Interactions Endpoint URL" (Developer Portal ->
// General Information). Discord also POSTs a one-off PING here the moment
// that field is saved, to confirm the endpoint responds correctly before
// it'll accept the setting — see the type-1 branch below.
//
// No bot gateway connection anywhere: a slash command arriving here IS the
// bot "running." Everything is one-shot HTTP, same as the rest of this
// codebase's routes.

import { getDb, dbConfigured } from "@/app/lib/db";
import { verifyDiscordSignature } from "@/app/lib/discordBot";

export const dynamic = "force-dynamic";

const MANAGE_GUILD = 0x20n;

export async function POST(request) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const rawBody = await request.text();

  if (!verifyDiscordSignature(signature, timestamp, rawBody)) {
    return new Response("invalid request signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // PING — Discord's own endpoint-verification handshake, not a real
  // slash-command use.
  if (body.type === 1) {
    return Response.json({ type: 1 });
  }

  // Only slash commands from here on.
  if (body.type !== 2) {
    return Response.json({ type: 4, data: { content: "Unsupported interaction.", flags: 64 } });
  }

  if (body.data?.name === "set-leaderboard-channel") {
    return handleSetChannel(body);
  }

  return Response.json({ type: 4, data: { content: "Unknown command.", flags: 64 } });
}

async function handleSetChannel(body) {
  // default_member_permissions on the command registration already hides
  // this from anyone without Manage Server, but Discord client-side UI
  // isn't something to trust as the actual security boundary — re-check
  // server-side against the permissions Discord attaches to the invoking
  // member.
  const perms = BigInt(body.member?.permissions ?? "0");
  if ((perms & MANAGE_GUILD) === 0n) {
    return Response.json({
      type: 4,
      data: { content: "You need the Manage Server permission to do that.", flags: 64 },
    });
  }

  if (!dbConfigured()) {
    return Response.json({
      type: 4,
      data: { content: "Not configured on this end — try again later.", flags: 64 },
    });
  }

  const channelId = body.data.options?.find((o) => o.name === "channel")?.value;
  const guildId = body.guild_id;
  const userId = body.member.user.id;
  if (!channelId || !guildId) {
    return Response.json({ type: 4, data: { content: "Missing channel or server.", flags: 64 } });
  }

  const sql = getDb();
  await sql`
    INSERT INTO discord_leaderboard_channels (guild_id, channel_id, set_by)
    VALUES (${guildId}, ${channelId}, ${userId})
    ON CONFLICT (guild_id)
    DO UPDATE SET channel_id = ${channelId}, set_by = ${userId}, created_at = now()
  `;

  return Response.json({
    type: 4,
    data: { content: `Leaderboard announcements will post in <#${channelId}>.`, flags: 64 },
  });
}
