"use client";
// A small school of Peepers swimming across the background on their own
// transparent, full-screen canvas (behind the page content, click-through).
// The sprite sheet is a 4x2 grid of 8 frames, 120x60 each; the base sprite
// faces LEFT, so fish swimming right are drawn flipped horizontally.
//
// - Fish count is randomised each load.
// - Each fish gets a random base swim speed.
// - The tail-flap animation is tied to distance travelled, so a faster fish
//   flaps faster (and a scared, darting fish flaps frantically).
// - Cursor scare: when the mouse comes near a fish it darts AWAY with a speed
//   burst that decays back to its calm cruising speed.

import { useEffect, useRef } from "react";

const SHEET = "/peeper_swim_pixel.png";
const COLS = 4;
const ROWS = 2;
const FRAMES = COLS * ROWS; // 8
const FRAME_W = 120;
const FRAME_H = 60;

const MIN_COUNT = 2; // fish count is random in [MIN_COUNT, MAX_COUNT]
const MAX_COUNT = 6;
const SPEED_MIN = 22; // calm cruising speed range (px/sec)
const SPEED_MAX = 75;
const PX_PER_FRAME = 6; // advance one tail frame every N px travelled
const SCARE_RADIUS = 150; // px around a fish the cursor triggers a scare
const SCARE_BURST = 320; // flee speed (px/sec) away from the cursor when scared
const SCARE_DECAY = 0.6; // seconds for the burst to fall to ~1/e

export default function FishSwim() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = SHEET;

    let w = 0;
    let h = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
      ctx.imageSmoothingEnabled = false; // keep pixel art crisp
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

    // Spawn one fish entering from the edge it swims away from.
    function makeFish() {
      const scale = 0.8 + Math.random() * 0.9; // size variety
      const dir = Math.random() < 0.5 ? -1 : 1; // -1 left, 1 right
      const drawW = FRAME_W * scale;
      const drawH = FRAME_H * scale;
      return {
        scale,
        dir,
        drawW,
        drawH,
        x: dir === 1 ? -drawW : w + drawW,
        y: 40 + Math.random() * Math.max(60, h - 120),
        baseSpeed: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
        bvx: 0, // radial scare burst velocity (x), decays to 0
        bvy: 0, // radial scare burst velocity (y), decays to 0
        frame: Math.floor(Math.random() * FRAMES),
        frameDist: 0, // px travelled toward the next frame
        bob: Math.random() * Math.PI * 2,
        bobSpeed: 0.6 + Math.random() * 0.6,
        // slow vertical wander so paths meander instead of going dead straight
        wander: Math.random() * Math.PI * 2,
        wanderSpeed: 0.25 + Math.random() * 0.45,
      };
    }

    const count =
      MIN_COUNT + Math.floor(Math.random() * (MAX_COUNT - MIN_COUNT + 1));
    const fish = Array.from({ length: count }, makeFish);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf;
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); // seconds, clamped
      last = now;
      ctx.clearRect(0, 0, w, h);

      for (const f of fish) {
        const cy = f.y + Math.sin(f.bob) * 6; // bob applied for this frame

        // Scare: if the cursor is near, dart along the EXACT direction away
        // from it — a radial vector, not axis-aligned pushes.
        if (mouse.active) {
          const cx = f.x + f.drawW / 2;
          const ccy = cy + f.drawH / 2;
          const ax = cx - mouse.x;
          const ay = ccy - mouse.y;
          const dist = Math.hypot(ax, ay) || 0.001;
          if (dist < SCARE_RADIUS) {
            f.bvx = (ax / dist) * SCARE_BURST; // away on x
            f.bvy = (ay / dist) * SCARE_BURST; // away on y
            f.dir = ax >= 0 ? 1 : -1; // face the way it's fleeing
          }
        }

        // Burst velocity decays back toward calm cruising.
        f.bvx *= Math.exp(-dt / SCARE_DECAY);
        f.bvy *= Math.exp(-dt / SCARE_DECAY);

        // Velocity = horizontal cruise (along f.dir) + radial scare burst.
        const vx = f.dir * f.baseSpeed + f.bvx;
        const vy = f.bvy;
        const dx = vx * dt;
        const dy = vy * dt;
        f.x += dx;
        f.y += dy;

        // Tail flap tied to total distance actually travelled.
        f.frameDist += Math.hypot(dx, dy);
        while (f.frameDist >= PX_PER_FRAME) {
          f.frameDist -= PX_PER_FRAME;
          f.frame = (f.frame + 1) % FRAMES;
        }
        f.bob += f.bobSpeed * dt;

        // Gentle vertical wander (slow drift), clamped to stay on screen.
        f.wander += f.wanderSpeed * dt;
        f.y += Math.sin(f.wander) * 18 * dt; // px/sec at peak
        f.y = Math.max(20, Math.min(h - f.drawH - 20, f.y));

        // Respawn once fully off the far edge.
        if (f.dir === 1 && f.x > w + f.drawW)
          Object.assign(f, makeFish(), { x: -f.drawW, dir: 1 });
        else if (f.dir === -1 && f.x < -f.drawW)
          Object.assign(f, makeFish(), { x: w + f.drawW, dir: -1 });

        // Current frame's source rectangle on the sheet.
        const sx = (f.frame % COLS) * FRAME_W;
        const sy = Math.floor(f.frame / COLS) * FRAME_H;

        ctx.save();
        ctx.globalAlpha = 0.9;
        if (f.dir === 1) {
          // swimming right -> flip the left-facing sprite horizontally
          ctx.translate(f.x + f.drawW, cy);
          ctx.scale(-1, 1);
          ctx.drawImage(img, sx, sy, FRAME_W, FRAME_H, 0, 0, f.drawW, f.drawH);
        } else {
          ctx.drawImage(img, sx, sy, FRAME_W, FRAME_H, f.x, cy, f.drawW, f.drawH);
        }
        ctx.restore();
      }

      if (!reduce) raf = requestAnimationFrame(frame);
    }

    img.onload = () => {
      raf = requestAnimationFrame(frame);
    };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="fish-swim" />;
}
