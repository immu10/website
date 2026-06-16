"use client";

// Shows/Movies showcase. Each entry is looked up on TMDB for its poster + link.
// Edit the WATCHLIST below — type is "tv" (anime/kdramas/series) or "movie".

import { useEffect, useState } from "react";

const WATCHLIST = [
  { q: "86 EIGHTY-SIX", type: "tv" }, // anime
  { q: "The Glory", type: "tv" }, // kdrama
  { q: "How to Train Your Dragon 2", type: "movie" }, // movie
];

export default function ShowsMovies() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all(
      WATCHLIST.map((w) =>
        fetch(`/api/tmdb/search?q=${encodeURIComponent(w.q)}&type=${w.type}`)
          .then((r) => r.json())
          .then((d) => ({ ...d, fallback: w.q }))
          .catch(() => ({ found: false, fallback: w.q }))
      )
    ).then((res) => alive && setItems(res));
    return () => {
      alive = false;
    };
  }, []);

  const list = items ?? WATCHLIST.map((w) => ({ found: false, fallback: w.q }));

  return (
    <div className="grid grid-cols-3 gap-3">
      {list.map((it, i) => {
        const inner = (
          <>
            <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-white/5">
              {it.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.posterUrl}
                  alt={it.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl">
                  🎬
                </div>
              )}
            </div>
            <div className="mt-1 truncate font-body text-xs text-white/80">
              {it.title || it.fallback}
            </div>
          </>
        );

        return it.url ? (
          <a
            key={i}
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block transition-transform hover:-translate-y-1"
          >
            {inner}
          </a>
        ) : (
          <div key={i}>{inner}</div>
        );
      })}
    </div>
  );
}
