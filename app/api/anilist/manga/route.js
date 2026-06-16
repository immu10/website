// app/api/anilist/manga/route.js  ->  GET /api/anilist/manga?q=The%20Greatest%20Estate%20Developer
//
// Looks up a manhwa/manga on AniList (free GraphQL API, no key) and returns
// its cover + link:  { found: true, title, posterUrl, url }

export const dynamic = "force-dynamic";

const QUERY = `
  query ($search: String) {
    Media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
      title { english romaji }
      coverImage { large }
      siteUrl
    }
  }
`;

export async function GET(request) {
  const q = new URL(request.url).searchParams.get("q");
  if (!q) return Response.json({ found: false });

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: QUERY, variables: { search: q } }),
      cache: "no-store",
    });

    if (!res.ok) return Response.json({ found: false });

    const { data } = await res.json();
    const m = data?.Media;
    if (!m) return Response.json({ found: false });

    return Response.json({
      found: true,
      title: m.title.english || m.title.romaji || q,
      posterUrl: m.coverImage?.large ?? null,
      url: m.siteUrl ?? null,
    });
  } catch {
    return Response.json({ found: false, error: true });
  }
}
