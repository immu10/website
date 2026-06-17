// app/projects/page.js  ->  served at /projects
// Auto-generated from GitHub: every public, owned, non-fork repo that isn't
// tagged `no-site` and has a README.

import Link from "next/link";
import { getProjects } from "../lib/github";

export default async function Projects() {
  const projects = await getProjects();

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8">
      <a
        href="/home"
        className="self-start font-medium underline underline-offset-4"
      >
        ← Back to home
      </a>

      <h1 className="font-heading head-white-pink text-4xl sm:text-5xl">Projects</h1>

      {projects.length === 0 ? (
        <p className="font-desc text-xl text-sky-100">
          Nothing to show yet — check back soon.
        </p>
      ) : (
        <div className="grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.slug}
              href={`/projects/${p.slug}`}
              className="flex flex-col overflow-hidden rounded-2xl bg-black/20 ring-1 ring-white/10 backdrop-blur-sm transition-transform hover:-translate-y-1"
            >
              <div className="relative flex aspect-video items-center justify-center bg-white/5 p-4 text-center">
                {p.video ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://img.youtube.com/vi/${p.video}/hqdefault.jpg`}
                      alt={p.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
                      ▶
                    </span>
                  </>
                ) : p.screenshot ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.screenshot}
                    alt={p.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-heading text-xl text-white/70">
                    {p.title}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-5 text-center">
                <h2 className="font-heading text-2xl head-white-pink">
                  {p.title}
                </h2>
                {p.description && (
                  <p className="font-desc text-lg text-sky-100">
                    {p.description}
                  </p>
                )}
                {p.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-white/10 px-2 py-0.5 font-body text-xs text-white/70"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <a href="/home" className="font-medium underline underline-offset-4">
        ← Back to home
      </a>
    </main>
  );
}
