// app/home/page.js  ->  served at /home  (the real landing content)

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      {/* heading: white in light mode, pink in dark mode */}
      <h1 className="font-heading head-white-pink text-4xl sm:text-6xl">
        Hi, I'm Immanuel
      </h1>

      {/* brief description -> Caveat, mint/aqua-green */}
      <p className="font-desc max-w-md text-2xl sm:text-3xl text-[#6cf0bf]">
       I am very much a consumer of media, I like making apps too and I'm on the hunt
       for a role in Software Engineering .
      </p>

      {/* three buttons (first two are placeholders for now; third is the CV) */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href="/about"
          className="rounded-full bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
        >
          Lorem ipsum
        </a>
        <a
          href="#"
          className="rounded-full bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
        >
          Lorem ipsum
        </a>
        <a
          href="/cv"
          className="rounded-full bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
        >
          CV
        </a>
      </div>
    </main>
  );
}
