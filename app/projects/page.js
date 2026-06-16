// app/projects/page.js  ->  served at /projects

const projects = [
  {
    title: "Lorem ipsum",
    blurb: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  },
  {
    title: "Lorem ipsum",
    blurb: "Sed do eiusmod tempor incididunt ut labore et dolore magna.",
  },
  {
    title: "Lorem ipsum",
    blurb: "Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
  },
];

export default function Projects() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8">
      <h1 className="font-heading text-4xl sm:text-5xl">Lorem ipsum</h1>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p, i) => (
          <article
            key={i}
            className="flex flex-col overflow-hidden rounded-2xl bg-black/20 ring-1 ring-white/10 backdrop-blur-sm transition-transform hover:-translate-y-1"
          >
            {/* placeholder image */}
            <div className="flex aspect-video items-center justify-center bg-white/5 text-sm text-white/40">
              image
            </div>

            <div className="flex flex-col gap-2 p-5 text-center">
              <h2 className="font-heading text-2xl">{p.title}</h2>
              <p className="font-desc text-lg text-sky-100">{p.blurb}</p>
            </div>
          </article>
        ))}
      </div>

      <a href="/home" className="font-medium underline underline-offset-4">
        ← Lorem ipsum
      </a>
    </main>
  );
}
