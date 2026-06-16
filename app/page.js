// app/page.js
// This is your homepage. Anything you `return` here gets rendered at "/".
// It's a React component — a function that returns JSX (HTML-like markup).
// The `className` strings are Tailwind CSS utility classes for styling.

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
        Lorem ipsum dolor sit amet
      </h1>

      <p className="max-w-md text-lg text-sky-100">
        Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore
        et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud.
      </p>

      <a
        href="/about"
        className="rounded-full bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
      >
        Lorem ipsum →
      </a>
    </main>
  );
}
