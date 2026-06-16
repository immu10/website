// app/topdown/page.js  ->  served at /topdown
// Top-down view: looking straight down at the rippling caustic net.

import CausticsCanvas from "../components/CausticsCanvas";

export default function TopDown() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <CausticsCanvas mode="topdown" />

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Top-down view
      </h1>
      <p className="max-w-md text-lg text-sky-100">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore.
      </p>

      <nav className="flex gap-5 text-sm font-medium text-sky-100/90">
        <a href="/" className="underline underline-offset-4 hover:text-white">
          Home
        </a>
        <a href="/depth" className="underline underline-offset-4 hover:text-white">
          Depth
        </a>
        <span className="text-white">Top-down</span>
        <a href="/subnautica" className="underline underline-offset-4 hover:text-white">
          Subnautica
        </a>
      </nav>
    </main>
  );
}
