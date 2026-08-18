"use client";
// Client component: the game picker needs onChange navigation, which needs
// JS — the page itself stays a server component that reads ?game= directly.

import { useRouter } from "next/navigation";

export default function GameSelect({ games, selected }) {
  const router = useRouter();

  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/games/leaderboard?game=${e.target.value}`)}
      className="rounded-full bg-white/10 px-4 py-2 font-body font-medium text-white ring-1 ring-white/15 backdrop-blur-sm focus:outline-none"
    >
      {games.map((g) => (
        <option key={g.slug} value={g.slug} className="bg-black text-white">
          {g.title}
        </option>
      ))}
    </select>
  );
}
