// Rebuilds app/data/projects-snapshot.json from the live GitHub API.
// Run daily by .github/workflows/refresh-projects-snapshot.yml using the
// workflow's own built-in token — independent of the site's personal
// GITHUB_TOKEN (Vercel env var), which is what the live site uses and what
// can expire. If this script fails, it exits non-zero and the workflow
// leaves the previous committed snapshot untouched, so the site keeps
// serving the last known-good "last build" instead of an empty page.
//
// Mirrors the parsing logic in app/lib/github.js. Keep the two in sync if
// the README conventions (## Screenshot, ## Live Demo, ## Tags, ...) change.

import { writeFile } from "node:fs/promises";

const USER = "immu10";
const HIDE_TOPIC = "no-site";
const OUT_PATH = new URL("../app/data/projects-snapshot.json", import.meta.url);

function headers(accept = "application/vnd.github+json") {
  const h = { Accept: accept, "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

function prettify(name) {
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function absoluteRaw(slug, src) {
  if (!src || /^https?:\/\//.test(src)) return src;
  return `https://raw.githubusercontent.com/${USER}/${slug}/HEAD/${src.replace(/^\.?\//, "")}`;
}

function firstHeading(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function youtubeId(md) {
  const m = md.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function screenshotImage(md) {
  let inSection = false;
  for (const line of md.split("\n")) {
    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h && h[1].length <= 2) {
      const title = h[2].toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      inSection = h[1].length === 2 && title === "screenshot";
      continue;
    }
    if (inSection) {
      const mdImg = line.match(/!\[[^\]]*\]\(([^)\s]+)/);
      if (mdImg) return mdImg[1];
      const htmlImg = line.match(/<img[^>]*\ssrc=["']([^"']+)["']/i);
      if (htmlImg) return htmlImg[1];
    }
  }
  return null;
}

function liveDemo(md) {
  let inSection = false;
  const lines = [];
  for (const line of md.split("\n")) {
    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h && h[1].length <= 2) {
      const title = h[2].toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      inSection = h[1].length === 2 && title === "live demo";
      continue;
    }
    if (inSection) lines.push(line);
  }

  const content = lines.join("\n").trim();
  if (!content) return null;

  const contentLines = content.split("\n");
  const first = contentLines[0].trim();
  const mdLink = first.match(/\]\(([^)\s]+)/);
  const bare = first.match(/https?:\/\/\S+/);
  const url = mdLink ? mdLink[1] : bare ? bare[0] : null;
  const note = (url ? contentLines.slice(1) : contentLines).join("\n").trim();

  return { url, note: note || null };
}

function readmeTags(md) {
  const lines = md.split("\n");
  const block = [];
  let inTags = false;

  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h && h[1].length <= 2) {
      const title = h[2].toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      inTags = h[1].length === 2 && title === "tags";
      continue;
    }
    if (inTags) block.push(line);
  }

  const text = block.join("\n");
  let tags = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  if (!tags.length) {
    const firstLine = text.split("\n").map((s) => s.trim()).find(Boolean) || "";
    tags = firstLine.split(/[·,|]/).map((s) => s.trim()).filter(Boolean);
  }
  return tags;
}

function courseTags(md) {
  const m = md.match(/college course project\s*(?:\(([^)]+)\)|for\s+([^.\n]+))/i);
  if (!m) return [];
  const subject = (m[1] || m[2] || "").trim().replace(/[.\s]+$/, "");
  return subject ? ["college project", subject] : ["college project"];
}

async function getReadme(slug) {
  const res = await fetch(`https://api.github.com/repos/${USER}/${slug}/readme`, {
    headers: headers("application/vnd.github.raw"),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`readme fetch failed for ${slug}: ${res.status}`);
  return res.text();
}

async function getProjects() {
  const res = await fetch(
    `https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed&type=owner`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`repos fetch failed: ${res.status}`);

  const repos = await res.json();
  const candidates = repos.filter(
    (r) => !r.fork && !r.private && !(r.topics || []).includes(HIDE_TOPIC)
  );

  const projects = await Promise.all(
    candidates.map(async (r) => {
      const readme = await getReadme(r.name);
      if (!readme) return null;
      const topics = (r.topics || []).filter((t) => t !== HIDE_TOPIC);
      return {
        slug: r.name,
        title: firstHeading(readme) || prettify(r.name),
        description: r.description || "",
        tags: [...new Set([...readmeTags(readme), ...topics, ...courseTags(readme)])],
        homepage: r.homepage || null,
        htmlUrl: r.html_url,
        archived: r.archived,
        pushedAt: r.pushed_at,
        video: youtubeId(readme),
        screenshot: absoluteRaw(r.name, screenshotImage(readme)),
        demo: liveDemo(readme),
      };
    })
  );

  const rank = (p) => {
    const video = Boolean(p.video);
    const demo = Boolean(p.demo && p.demo.url);
    if (video && demo) return 0;
    if (video) return 1;
    if (demo) return 2;
    if (p.screenshot) return 3;
    return 4;
  };

  return projects.filter(Boolean).sort((a, b) => rank(a) - rank(b));
}

const projects = await getProjects();

if (projects.length === 0) {
  console.error("refresh-projects-snapshot: got 0 projects — refusing to overwrite the snapshot.");
  process.exit(1);
}

await writeFile(
  OUT_PATH,
  JSON.stringify({ generatedAt: new Date().toISOString(), projects }, null, 2) + "\n"
);

console.log(`refresh-projects-snapshot: wrote ${projects.length} projects.`);
