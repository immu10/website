// app/aboutme/page.js  ->  served at /aboutme

export default function AboutMe() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="font-heading text-4xl sm:text-5xl">Lorem ipsum</h1>

      <p className="font-desc max-w-md text-2xl sm:text-3xl text-sky-100">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua.
      </p>

      <a href="/home" className="font-medium underline underline-offset-4">
        ← Lorem ipsum
      </a>
    </main>
  );
}
