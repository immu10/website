// Pulls projects from GitHub. A repo shows on the site when it is:
//   public, owned by USER, not a fork, NOT tagged `no-site`, and has a README.
// Archived repos are included. Sorted by most recently pushed.
//
// Optional: set GITHUB_TOKEN (read-only) to lift the 60 req/hr rate limit.

export const USER = "immu10";
const HIDE_TOPIC = "no-site";
const REVALIDATE = 86400; // re-pull from GitHub once a day

function headers(accept = "application/vnd.github+json") {
  const h = { Accept: accept, "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// "fetcher-bot" / "fetcher_bot" -> "Fetcher Bot"
function prettify(name) {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Resolve a (possibly relative) README image path to an absolute raw URL.
function absoluteRaw(slug, src) {
  if (!src || /^https?:\/\//.test(src)) return src;
  return `https://raw.githubusercontent.com/${USER}/${slug}/HEAD/${src.replace(/^\.?\//, "")}`;
}

function firstHeading(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

// First YouTube video id found in a README (watch / youtu.be / embed / shorts).
function youtubeId(md) {
  const m = md.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

// First image found under a "## Screenshot" section, e.g.:
//   ## Screenshot
//   ![alt](docs/shot.png)
// Returns the raw src (possibly relative — resolved to a full URL at render time).
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

// A "## Live Demo" section, e.g.:
//   ## Live Demo
//   https://example.com
//   Login: demo / Password: test123
// First content line -> the URL (bare or markdown [text](url) link).
// Anything after it -> a note rendered under the button (e.g. demo credentials).
// Returns { url, note } or null.
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
  // If the first line was the URL, the note is everything after it; otherwise
  // there's no URL and the whole section is the note.
  const note = (url ? contentLines.slice(1) : contentLines).join("\n").trim();

  return { url, note: note || null };
}

// Pull keywords from a "## Tags" section, e.g.:
//   ## Tags
//   `LLM` · `Qt` · `Qwen` · `OCR`
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
  // Prefer `backtick` tokens; fall back to splitting on · , | separators.
  let tags = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  if (!tags.length) {
    const firstLine = text.split("\n").map((s) => s.trim()).find(Boolean) || "";
    tags = firstLine.split(/[·,|]/).map((s) => s.trim()).filter(Boolean);
  }
  return tags;
}

// If a README says e.g. "This was a college course project (NLP)" or
// "...college course project for Cryptography.", turn that into tags:
// ["college project", "NLP"] / ["college project", "Cryptography"].
function courseTags(md) {
  const m = md.match(
    /college course project\s*(?:\(([^)]+)\)|for\s+([^.\n]+))/i
  );
  if (!m) return [];
  const subject = (m[1] || m[2] || "").trim().replace(/[.\s]+$/, "");
  return subject ? ["college project", subject] : ["college project"];
}

// Raw README markdown for a repo, or null if it has none.
export async function getReadme(slug) {
  const res = await fetch(
    `https://api.github.com/repos/${USER}/${slug}/readme`,
    { headers: headers("application/vnd.github.raw"), next: { revalidate: REVALIDATE } }
  );
  if (!res.ok) return null;
  return res.text();
}

// All repos that qualify for the site, newest first.
export async function getProjects() {
  const res = await fetch(
    `https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed&type=owner`,
    { headers: headers(), next: { revalidate: REVALIDATE } }
  );
  if (!res.ok) return [];

  const repos = await res.json();

  const candidates = repos.filter(
    (r) =>
      !r.fork &&
      !r.private &&
      !(r.topics || []).includes(HIDE_TOPIC)
  );

  // Keep only repos that have a README; title comes from its first heading.
  const projects = await Promise.all(
    candidates.map(async (r) => {
      const readme = await getReadme(r.name);
      if (!readme) return null; // no README -> not showcased
      const topics = (r.topics || []).filter((t) => t !== HIDE_TOPIC);
      return {
        slug: r.name,
        title: firstHeading(readme) || prettify(r.name),
        description: r.description || "",
        // README "## Tags" + GitHub topics + auto-detected course tags (de-duped).
        tags: [
          ...new Set([
            ...readmeTags(readme),
            ...topics,
            ...courseTags(readme),
          ]),
        ],
        homepage: r.homepage || null,
        htmlUrl: r.html_url,
        archived: r.archived,
        pushedAt: r.pushed_at,
        // YouTube video id (if the README links one) -> embed + tile thumbnail.
        video: youtubeId(readme),
        // First image under a "## Screenshot" section (absolute URL), if any.
        screenshot: absoluteRaw(r.name, screenshotImage(readme)),
        // "## Live Demo" section -> { url, note } -> button + note on the page.
        demo: liveDemo(readme),
      };
    })
  );

  // Sort by media richness (stable — ties keep the API's pushed-desc order):
  //   1. video + live demo   2. video only   3. live demo only
  //   4. screenshot only      5. none
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

export async function getProject(slug) {
  const projects = await getProjects();
  return projects.find((p) => p.slug === slug) || null;
}

// Keep only these top-level (##) sections of a README; drop the rest.
const SHOW_SECTIONS = new Set(["overview", "architecture", "tech stack"]);

export function filterSections(md) {
  const lines = md.split("\n");
  const out = [];
  let keep = false;
  let matchedAny = false;

  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h) {
      const level = h[1].length;
      if (level <= 2) {
        // normalise heading text: lowercase, strip emoji/punctuation
        const title = h[2].toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
        keep = level === 2 && SHOW_SECTIONS.has(title);
        if (keep) matchedAny = true;
      }
      // level >= 3 (### …) inherits the current section's keep state
    }
    if (keep) out.push(line);
  }

  // Fallback: if a README has none of these sections (e.g. not yet formatted),
  // show it in full rather than a blank page.
  return matchedAny ? out.join("\n").trim() : md;
}

// Split a markdown string into one named ## section vs everything else.
// Returns { section, rest } (both trimmed strings; section "" if not found).
export function splitOutSection(md, name) {
  const want = name.toLowerCase();
  const section = [];
  const rest = [];
  let inWanted = false;

  for (const line of md.split("\n")) {
    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h && h[1].length <= 2) {
      const title = h[2].toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      inWanted = h[1].length === 2 && title === want;
    }
    (inWanted ? section : rest).push(line);
  }

  return { section: section.join("\n").trim(), rest: rest.join("\n").trim() };
}
