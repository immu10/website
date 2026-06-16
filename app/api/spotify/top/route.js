// app/api/spotify/top/route.js  ->  GET /api/spotify/top
//
// Returns your top 3 tracks:
//   { configured: true, tracks: [{ title, artist, albumImageUrl, songUrl }] }
//
// Requires the `user-top-read` scope on the refresh token (re-run
// /api/spotify/login after this scope was added).

import { getAccessToken, spotifyConfigured } from "../../../lib/spotify";

export const dynamic = "force-dynamic";

// time_range: short_term ~4wk, medium_term ~6mo, long_term ~1yr/all-time
const TOP_URL =
  "https://api.spotify.com/v1/me/top/tracks?limit=3&time_range=medium_term";

export async function GET() {
  if (!spotifyConfigured()) {
    return Response.json({ configured: false, tracks: [] });
  }

  try {
    const { access_token } = await getAccessToken();

    const res = await fetch(TOP_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
      cache: "no-store",
    });

    if (!res.ok) return Response.json({ configured: true, tracks: [] });

    const data = await res.json();
    const tracks = (data.items || []).map((t) => ({
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      albumImageUrl: t.album?.images?.[t.album.images.length - 1]?.url ?? null,
      songUrl: t.external_urls?.spotify ?? null,
    }));

    return Response.json({ configured: true, tracks });
  } catch {
    return Response.json({ configured: true, tracks: [], error: true });
  }
}
