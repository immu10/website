"use client";
// Physics-driven particles on a 2D canvas, drawn as soft glowing specks (the
// "marine snow" look you liked) — NOT round bubbles. Each particle has a real
// position + velocity: it drifts upward, wobbles, and is pushed directly AWAY
// from the cursor (hard enough to fly off screen). Off-screen particles respawn.

import { useEffect, useRef } from "react";

const COUNT = 75; // how many specks
const REPEL_RADIUS = 85; // px around the cursor that pushes specks
const REPEL_FORCE = 3.5; // how hard the push is

export default function BubbleField({ dim = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // A reusable soft-dot sprite (radial fade). Drawing this with "lighter"
    // blending gives the gentle glowing-speck look, and it's cheap to reuse.
    const SP = 64;
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = SP;
    const sctx = sprite.getContext("2d");
    const g = sctx.createRadialGradient(SP / 2, SP / 2, 0, SP / 2, SP / 2, SP / 2);
    g.addColorStop(0, "rgba(220, 250, 255, 1)");
    g.addColorStop(0.4, "rgba(200, 245, 255, 0.35)");
    g.addColorStop(1, "rgba(200, 245, 255, 0)");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, SP, SP);

    let w = 0;
    let h = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    }
    resize();
    window.addEventListener("resize", resize);

    const mouse = { x: -9999, y: -9999, active: false };
    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onLeave = () => (mouse.active = false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerout", onLeave);

    // Create one speck. `fromBottom` makes respawns enter from below the screen.
    function makeSpeck(fromBottom) {
      const size = 6 + Math.random() * 16; // draw size of the soft dot
      return {
        x: Math.random() * w,
        y: fromBottom ? h + 20 + Math.random() * 60 : Math.random() * h,
        size,
        // brightness varies, like real snow; `dim` tones it down
        alpha: (dim ? 0.12 : 0.25) + Math.random() * (dim ? 0.26 : 0.45),
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.2 + Math.random() * 0.45), // negative = rising
        wob: Math.random() * Math.PI * 2,
        wobSpeed: 0.01 + Math.random() * 0.03,
      };
    }
    const specks = Array.from({ length: COUNT }, () => makeSpeck(false));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf;
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(33, now - last) / 16.67; // ~1.0 at 60fps
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter"; // additive glow

      for (const b of specks) {
        b.wob += b.wobSpeed * dt;

        // cursor repulsion: push directly away, stronger the closer it is
        if (mouse.active) {
          const dx = b.x - mouse.x;
          const dy = b.y - mouse.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          if (dist < REPEL_RADIUS) {
            const f = 1 - dist / REPEL_RADIUS; // 1 at cursor -> 0 at edge
            b.vx += (dx / dist) * f * f * REPEL_FORCE * dt;
            b.vy += (dy / dist) * f * f * REPEL_FORCE * dt;
          }
        }

        // ease velocity back toward a calm rise (momentum, then settle)
        b.vx += (0 - b.vx) * 0.03 * dt;
        b.vy += (-0.3 - b.vy) * 0.03 * dt;

        // integrate position
        b.x += (b.vx + Math.sin(b.wob) * 0.25) * dt;
        b.y += b.vy * dt;

        // respawn when it leaves the screen
        if (b.y < -30 || b.x < -50 || b.x > w + 50 || b.y > h + 80) {
          Object.assign(b, makeSpeck(true));
        }

        // draw the soft speck
        ctx.globalAlpha = b.alpha;
        ctx.drawImage(sprite, b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (!reduce) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
    };
  }, [dim]);

  return <canvas ref={ref} aria-hidden className="bubble-field" />;
}
