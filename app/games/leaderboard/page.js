// app/games/leaderboard/page.js  ->  served at /games/leaderboard[?game=slug]
// Simple top-scores page. Reads straight from Redis (server component) —
// no need to round-trip through our own API route here.

import { getLeaderboard } from "../../lib/leaderboard";
import { GAMES } from "../gamesList";
import GameSelect from "./GameSelect";
import GuestIcon from "../GuestIcon";
import AuthWidget from "../AuthWidget";

export const metadata = { title: "Leaderboard — immu10" };

const PAGE_SIZE = 20;

export default async function LeaderboardPage({ searchParams }) {
  const { game: requestedGame, page: pageParam } = await searchParams;
  const game = GAMES.find((g) => g.slug === requestedGame) ?? GAMES[0];
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const start = (page - 1) * PAGE_SIZE;
  // Fetch one extra entry past this page so we can tell whether a next page
  // exists, without a separate count query.
  const { entries: fetched, configured } = await getLeaderboard(
    game.slug,
    start + PAGE_SIZE + 1
  );
  const entries = fetched.slice(start, start + PAGE_SIZE);
  const hasNextPage = fetched.length > start + PAGE_SIZE;

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8">
      <div className="flex w-full max-w-md items-center justify-between">
        <a href="/games" className="font-medium underline underline-offset-4">
          ← Games
        </a>
        <AuthWidget />
      </div>

      <h1 className="font-heading head-white-pink text-4xl sm:text-5xl">
        Leaderboard
      </h1>

      <GameSelect games={GAMES} selected={game.slug} />

      <p className="-mt-4 text-center font-body text-xs text-white/40">
        New scores can take up to a minute to show up here — don&apos;t worry,
        it&apos;s not lost.
      </p>

      <div className="w-full max-w-md rounded-2xl bg-black/20 p-5 ring-1 ring-white/10 backdrop-blur-sm">
        {!configured ? (
          <p className="text-center font-body text-white/60">
            Leaderboard isn&apos;t set up yet — check back soon.
          </p>
        ) : entries.length === 0 ? (
          <p className="text-center font-body text-white/60">
            No scores yet — be the first.
          </p>
        ) : (
          <ol className="flex flex-col gap-2 font-body">
            {entries.map((entry, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-2"
              >
                <span className="flex items-center gap-2 truncate text-white/90">
                  <span className="w-6 shrink-0 text-right text-white/40">
                    {start + i + 1}
                  </span>
                  <span className="truncate">{entry.name}</span>
                  {entry.guest && (
                    <span title="Guest account" className="shrink-0">
                      <GuestIcon className="h-3.5 w-3.5 text-white/40" />
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-heading text-lg text-white">
                  {entry.score}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {hasNextPage && (
        <a
          href={`/games/leaderboard?game=${game.slug}&page=${page + 1}`}
          className="font-medium underline underline-offset-4"
        >
          Next page →
        </a>
      )}

      <a href="/games" className="font-medium underline underline-offset-4">
        ← Games
      </a>

      <p className="font-body text-sm font-bold text-white/70">
        Issues or suggestions? Contact me, or find my email in my{" "}
        <a href="/cv" className="underline underline-offset-2 hover:text-white">
          CV
        </a>
        .
      </p>
    </main>
  );
}
