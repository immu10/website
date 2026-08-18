// app/games/tetris/page.js  ->  served at /games/tetris

import TetrisGame from "./TetrisGame";

export const metadata = { title: "Tetris — immu10" };

export default function TetrisPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <a
        href="/games"
        className="self-start font-medium underline underline-offset-4"
      >
        ← Games
      </a>

      <h1 className="font-heading head-white-pink text-4xl sm:text-5xl">
        Tetris
      </h1>

      <TetrisGame />

      <a href="/games" className="font-medium underline underline-offset-4">
        ← Games
      </a>
    </main>
  );
}
