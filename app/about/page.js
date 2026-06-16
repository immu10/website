// app/about/page.js
// A folder inside `app/` becomes a URL route automatically.
// Because this file lives at app/about/page.js, it's served at "/about".

export default function About() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="font-heading text-4xl sm:text-5xl">Lorem ipsum</h1>

      <p className="font-desc max-w-md text-2xl sm:text-3xl text-sky-100">
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
        dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat.
      </p>

      <a href="/" className="font-medium underline underline-offset-4">
        ← Lorem ipsum
      </a>
    </main>
  );
}
