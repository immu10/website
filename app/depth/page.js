// app/depth/page.js  ->  served at /depth
// Depth view: side-on, sun shafts punching down through the water and fading.

import CausticsCanvas from "../components/CausticsCanvas";

export default function Depth() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <CausticsCanvas mode="depth" />

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Depth view
      </h1>
      <p className="max-w-md text-lg text-sky-100">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore.
      </p>

      <nav className="flex gap-5 text-sm font-medium text-sky-100/90">
        <a href="/" className="underline underline-offset-4 hover:text-white">
          Home
        </a>
        <span className="text-white">Depth</span>
        <a href="/topdown" className="underline underline-offset-4 hover:text-white">
          Top-down view
        </a>
      </nav>
    </main>
  );
}
