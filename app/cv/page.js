// app/cv/page.js  ->  served at /cv
// Clean custom PDF viewer + download + open-in-new-tab.

"use client";

import dynamic from "next/dynamic";

// Load the viewer client-side only (react-pdf needs the browser).
const CVViewer = dynamic(() => import("../components/CVViewer"), {
  ssr: false,
  loading: () => <p className="text-sky-100">Loading CV…</p>,
});

export default function CV() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10">
      <a
        href="/home"
        className="self-start font-medium underline underline-offset-4"
      >
        ← Back to home
      </a>

      <CVViewer />

      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href="/cv.pdf"
          download
          className="rounded-full bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
        >
          ⬇ Download CV
        </a>
        <a
          href="/cv.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/40 px-6 py-3 font-medium text-white transition-colors hover:bg-white/10"
        >
          Open in new tab ↗
        </a>
      </div>

      <a href="/home" className="text-sm text-sky-100 underline underline-offset-4">
        ← Back to home
      </a>
    </main>
  );
}
