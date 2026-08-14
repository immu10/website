"use client";

// Screenshot carousel: auto-advances every 5s, with left/right arrows for
// manual navigation (which also resets the auto-advance timer). Renders a
// single plain image when there's only one screenshot.

import { useEffect, useState } from "react";

export default function Carousel({ images, alt }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 5000);
    return () => clearInterval(id);
  }, [images.length, index]);

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={images[0]}
        alt={alt}
        className="w-full overflow-hidden rounded-xl ring-1 ring-white/10"
      />
    );
  }

  const go = (delta) => setIndex((i) => (i + delta + images.length) % images.length);

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt={`${alt} (${index + 1} of ${images.length})`}
        className="h-full w-full object-cover"
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
    </div>
  );
}
