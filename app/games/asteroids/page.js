// app/games/asteroids/page.js  ->  served at /games/asteroids

import AsteroidsGame from "./AsteroidsGame";
import AuthWidget from "@/app/games/AuthWidget";

export const metadata = { title: "Asteroids — immu10" };

export default function AsteroidsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <a href="/games" className="font-medium underline underline-offset-4">
          ← Games
        </a>
        <AuthWidget />
      </div>

      <h1 className="font-heading head-white-pink text-4xl sm:text-5xl">
        Asteroids
      </h1>

      <AsteroidsGame />

      <a href="/games" className="font-medium underline underline-offset-4">
        ← Games
      </a>
    </main>
  );
}
