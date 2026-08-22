// app/games/musicrunner/page.js  ->  served at /games/musicrunner

import MusicRunnerGame from "./MusicRunnerGame";
import AuthWidget from "../AuthWidget";

export const metadata = { title: "Beat Runner — immu10" };

export default function MusicRunnerPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <a href="/games" className="font-medium underline underline-offset-4">
          ← Games
        </a>
        <AuthWidget />
      </div>

      <h1 className="font-heading head-white-pink text-4xl sm:text-5xl">
        Beat Runner
      </h1>

      <MusicRunnerGame />

      <a href="/games" className="font-medium underline underline-offset-4">
        ← Games
      </a>
    </main>
  );
}
