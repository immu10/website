// app/sub2/page.js  ->  served at /sub2
// New version: domain-warped NOISE caustic (no grid) + toned-down specks.

import CausticsCanvas from "../components/CausticsCanvas";
import BubbleField from "../components/BubbleField";

export default function Sub2() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <CausticsCanvas variant="noise" />
      <BubbleField dim />

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl drop-shadow">
        Sub2
      </h1>
      <p className="max-w-md text-lg text-sky-100 drop-shadow">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Noise-based
        ripples — move your mouse to push the bubbles around.
      </p>

      <nav className="flex flex-wrap justify-center gap-5 text-sm font-medium text-sky-100/90">
        <a href="/" className="underline underline-offset-4 hover:text-white">
          Home
        </a>
        <a href="/subnautica" className="underline underline-offset-4 hover:text-white">
          Subnautica
        </a>
        <span className="text-white">Sub2</span>
      </nav>
    </main>
  );
}
