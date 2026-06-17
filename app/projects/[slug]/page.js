// app/projects/[slug]/page.js  ->  served at /projects/<slug>
// Renders the repo's README pulled live from GitHub.

import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getProjects,
  getProject,
  getReadme,
  filterSections,
  USER,
} from "../../lib/github";

export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const project = await getProject(slug);
  return { title: project ? `${project.title} — immu10` : "Project" };
}

export default async function ProjectPage({ params }) {
  const { slug } = await params;

  // Validate against the showcase list (enforces no-site / fork / README rules).
  const project = await getProject(slug);
  if (!project) notFound();

  const raw = await getReadme(slug);
  if (!raw) notFound();
  // Strip HTML comments, then keep only the Overview / Architecture / Tech Stack
  // sections.
  const markdown = filterSections(raw.replace(/<!--[\s\S]*?-->/g, ""));

  // Turn relative README image paths into absolute raw.githubusercontent URLs.
  const fixImg = (src) => {
    if (!src || /^https?:\/\//.test(src)) return src;
    return `https://raw.githubusercontent.com/${USER}/${slug}/HEAD/${src.replace(/^\.?\//, "")}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <a href="/projects" className="font-medium underline underline-offset-4">
        ← Projects
      </a>

      <header className="flex flex-col gap-3">
        <h1 className="font-heading head-white-pink text-4xl sm:text-5xl">
          {project.title}
        </h1>
        {project.description && (
          <p className="font-desc body-accent text-2xl sm:text-3xl">
            {project.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {project.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-white/10 px-3 py-1 font-body text-xs text-white/70"
            >
              {t}
            </span>
          ))}
          <a
            href={project.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-white/10 px-3 py-1 font-body text-xs text-white/70 hover:bg-white/20"
          >
            GitHub ↗
          </a>
          {project.homepage && (
            <a
              href={project.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white/10 px-3 py-1 font-body text-xs text-white/70 hover:bg-white/20"
            >
              Live ↗
            </a>
          )}
        </div>
      </header>

      <article className="markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            img: (props) => <img {...props} src={fixImg(props.src)} />,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>

      <a
        href={project.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start rounded-full bg-white/10 px-4 py-2 font-body text-sm text-white/80 ring-1 ring-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
      >
        Read the full README on GitHub ↗
      </a>

      <a href="/projects" className="font-medium underline underline-offset-4">
        ← Projects
      </a>
    </main>
  );
}
