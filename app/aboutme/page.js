// app/aboutme/page.js  ->  served at /aboutme

import AboutMeShowcase from "./AboutMeShowcase";

export default function AboutMe() {
  return (
    <main className="flex flex-1 flex-col items-center gap-10 p-8 text-center">
      <a
        href="/home"
        className="self-start font-medium underline underline-offset-4"
      >
        ← Back to home
      </a>

      {/* Intro hero — centered in the viewport; scroll down for the showcase */}
      <section className="flex min-h-[85vh] flex-col items-center justify-center gap-6">
        <h1 className="font-heading head-white-pink text-4xl sm:text-5xl">
          I'm also immu10
        </h1>

        <p className="font-desc body-accent max-w-md text-2xl sm:text-3xl">
          On the occasional off chance I have an idea, I make an app, but besides
          my productivity aspects, I play a lot of games, watch a lot of shows, and listen
          to music almost always. I like sleeping even though I'm an insomniac. My plans
          are to work in the indie gaming industry after I've burnt myself out with the
          corporate world and possibly open a coffee shop in the future.
        </p>

        <span className="font-body text-sm text-white/40">scroll down ↓</span>
      </section>

      {/* ---------------- Showcase: 2x2 tiles ---------------- */}
      <AboutMeShowcase />

      <a href="/home" className="font-medium underline underline-offset-4">
        ← Back to home
      </a>
    </main>
  );
}
