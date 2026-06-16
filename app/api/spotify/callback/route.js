// app/api/spotify/callback/route.js  ->  GET /api/spotify/callback
//
// Spotify redirects here after you authorize. We swap the one-time `code`
// for tokens and show you the refresh_token to paste into .env.local.

export const dynamic = "force-dynamic";

const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI ||
  "http://127.0.0.1:3000/api/spotify/callback";

function page(body) {
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;max-width:640px;margin:48px auto;padding:0 16px;line-height:1.5">${body}</body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return page("<h2>No code returned. Try /api/spotify/login again.</h2>");

  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await res.json();

  if (!data.refresh_token) {
    return page(
      `<h2>Couldn't get a refresh token</h2><pre>${JSON.stringify(
        data,
        null,
        2
      )}</pre><p>Double-check the Client ID/Secret and that the Redirect URI matches exactly.</p>`
    );
  }

  return page(
    `<h2>✅ Your Spotify refresh token</h2>
     <p>Add this line to <code>.env.local</code>, then restart the dev server:</p>
     <pre style="background:#f4f4f4;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all">SPOTIFY_REFRESH_TOKEN=${data.refresh_token}</pre>
     <p>For the live site, also add it in Vercel → Settings → Environment Variables.</p>
     <p>You can delete the <code>login</code> and <code>callback</code> routes afterwards if you want.</p>`
  );
}
