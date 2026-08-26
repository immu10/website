// One-time (and re-run-whenever-the-command-definition-changes) setup:
// registers the bot's slash command(s) with Discord globally. Not part of
// any automated flow — global command registration can take up to an hour
// to propagate, so this only needs running when the command itself
// changes, not on every deploy.
//
// Usage:
//   node --env-file=.env.local scripts/register-discord-commands.js

const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_APPLICATION_ID;

if (!token || !appId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID in the environment.");
  process.exit(1);
}

// PUT bulk-overwrites every global command with exactly this list — fine
// here since this bot only ever has the one command.
const commands = [
  {
    name: "set-leaderboard-channel",
    description: "Choose the channel where top-3 leaderboard announcements post",
    default_member_permissions: "32", // MANAGE_GUILD — hides the command from non-admins
    options: [
      {
        type: 7, // CHANNEL
        name: "channel",
        description: "Channel to post announcements in",
        required: true,
        channel_types: [0, 5], // GUILD_TEXT, GUILD_ANNOUNCEMENT
      },
    ],
  },
];

(async () => {
  const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    console.error(`Failed: ${res.status} ${res.statusText}`);
    console.error(await res.text());
    process.exit(1);
  }

  console.log("Registered:", (await res.json()).map((c) => `/${c.name}`).join(", "));
})();
