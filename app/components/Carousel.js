"use client";

// Screenshot carousel: auto-advances every 5s, with left/right arrows for
// manual navigation (which also resets the auto-advance timer). Click the
// image to open a fullscreen lightbox (same nav, Esc/backdrop to close).
// Renders a single plain (still click-to-expand) image when there's only
// one screenshot.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function Carousel({ images, alt }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Portal target isn't available during SSR; only render it once mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (images.length <= 1 || lightboxOpen) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 5000);
    return () => clearInterval(id);
  }, [images.length, index, lightboxOpen]);

  const go = (delta) => setIndex((i) => (i + delta + images.length) % images.length);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, images.length]);

  if (images.length === 0) return null;

  const lightbox = mounted && lightboxOpen && createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={() => setLightboxOpen(false)}
    >
      <button
        type="button"
        onClick={() => setLightboxOpen(false)}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
      >
        ×
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt={`${alt} (${index + 1} of ${images.length})`}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous screenshot"
            className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Next screenshot"
            className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                aria-label={`Go to screenshot ${i + 1}`}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === index ? "bg-white" : "bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );

  if (images.length === 1) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[0]}
          alt={alt}
          onClick={() => setLightboxOpen(true)}
          className="w-full cursor-zoom-in overflow-hidden rounded-xl ring-1 ring-white/10"
        />
        {lightbox}
      </>
    );
  }

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt={`${alt} (${index + 1} of ${images.length})`}
        onClick={() => setLightboxOpen(true)}
        className="h-full w-full cursor-zoom-in object-cover"
      />

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous screenshot"
        className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-lg text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next screenshot"
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-lg text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100"
      >
        ›
      </button>

      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to screenshot ${i + 1}`}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i === index ? "bg-white" : "bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>

      {lightbox}
    </div>
  );
}
