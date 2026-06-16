"use client";

// Fetches /api/steam/recent and shows recently played games as cover cards.
// Falls back to placeholders until STEAM_API_KEY / STEAM_ID are set.

import { useEffect, useState } from "react";

const PLACEHOLDERS = [
  { name: "Lorem ipsum", appid: null },
  { name: "Dolor sit", appid: null },
  { name: "Amet", appid: null },
];

export default function SteamGames() {
  const [games, setGames] = useState(null); // null = loading

  useEffect(() => {
    let alive = true;
    fetch("/api/steam/recent")
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        setGames(json.games?.length ? json.games : PLACEHOLDERS);
      })
      .catch(() => alive && setGames(PLACEHOLDERS));
    return () => {
      alive = false;
    };
  }, []);

  const list = games ?? PLACEHOLDERS;

  return (
    <div className="grid w-full grid-cols-2 gap-3">
      {list.map((g, i) => {
        const inner = (
            <>
              <div className="flex aspect-[460/215] items-center justify-center bg-white/5">
                {g.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.imageUrl}
                    alt={g.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl">🎮</span>
                )}
              </div>
              <div className="p-3 text-left">
                <div className="truncate font-body text-sm text-white">
                  {g.name}
                </div>
                {g.hoursTotal > 0 && (
                  <div className="font-body text-xs text-white/50">
                    {g.hoursTotal}h played
                  </div>
                )}
              </div>
            </>
          );

          const cls =
            "block overflow-hidden rounded-xl bg-black/20 ring-1 ring-white/10 backdrop-blur-sm";

          // Link to the Steam store page when we have an appid.
          return g.appid ? (
            <a
              key={i}
              href={`https://store.steampowered.com/app/${g.appid}/`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${cls} transition-transform hover:-translate-y-1`}
            >
              {inner}
            </a>
          ) : (
            <article key={i} className={cls}>
              {inner}
            </article>
          );
      })}
    </div>
  );
}
