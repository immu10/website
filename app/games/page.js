// app/games/page.js  ->  served at /games
// Lists playable minigames as tiles; each links to its own /games/<slug> page.

import Link from "next/link";
import { GAMES } from "./gamesList";
import AuthWidget from "./AuthWidget";

export default function Games() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <a href="/home" className="font-medium underline underline-offset-4">
          ← Back to home
        </a>
        <div className="flex items-center gap-3">
          <AuthWidget />
          <Link
            href="/games/leaderboard"
            className="rounded-full bg-white/10 px-4 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      <h1 className="font-heading head-white-pink text-4xl sm:text-5xl">Games</h1>

      <p className="font-desc body-accent max-w-md text-center text-xl">
        A few minigames :p 
      </p>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => (
          <Link
            key={g.slug}
            href={`/games/${g.slug}`}
            className="flex flex-col overflow-hidden rounded-2xl bg-black/20 p-5 text-center ring-1 ring-white/10 backdrop-blur-sm transition-transform hover:-translate-y-1"
          >
            <h2 className="font-heading text-2xl head-white-pink">{g.title}</h2>
            <p className="mt-2 font-body text-sm text-white/70">
              {g.description}
            </p>
          </Link>
        ))}
      </div>

      <a href="/home" className="font-medium underline underline-offset-4">
        ← Back to home
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
