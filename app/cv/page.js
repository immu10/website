// app/cv/page.js  ->  served at /cv
// Clean custom PDF viewer + download + open-in-new-tab.
//
// The PDF URL carries a ?v=<mtime> query param derived from public/cv.pdf's
// last-modified time. react-pdf fetches the file via its own JS fetch() call
// after the page loads, which a browser hard-refresh doesn't force to bypass
// cache — so without a changing URL, an updated CV can keep showing the old
// cached PDF in the embedded viewer for up to Cache-Control's max-age. A
// version query string sidesteps that entirely: the URL itself changes
// whenever the file does, so it's always a cache miss for a new CV.

import fs from "node:fs";
import path from "node:path";
import CVPageClient from "./CVPageClient";

function cvVersion() {
  try {
    const stat = fs.statSync(path.join(process.cwd(), "public", "cv.pdf"));
    return String(Math.floor(stat.mtimeMs));
  } catch {
    return "0";
  }
}

export default function CV() {
  const pdfUrl = `/cv.pdf?v=${cvVersion()}`;
  return <CVPageClient pdfUrl={pdfUrl} />;
}
