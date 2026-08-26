// Scratch tool for iterating on the Discord embed layout — posts to your
// chosen test channel, not the live registered leaderboard channel, so you
// can freely spam test posts here without touching the real feed.
//
// Tweak `body` below, then run:
//   node --env-file=.env.local template/discord-embed-preview.js

const CHANNEL_ID = "1392243986260824104";

const body = {
  embeds: [
    {
      title: "New #1 on Asteroids — Chase!",
      description: "**immu10** just took **#1** with a new high score!",
      color: 0xffd700,
      // Current top 3 as of this change, not just the one entry that moved
      // — one row per rank, in the same order across both columns.
      fields: [
        // Link on the left column this time, single newline (not a blank
        // line) so it sits right under the list, not pushed further down.
        {
          name: "Player",
          value:
            "1. immu10\n2. TEST-rank2\n3. TEST-rank3\n[Play the game ↗](https://www.immu10.com/games/asteroids)",
          inline: true,
        },
        { name: "Score", value: "20,000\n9,000\n8,000", inline: true },
      ],
      // thumbnail: small box, top-right — the game's own icon (already
      // live on prod from the earlier Asteroids deploy).
      thumbnail: { url: "https://www.immu10.com/games/asteroids-thumb.png" },
      // image: big block at the bottom — the rank gif. Using the
      // confirmed-working direct Klipy CDN link for this preview; the
      // self-hosted www.immu10.com/discord/rank1.gif isn't live until we
      // push to prod, swap back to that once it is.
      image: { url: "https://static2.klipy.com/ii/8ce8357c78ea940b9c2015daf05ce1a5/e7/35/I5KnPffZ.gif" },
    },
  ],
};

(async () => {
  const res = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  console.log(res.status);
  console.log(await res.text());
})();
