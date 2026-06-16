// app/api/spotify/now-playing/route.js  ->  GET /api/spotify/now-playing
//
// Returns what's currently playing on the owner's Spotify account, e.g.
//   { isPlaying: true, title, artist, album, albumImageUrl, songUrl }
// or { isPlaying: false } when nothing is playing.
//
// Needs three env vars (see .env.local.example):
//   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN

import { getAccessToken, spotifyConfigured } from "../../../lib/spotify";

export const dynamic = "force-dynamic"; // never cache — it's live data

const NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";

export async function GET() {
  // If the keys aren't set yet, fail soft so the UI can show a placeholder.
  if (!spotifyConfigured()) {
    return Response.json({ isPlaying: false, configured: false });
  }

  try {
    const { access_token } = await getAccessToken();

    const res = await fetch(NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
      cache: "no-store",
    });

    // 204 = nothing playing, 200 with empty body can also happen
    if (res.status === 204 || res.status > 400) {
      return Response.json({ isPlaying: false, configured: true });
    }

    const song = await res.json();
    if (!song || !song.item) {
      return Response.json({ isPlaying: false, configured: true });
    }

    return Response.json({
      isPlaying: song.is_playing,
      title: song.item.name,
      artist: song.item.artists.map((a) => a.name).join(", "),
      album: song.item.album.name,
      albumImageUrl: song.item.album.images?.[0]?.url ?? null,
      songUrl: song.item.external_urls?.spotify ?? null,
      configured: true,
    });
  } catch (e) {
    return Response.json({ isPlaying: false, configured: true, error: true });
  }
}
