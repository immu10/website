// app/subnautica/page.js  ->  served at /subnautica
// Subnautica-themed shallows: turquoise water, god rays, caustics, marine snow,
// and a Peeper swimming across.

import CausticsCanvas from "../components/CausticsCanvas";
import Peeper from "../components/Peeper";

export default function Subnautica() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <CausticsCanvas mode="subnautica" />
      <Peeper />

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl drop-shadow">
        Subnautica
      </h1>
      <p className="max-w-md text-lg text-sky-100 drop-shadow">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. A peeper drifts
        past while the sun cuts through the shallows.
      </p>

      <nav className="flex flex-wrap justify-center gap-5 text-sm font-medium text-sky-100/90">
        <a href="/" className="underline underline-offset-4 hover:text-white">
          Home
        </a>
        <a href="/depth" className="underline underline-offset-4 hover:text-white">
          Depth
        </a>
        <a href="/topdown" className="underline underline-offset-4 hover:text-white">
          Top-down
        </a>
        <span className="text-white">Subnautica</span>
      </nav>
    </main>
  );
}
