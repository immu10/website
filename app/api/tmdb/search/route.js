// app/api/tmdb/search/route.js  ->  GET /api/tmdb/search?q=86%20EIGHTY-SIX&type=tv
//
// Looks up a movie / TV show / anime / kdrama on TMDB and returns the best
// match's poster + link:
//   { found: true, title, posterUrl, year, url }
//
// Needs TMDB_API_KEY in .env.local (free: https://www.themoviedb.org/settings/api)

export const dynamic = "force-dynamic";

const IMG_BASE = "https://image.tmdb.org/t/p/w342";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const type = searchParams.get("type"); // "tv" | "movie" | null (multi)

  if (!process.env.TMDB_API_KEY) {
    return Response.json({ found: false, configured: false });
  }
  if (!q) return Response.json({ found: false });

  // Use a typed search when given (more accurate), else multi-search.
  const endpoint =
    type === "tv" || type === "movie" ? `search/${type}` : "search/multi";

  try {
    const url = `https://api.themoviedb.org/3/${endpoint}?${new URLSearchParams({
      api_key: process.env.TMDB_API_KEY,
      query: q,
      include_adult: "false",
    })}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return Response.json({ found: false, configured: true });

    const data = await res.json();
    // First result that actually has a poster.
    const hit = (data.results || []).find((r) => r.poster_path);
    if (!hit) return Response.json({ found: false, configured: true });

    const mediaType = hit.media_type || type || "tv";
    const date = hit.release_date || hit.first_air_date || "";

    return Response.json({
      found: true,
      title: hit.title || hit.name || q,
      posterUrl: `${IMG_BASE}${hit.poster_path}`,
      year: date ? date.slice(0, 4) : null,
      url: `https://www.themoviedb.org/${mediaType}/${hit.id}`,
      configured: true,
    });
  } catch {
    return Response.json({ found: false, configured: true, error: true });
  }
}
