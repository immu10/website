"use client";
// Clean custom PDF viewer using react-pdf (pdf.js). Renders every page stacked
// on the page with no browser viewer chrome. Client-only (needs the DOM).

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker is served from public/ (copied from pdfjs-dist) — reliable, self-hosted.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function CVViewer() {
  const wrapRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(800);

  // Make pages fit the container width (and stay readable on mobile).
  useEffect(() => {
    function update() {
      if (wrapRef.current) setWidth(Math.min(820, wrapRef.current.clientWidth));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div ref={wrapRef} className="flex w-full max-w-3xl flex-col items-center gap-6">
      <Document
        file="/cv.pdf"
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<p className="text-sky-100">Loading CV…</p>}
        error={<p className="text-sky-100">Couldn’t load the CV.</p>}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl shadow-2xl">
            <Page pageNumber={i + 1} width={width} />
          </div>
        ))}
      </Document>
    </div>
  );
}
