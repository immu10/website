// app/api/steam/recent/route.js  ->  GET /api/steam/recent
//
// Returns your most played Steam games (by total playtime):
//   { configured: true, games: [{ name, appid, imageUrl, hoursTotal }] }
//
// Needs two env vars (see .env.local.example):
//   STEAM_API_KEY  (from https://steamcommunity.com/dev/apikey)
//   STEAM_ID       (your 64-bit SteamID; profile must be public)

export const dynamic = "force-dynamic";

const OWNED_URL =
  "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";

// Games to keep out of the showcase (matched loosely by name, spaces ignored).
const HIDDEN = ["desktopmate", "aimlab"];

function isHidden(name) {
  const n = (name || "").toLowerCase().replace(/\s+/g, "");
  return HIDDEN.some((h) => n.includes(h));
}

function steamImage(appid) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

// Rigged pin: take the REAL Subnautica 2 entry from your library (with its
// actual playtime) and force it to a fixed position (0-based index 3 = 4th).
const PIN_APPID = 1962700;
const PIN_INDEX = 3;

export async function GET() {
  const { STEAM_API_KEY, STEAM_ID } = process.env;

  if (!STEAM_API_KEY || !STEAM_ID) {
    return Response.json({ configured: false, games: [] });
  }

  try {
    const url = `${OWNED_URL}?${new URLSearchParams({
      key: STEAM_API_KEY,
      steamid: STEAM_ID,
      include_appinfo: "true",
      include_played_free_games: "true",
    })}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return Response.json({ configured: true, games: [] });

    const data = await res.json();
    const all = (data.response?.games || [])
      .filter((g) => !isHidden(g.name))
      .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
      .map((g) => ({
        name: g.name,
        appid: g.appid,
        imageUrl: steamImage(g.appid),
        hoursTotal: Math.round((g.playtime_forever || 0) / 60), // min -> hours
      }));

    // Pull the real Subnautica 2 entry out and force it to its fixed slot.
    const pin = all.find((g) => g.appid === PIN_APPID);
    const rest = all.filter((g) => g.appid !== PIN_APPID).slice(0, 5);
    if (pin) rest.splice(PIN_INDEX, 0, pin);

    return Response.json({ configured: true, games: rest });
  } catch {
    return Response.json({ configured: true, games: [], error: true });
  }
}
