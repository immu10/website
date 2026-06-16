// app/aboutme/page.js  ->  served at /aboutme

import NowPlaying from "../components/showcase/NowPlaying";
import TopTracks from "../components/showcase/TopTracks";
import SteamGames from "../components/showcase/SteamGames";
import ShowsMovies from "../components/showcase/ShowsMovies";
import ManhwaList from "../components/showcase/ManhwaList";

// Shared tile styling.
const tile =
  "flex flex-col gap-4 rounded-2xl bg-black/10 p-5 ring-1 ring-white/10 backdrop-blur-sm";

export default function AboutMe() {
  return (
    <main className="flex flex-1 flex-col items-center gap-10 p-8 text-center">
      {/* Intro hero — centered in the viewport; scroll down for the showcase */}
      <section className="flex min-h-[85vh] flex-col items-center justify-center gap-6">
        <h1 className="font-heading head-white-pink text-4xl sm:text-5xl">
          I'm also immu10
        </h1>

        <p className="font-desc max-w-md text-2xl sm:text-3xl text-[#6cf0bf]">
          On the occasional off chance I have an idea, I make an app, but besides
          my productivity aspects, I play a lot of games, watch a lot of shows, and listen
          to music almost always. I like sleeping even though I'm an insomniac. My plans
          are to work in the indie gaming industry after I've burnt myself out with the
          corporate world and possibly open a coffee shop in the future.
        </p>

        <span className="font-body text-sm text-white/40">scroll down ↓</span>
      </section>

      {/* ---------------- Showcase: 2x2 tiles ---------------- */}
      <section className="grid w-full max-w-5xl items-start gap-6 sm:grid-cols-2">
        {/* Music — left */}
        <div className={tile}>
          <h2 className="font-heading text-2xl head-white-pink">Music</h2>
          <NowPlaying />
          <TopTracks />
        </div>

        {/* Games — right */}
        <div className={tile}>
          <h2 className="font-heading text-2xl head-white-pink">Games</h2>
          <SteamGames />
        </div>

        {/* Shows / Movies — left */}
        <div className={tile}>
          <h2 className="font-heading text-2xl head-white-pink">Shows / Movies</h2>
          <ShowsMovies />
        </div>

        {/* Manhwas — right */}
        <div className={tile}>
          <h2 className="font-heading text-2xl head-white-pink">Manhwas</h2>
          <ManhwaList />
        </div>
      </section>

      <a href="/home" className="font-medium underline underline-offset-4">
        ← Back to home
      </a>
    </main>
  );
}
