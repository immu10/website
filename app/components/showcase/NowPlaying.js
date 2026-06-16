"use client";

// Polls /api/spotify/now-playing and shows the current track as a card.
// Falls back to a calm "not playing" state when nothing's on.

import { useEffect, useState } from "react";

export default function NowPlaying() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch("/api/spotify/now-playing");
        const json = await res.json();
        if (alive) setData(json);
      } catch {
        if (alive) setData({ isPlaying: false });
      }
    };

    load();
    const id = setInterval(load, 10000); // refresh every 10s
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const playing = data?.isPlaying;

  const inner = (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#1DB954]">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            playing ? "animate-pulse bg-[#1DB954]" : "bg-white/30"
          }`}
        />
        {playing ? "Now playing" : "Spotify"}
      </div>

      {/* album art / placeholder */}
      <div className="aspect-square w-28 shrink-0 overflow-hidden rounded-lg bg-white/10 sm:w-32">
        {playing && data.albumImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.albumImageUrl}
            alt={data.album}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">
            🎵
          </div>
        )}
      </div>

      <div className="min-w-0 text-center">
        <div className="truncate font-body text-base text-white">
          {playing ? data.title : "Not playing right now"}
        </div>
        {playing && (
          <div className="truncate font-body text-sm text-white/60">
            {data.artist}
          </div>
        )}
      </div>
    </div>
  );

  const cardClass =
    "block h-full w-full rounded-xl bg-black/20 p-5 ring-1 ring-white/10 backdrop-blur-sm transition-colors hover:bg-black/30";

  // Link out to the track when one is playing
  return playing && data.songUrl ? (
    <a
      href={data.songUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cardClass}
    >
      {inner}
    </a>
  ) : (
    <div className={cardClass}>{inner}</div>
  );
}
