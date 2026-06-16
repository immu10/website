// app/api/spotify/login/route.js  ->  GET /api/spotify/login
//
// One-time helper: redirects you to Spotify to authorize this app.
// After you approve, Spotify sends you to /api/spotify/callback, which prints
// your refresh token. Paste that token into .env.local, then you can delete
// these login/callback routes if you like.

export const dynamic = "force-dynamic";

// Must EXACTLY match a Redirect URI you add in the Spotify dashboard.
const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI ||
  "http://127.0.0.1:3000/api/spotify/callback";

const SCOPE =
  "user-read-currently-playing user-read-playback-state user-top-read";

export async function GET() {
  if (!process.env.SPOTIFY_CLIENT_ID) {
    return new Response(
      "Missing SPOTIFY_CLIENT_ID in .env.local — add it first, then restart the dev server.",
      { status: 500 }
    );
  }

  const url =
    "https://accounts.spotify.com/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: SCOPE,
      redirect_uri: REDIRECT_URI,
    });

  return Response.redirect(url);
}
