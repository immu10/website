"use client";

// Fetches /api/spotify/top and shows the top 3 tracks as a small ranked list.

import { useEffect, useState } from "react";

export default function TopTracks() {
  const [tracks, setTracks] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/spotify/top")
      .then((r) => r.json())
      .then((json) => alive && setTracks(json.tracks || []))
      .catch(() => alive && setTracks([]));
    return () => {
      alive = false;
    };
  }, []);

  // Nothing to show (not configured yet, or no data) -> render nothing.
  if (!tracks || tracks.length === 0) return null;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#1DB954]">
        Top tracks
      </div>
      <ol className="flex flex-1 flex-col gap-2">
        {tracks.map((t, i) => {
          const inner = (
            <>
              <span className="w-4 shrink-0 text-center font-body text-sm text-white/40">
                {i + 1}
              </span>
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-white/10">
                {t.albumImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.albumImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 text-left">
                <div className="truncate font-body text-sm text-white">
                  {t.title}
                </div>
                <div className="truncate font-body text-xs text-white/50">
                  {t.artist}
                </div>
              </div>
            </>
          );

          const cls =
            "flex flex-1 items-center gap-3 rounded-lg bg-black/20 p-3 ring-1 ring-white/10 backdrop-blur-sm";

          return t.songUrl ? (
            <a
              key={i}
              href={t.songUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${cls} transition-colors hover:bg-black/30`}
            >
              {inner}
            </a>
          ) : (
            <li key={i} className={cls}>
              {inner}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
