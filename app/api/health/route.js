// app/api/health/route.js  ->  GET /api/health
//
// Synthetic health check, hit by .github/workflows/health-check.yml on a
// schedule (not by real visitors). Reports whether each live integration
// that IS configured is actually working, plus whether GITHUB_TOKEN is
// authenticated (vs. silently falling back to the 60 req/hr public limit).
//
// A widget that was never configured is not a failure — it's just an
// integration you haven't set up — so it doesn't affect `ok`.

export const dynamic = "force-dynamic";

async function checkWidget(origin, path) {
  try {
    const res = await fetch(`${origin}${path}`, { cache: "no-store" });
    const json = await res.json();
    const configured = json.configured !== false;
    return {
      configured,
      // Not configured -> nothing to alert on. Configured -> must not have errored.
      ok: !configured || !json.error,
      error: Boolean(json.error),
    };
  } catch {
    return { configured: true, ok: false, error: true };
  }
}

async function checkGithub() {
  try {
    const res = await fetch("https://api.github.com/rate_limit", {
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {},
      cache: "no-store",
    });
    const data = await res.json();
    const limit = data?.resources?.core?.limit ?? 0;
    // Authenticated requests get 5000/hr; unauthenticated (missing/expired
    // token) get 60/hr — that drop is exactly what we want to catch.
    return {
      ok: limit > 60,
      authenticated: limit > 60,
      limit,
      remaining: data?.resources?.core?.remaining ?? null,
    };
  } catch {
    return { ok: false, error: true };
  }
}

export async function GET(request) {
  const secret = process.env.HEALTH_CHECK_SECRET;
  if (!secret || request.headers.get("x-health-secret") !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  const [spotifyNowPlaying, spotifyTop, steam, tmdb, github] = await Promise.all([
    checkWidget(origin, "/api/spotify/now-playing"),
    checkWidget(origin, "/api/spotify/top"),
    checkWidget(origin, "/api/steam/recent"),
    checkWidget(origin, "/api/tmdb/search?q=test&type=movie"),
    checkGithub(),
  ]);

  const checks = { github, spotifyNowPlaying, spotifyTop, steam, tmdb };
  const ok = Object.values(checks).every((c) => c.ok);

  return Response.json({ ok, checks });
}
