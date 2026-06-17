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
  splitOutSection,
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

  const renderMd = (md) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        img: (props) => <img {...props} src={fixImg(props.src)} />,
        // Drop section-divider rules (--- in the README).
        hr: () => null,
      }}
    >
      {md}
    </ReactMarkdown>
  );

  // Overview pairs with the video on the left; the rest goes on the right.
  const { section: overviewMd, rest: restMd } = splitOutSection(
    markdown,
    "overview"
  );

  const player = project.video && (
    <div className="aspect-video w-full overflow-hidden rounded-xl ring-1 ring-white/10">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${project.video}?rel=0`}
        title={`${project.title} demo`}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );

  const footerLinks = (
    <div className="flex flex-col items-start gap-4">
      <a
        href={project.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-white/10 px-4 py-2 font-body text-sm text-white/80 ring-1 ring-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
      >
        Read the full README on GitHub ↗
      </a>
      <a href="/projects" className="font-medium underline underline-offset-4">
        ← Projects
      </a>
    </div>
  );

  // Independent-scroll panes (desktop only). Scroll works; scrollbars hidden.
  const scrollPane =
    "no-scrollbar lg:min-h-0 lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <main
      className={`mx-auto flex w-full flex-1 flex-col gap-6 overflow-x-hidden p-6 sm:p-8 ${
        project.video
          ? "max-w-[1760px] lg:h-dvh lg:flex-none lg:overflow-hidden"
          : "max-w-3xl"
      }`}
    >
      {/* back link — top left */}
      <a
        href="/projects"
        className="self-start font-medium underline underline-offset-4"
      >
        ← Projects
      </a>

      {/* title block — centered */}
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-heading head-white-pink text-4xl sm:text-5xl">
          {project.title}
        </h1>
        {project.description && (
          <p className="font-desc body-accent text-2xl sm:text-3xl">
            {project.description}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
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

      {project.video ? (
        // Two cards, each its own independent (hidden) scroll pane on desktop.
        // Stacks below xl; min-w-0 lets wide code/tables scroll inside, not the page.
        <div className="grid gap-10 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(360px,560px)_minmax(0,1fr)] lg:[grid-template-rows:minmax(0,1fr)]">
          <aside className={`min-w-0 ${scrollPane}`}>
            <div className="flex flex-col gap-4 rounded-xl bg-black/20 p-5 ring-1 ring-white/10 backdrop-blur-sm">
              <div className="text-center font-body text-xs uppercase tracking-wide text-white/40">
                Demo
              </div>
              {player}
              {overviewMd && (
                <article className="markdown markdown-center">
                  {renderMd(overviewMd)}
                </article>
              )}
            </div>
          </aside>
          <div className={`flex min-w-0 flex-col gap-6 ${scrollPane}`}>
            <article className="markdown markdown-center rounded-xl bg-black/20 p-5 ring-1 ring-white/10 backdrop-blur-sm sm:p-6">
              {renderMd(restMd)}
            </article>
            {footerLinks}
          </div>
        </div>
      ) : (
        <>
          <article className="markdown">{renderMd(markdown)}</article>
          {footerLinks}
        </>
      )}
    </main>
  );
}
