"use client";

// Manhwa showcase. Each title is looked up on AniList for its cover + link.
// Edit the LIST below.

import { useEffect, useState } from "react";

const LIST = [
  "The Greatest Estate Developer",
  "Dungeon Odyssey",
  "Myst, Might, Mayhem",
];

export default function ManhwaList() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all(
      LIST.map((q) =>
        fetch(`/api/anilist/manga?q=${encodeURIComponent(q)}`)
          .then((r) => r.json())
          .then((d) => ({ ...d, fallback: q }))
          .catch(() => ({ found: false, fallback: q }))
      )
    ).then((res) => alive && setItems(res));
    return () => {
      alive = false;
    };
  }, []);

  const list = items ?? LIST.map((q) => ({ found: false, fallback: q }));

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
                  📖
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
