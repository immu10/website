"use client";

// Lifts each showcase widget's live-data status up so we can show a single
// "something's up" banner + a small warning icon beside the relevant
// heading, instead of a badge duplicated inside every tile. A visitor
// doesn't care *why* (never configured vs. a live fetch failing) — either
// way the data shown isn't real, so both cases raise the same flag.

import { useCallback, useState } from "react";
import NowPlaying from "../components/showcase/NowPlaying";
import TopTracks from "../components/showcase/TopTracks";
import SteamGames from "../components/showcase/SteamGames";
import ShowsMovies from "../components/showcase/ShowsMovies";
import ManhwaList from "../components/showcase/ManhwaList";
import LiveWarning from "../components/showcase/LiveWarning";

const tile =
  "flex flex-col gap-4 rounded-2xl bg-black/10 p-5 ring-1 ring-white/10 backdrop-blur-sm";

const heading = "flex items-center justify-center gap-2 font-heading text-2xl head-white-pink";

export default function AboutMeShowcase() {
  const [flags, setFlags] = useState({
    nowPlaying: false,
    topTracks: false,
    steam: false,
    shows: false,
    manhwa: false,
  });

  // Stable per-key setter so each child's effect doesn't re-fire on every render.
  const flag = useCallback(
    (key) => (value) =>
      setFlags((prev) => (prev[key] === value ? prev : { ...prev, [key]: value })),
    []
  );

  const musicIssue = flags.nowPlaying || flags.topTracks;
  const anyIssue = Object.values(flags).some(Boolean);

  return (
    <>
      {anyIssue && (
        <div className="flex w-full max-w-5xl items-center justify-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 font-body text-sm text-amber-200 ring-1 ring-amber-400/30">
          <span aria-hidden="true">⚠</span>
          <span>Some live data below isn&apos;t available right now.</span>
        </div>
      )}

      <section className="grid w-full max-w-5xl items-start gap-6 sm:grid-cols-2">
        <div className={tile}>
          <h2 className={heading}>
            Music
            {musicIssue && <LiveWarning />}
          </h2>
          <NowPlaying onError={flag("nowPlaying")} />
          <TopTracks onError={flag("topTracks")} />
        </div>

        <div className={tile}>
          <h2 className={heading}>
            Games
            {flags.steam && <LiveWarning />}
          </h2>
          <SteamGames onError={flag("steam")} />
        </div>

        <div className={tile}>
          <h2 className={heading}>
            Shows / Movies
            {flags.shows && <LiveWarning />}
          </h2>
          <ShowsMovies onError={flag("shows")} />
        </div>

        <div className={tile}>
          <h2 className={heading}>
            Manhwas
            {flags.manhwa && <LiveWarning />}
          </h2>
          <ManhwaList onError={flag("manhwa")} />
        </div>
      </section>
    </>
  );
}
