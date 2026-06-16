// app/home/page.js  ->  served at /home  (the real landing content)

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      {/* heading: white in light mode, pink in dark mode */}
      <h1 className="font-heading head-white-pink text-4xl sm:text-6xl">
        Hi, I'm Immanuel
      </h1>

      {/* brief description -> Caveat, mint/aqua-green */}
      <p className="font-desc body-accent max-w-md text-2xl sm:text-3xl">
       I am very much a consumer of media, I like making apps too and I'm on the hunt
       for a role in Software Engineering .
      </p>

      {/* three buttons (first two are placeholders for now; third is the CV) */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href="/aboutme"
          className="rounded-full bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white/10 dark:text-white dark:ring-1 dark:ring-white/15 dark:backdrop-blur-sm dark:hover:bg-white/20"
        >
          About me
        </a>
        <a
          href="/projects"
          className="rounded-full bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white/10 dark:text-white dark:ring-1 dark:ring-white/15 dark:backdrop-blur-sm dark:hover:bg-white/20"
        >
          Projects
        </a>
        <a
          href="/cv"
          className="rounded-full bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white/10 dark:text-white dark:ring-1 dark:ring-white/15 dark:backdrop-blur-sm dark:hover:bg-white/20"
        >
          CV
        </a>
      </div>
    </main>
  );
}
