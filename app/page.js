// app/page.js
// This is your homepage. Anything you `return` here gets rendered at "/".
// It's a React component — a function that returns JSX (HTML-like markup).
// The `className` strings are Tailwind CSS utility classes for styling.

export default function Home() {
  return (
    // Analogous scheme: colours next to the turquoise background (~188°) on the
    // wheel — light blue (~215°) and mint/aqua-green (~158°). Harmonious, not clashing.
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      {/* Heading-colour tryouts against the turquoise bg — pick one. */}
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-sky-200/70">
            Orange · #ff8c42
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl text-[#ff8c42]">
            Lorem Ipsum Dolor
          </h1>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-sky-200/70">
            Amber / Gold · #ffb703
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl text-[#ffb703]">
            Lorem Ipsum Dolor
          </h1>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-sky-200/70">
            Coral · #ff6a4d
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl text-[#ff6a4d]">
            Lorem Ipsum Dolor
          </h1>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-sky-200/70">
            Pink · #ff5e9c
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl text-[#ff5e9c]">
            Lorem Ipsum Dolor
          </h1>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-sky-200/70">
            Cream · #f3ead6
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl text-[#f3ead6]">
            Lorem Ipsum Dolor
          </h1>
        </div>
      </div>

      {/* brief description -> Caveat, mint/aqua-green */}
      <p className="font-desc max-w-md text-2xl sm:text-3xl text-[#6cf0bf]">
        Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore
        et dolore magna aliqua.
      </p>

      {/* link / body text -> Comic Sans (the page default) */}
      <a
        href="/about"
        className="rounded-full bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
      >
        Lorem ipsum →
      </a>
    </main>
  );
}
