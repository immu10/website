# FishSwim.js — the coding & math, explained

A walkthrough of [`FishSwim.js`](./FishSwim.js): a tiny canvas "physics engine" that
swims a small school of Peepers across the home-page background. Almost every line is
one of **three patterns**:

| Pattern | Code shape | Used for |
|---|---|---|
| Integration | `value += rate * dt` | movement |
| Oscillation | `Math.sin(phase += speed*dt)` | bob / wander |
| Decay | `value *= Math.exp(-dt/τ)` | the scare burst fading out |

Master those three and you can build almost any "juicy" motion.

---

## 0. Big picture — the lifecycle

```
 mount (useEffect runs once)
        │
        ▼
 ┌─────────────────────────────┐
 │ setup                       │
 │  • get canvas + 2D context  │
 │  • load sprite sheet (img)  │
 │  • resize() the canvas      │
 │  • attach mouse listeners   │
 │  • makeFish() × random N    │
 └─────────────┬───────────────┘
               │ img.onload
               ▼
 ┌─────────────────────────────┐         requestAnimationFrame
 │ frame(now)  ◀───────────────┼──────────────┐  (~once per repaint)
 │  for each fish:             │               │
 │   1. scare check (vectors)  │               │
 │   2. decay the burst        │               │
 │   3. move  (x += vx*dt)     │               │
 │   4. advance sprite frame   │               │
 │   5. bob + wander           │               │
 │   6. respawn if off-screen  │               │
 │   7. draw (flip if →)       │               │
 └─────────────┬───────────────┘               │
               └───────────────────────────────┘
               │ unmount
               ▼
 cleanup: cancel rAF, remove listeners
```

---

## 1. The canvas & device-pixel-ratio (lines 45–53)

A screen pixel isn't always one "CSS pixel." On a retina/4K display
`devicePixelRatio` (dpr) is 2 — each CSS pixel is a 2×2 block of real pixels. Draw at
CSS size and the browser upscales → blurry.

```js
canvas.width  = w * dpr;        // real pixel buffer is bigger
canvas.height = h * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // then scale drawing back up
```

`setTransform(a,b,c,d,e,f)` sets the matrix `[a c e ; b d f]`. With
`(dpr,0,0,dpr,0,0)` it means "scale everything by dpr," so you write coordinates in
normal CSS pixels and still fill the high-res buffer crisply.

```
 CSS pixels you write          real pixels drawn (dpr = 2)
   ┌───┐                         ┌───┬───┐
   │ 1 │   ── setTransform ──▶   │   │   │   one CSS px = 2×2 real px
   └───┘                         ├───┼───┤
                                 │   │   │
                                 └───┴───┘
```

`Math.min(dpr, 2)` caps it so a 3× phone doesn't build a 9× buffer (huge & slow for no
visible gain).

---

## 2. The loop and delta-time (lines 101–103)

```js
const dt = Math.min(0.05, (now - last) / 1000);
last = now;
```

`requestAnimationFrame` calls `frame(now)` once per repaint; `now` is in
**milliseconds**. `(now - last)/1000` = seconds since last frame = **dt**
("delta time"). At 60 fps, dt ≈ 0.0167 s.

**Why:** *frame-rate independence.* If you wrote `f.x += 2` per frame, a 144 Hz monitor
would move the fish 2.4× faster than 60 Hz. Expressing everything *per second* and
multiplying by dt makes motion identical on any display. This is the single most
important idea in the file.

The `Math.min(0.05, …)` clamps dt to 50 ms. Alt-tab away and `now - last` could be 5 s —
without the clamp the fish teleports across the screen in one step (and might skip its
respawn check). The clamp says "never simulate more than 50 ms in one frame."

```
 timeline:   last        now
              │───────────│
              └─ now-last ─┘  ÷1000 → dt (seconds)   ── then min(0.05, dt) ──▶ clamped
```

---

## 3. Velocity → position: Euler integration (lines 129–134)

```js
const vx = f.dir * f.baseSpeed + f.bvx;   // pixels per second
const dx = vx * dt;                         // pixels THIS frame
f.x += dx;
```

The discrete form of *position = position + velocity × time*. Called **Euler
integration** — the simplest way to step a simulation forward. velocity (px/s) × dt (s)
= distance (px). Every moving thing here is just `value += rate * dt`.

---

## 4. Vectors and normalizing — the scare (lines 112–120)

A **vector** is a pair `(x, y)`: a direction plus a length.

```js
const ax = cx - mouse.x;        // vector FROM mouse TO fish
const ay = ccy - mouse.y;
const dist = Math.hypot(ax, ay); // its length = √(ax² + ay²)
```

`(ax, ay)` points from cursor to fish — the "away" direction. Its length (Pythagoras,
via `Math.hypot`) is also the distance between them, which `dist < SCARE_RADIUS` tests.

```
            fish (cx, ccy)
              ▲
              │  (ax, ay)  = away-from-cursor vector
    length =  │            ax = cx - mouse.x
     dist  =  │            ay = ccy - mouse.y
              │
         mouse ●─────────────▶ x
```

Problem: that vector's length depends on how far the fish is. We want a pure
**direction** of fixed strength, so we **normalize** — divide by the length to get a
length-1 (unit) vector, then scale to the speed we want:

```js
f.bvx = (ax / dist) * SCARE_BURST;   // 320 px/s, exactly away on x
f.bvy = (ay / dist) * SCARE_BURST;   //           exactly away on y
```

```
 raw vector (length = dist)        unit vector (length 1)        × SCARE_BURST
   (ax, ay)            ÷ dist  →   (ax/dist, ay/dist)    × 320 →  flee velocity
   length varies                   length always 1                length always 320
```

That's why the diagonal flee feels correct now instead of the old "snap to
horizontal/vertical." `|| 0.001` guards a divide-by-zero (cursor exactly on the fish →
`dist = 0` → `NaN` → fish vanishes). `f.dir = ax >= 0 ? 1 : -1` just picks the facing:
fish right of cursor → face right.

---

## 5. Exponential decay — the burst fading out (lines 125–126)

```js
f.bvx *= Math.exp(-dt / SCARE_DECAY);
f.bvy *= Math.exp(-dt / SCARE_DECAY);
```

We want the burst to ease back to zero, dt-aware. Continuous decay is
`value(t) = value₀ · e^(−t/τ)`, where τ ("tau") is the **time constant**. Stepping it by
dt means multiplying by `e^(−dt/τ)`. With `SCARE_DECAY = τ = 0.6 s`:

```
 strength
  100% ┤●
       │  ●
       │    ●●
   37% ┤━━━━━ ●●●  ← e⁻¹ at t = τ (0.6 s)
       │         ●●●●●
   14% ┤              ●●●●●●●●●  ← at 2τ (1.2 s)
     0 ┼──────────────────────────●●●●──▶ time
       0      0.6      1.2      1.8 s
```

Using `exp(-dt/τ)` (not a flat `*= 0.95`) keeps the fade identical at 30 fps or 144 fps.
This curve is the classic "ease-out" behind springs, audio fades, camera smoothing, etc.

---

## 6. Sine waves — bob and wander (lines 107, 142, 145–146)

`Math.sin` oscillates smoothly between −1 and +1 forever — perfect for gentle
back-and-forth.

```
  +1 ┤   ,-•-.           ,-•-.
     │ ,'     ',       ,'     ',
   0 ┼•─────────•─────•─────────•──▶ phase
     │            ',     ,'
  -1 ┤              '-•-'
        0    π/2   π   3π/2  2π   (one full cycle = 2π radians)
```

**Bob** (cosmetic vertical jiggle, computed fresh each frame, never stored):

```js
const cy = f.y + Math.sin(f.bob) * 6;   // ±6 px around the real y
f.bob += f.bobSpeed * dt;               // advance the phase
```

**Wander** (the slow meander — accumulates into the real `f.y`, so it steers the path):

```js
f.wander += f.wanderSpeed * dt;
f.y += Math.sin(f.wander) * 18 * dt;    // ← note the * dt: it's a velocity
```

Key difference:

```
 bob    : cy = y + sin()*6      → temporary, redrawn each frame  (look only)
 wander : y += sin()*18*dt      → permanent, changes the path    (steering)
```

Each fish starts at a **random phase** (`Math.random() * 2π`) so they don't sync up.

---

## 7. Clamping to the screen (line 147)

```js
f.y = Math.max(20, Math.min(h - f.drawH - 20, f.y));
```

A "clamp" keeps a value inside `[lo, hi]`. Read inside-out: `Math.min(hi, y)` caps the
top, then `Math.max(lo, …)` caps the bottom.

```
        f.y too small        in range         f.y too big
   ──────────┊───────────────────────────────────┊──────────
            lo = 20                       hi = h - drawH - 20
   result:   20  ◀── clamped            clamped ──▶  hi
```

---

## 8. Sprite-sheet indexing — frame → rectangle (lines 156–157)

One image, 8 frames in a **4×2 grid**, each 120×60. `f.frame` is 0–7. Find where that
frame sits:

```js
const sx = (f.frame % COLS) * FRAME_W;            // column → x
const sy = Math.floor(f.frame / COLS) * FRAME_H;  // row    → y
```

```
 the sheet  (480 × 120)            frame index → (col, row)
 ┌──────┬──────┬──────┬──────┐     col = frame % 4
 │  0   │  1   │  2   │  3   │     row = floor(frame / 4)
 │(0,0) │(120,0)(240,0)(360,0)
 ├──────┼──────┼──────┼──────┤     e.g. frame 5:
 │  4   │  5   │  6   │  7   │       col = 5 % 4      = 1 → sx = 120
 │(0,60)(120,60)...           │       row = ⌊5/4⌋ = 1 → sy = 60
 └──────┴──────┴──────┴──────┘
 each cell = 120 × 60
```

`drawImage(img, sx, sy, 120, 60, destX, destY, drawW, drawH)` copies *just that 120×60
rectangle* onto the canvas (the 9-arg form = "source rect → destination rect").

**Advancing the frame** (lines 137–141) — tied to distance, not time:

```js
f.frameDist += Math.hypot(dx, dy);      // how far it moved this frame (2D)
while (f.frameDist >= PX_PER_FRAME) {   // every 6 px travelled…
  f.frameDist -= PX_PER_FRAME;
  f.frame = (f.frame + 1) % FRAMES;     // …flip a frame, wrap 7 → 0
}
```

```
 distance bucket fills as the fish moves:
   frameDist:  [■■■■■□]  +move→ [■■■■■■■]  ≥6 ? yes → frame++, subtract 6
                                  ▲ while-loop drains it; a fast fish may
                                    advance several frames in one step
```

`while` (not `if`) lets a fast/scared fish flip multiple frames per step → it flaps
frantically. This is what ties flap speed to swim speed.

---

## 9. The horizontal flip (lines 161–168)

The sprite faces **left**. To draw a right-swimmer, mirror it:

```js
ctx.translate(f.x + f.drawW, cy);  // move origin to the fish's RIGHT edge
ctx.scale(-1, 1);                  // flip the x-axis
ctx.drawImage(img, …, 0, 0, f.drawW, f.drawH);
```

`scale(-1, 1)` negates x — mirrors horizontally — but **around the origin**. Without the
translate first, the fish draws off to the left and backwards. So move the origin to
where the right edge belongs, *then* the flipped draw lands correctly.

```
 left-facing source        scale(-1,1) only         translate THEN scale(-1,1)
   ┌────────┐               ┌────────┐                       ┌────────┐
   │  <◄◄   │   mirror →     │   ►►>  │  but drawn at   →     │   ►►>  │  correct spot
   └────────┘               └────────┘  wrong x (−)          └────────┘
```

`ctx.save()` / `ctx.restore()` (159 / 169) push & pop the transform so the flip doesn't
leak into the next fish.

---

## 10. Respawn (lines 149–153)

```js
if (f.dir === 1 && f.x > w + f.drawW)
  Object.assign(f, makeFish(), { x: -f.drawW, dir: 1 });
```

Once a right-swimmer is fully past the right edge (`x > w + drawW`), overwrite it with a
brand-new fish, then force `x` to just off the **left** edge and keep `dir: 1` — it
re-enters from the left with fresh random size/speed/wander.
`Object.assign(target, a, b)` copies `a` then `b` onto `target`, so the `{x, dir}` wins
(it's last).

```
        ◀─ screen (width w) ─▶
  -drawW │                    │ w+drawW
    ┌──┐ │                    │  ┌──┐
    │►►│─┼────────────────────┼─▶│►►│  exits right…
    └──┘ │                    │  └──┘
    ┌──┐ │                    │        …respawns far left, new random fish
    │►►│ │                    │
    └──┘ ▼
```

---

## Constants cheat-sheet (lines 16–30)

| Constant | Value | Meaning |
|---|---|---|
| `COLS` / `ROWS` | 4 / 2 | sprite-sheet grid |
| `FRAME_W` / `FRAME_H` | 120 / 60 | one frame's pixels |
| `MIN_COUNT` / `MAX_COUNT` | 2 / 6 | random fish count range |
| `SPEED_MIN` / `SPEED_MAX` | 22 / 75 | calm cruise speed (px/s) |
| `PX_PER_FRAME` | 6 | px travelled per tail-flap frame |
| `SCARE_RADIUS` | 150 | px around a fish the cursor scares it |
| `SCARE_BURST` | 320 | flee speed (px/s) away from cursor |
| `SCARE_DECAY` | 0.6 | seconds for the burst to fall to ~37% |

**The throughline:** integrate (`+= rate*dt`), oscillate (`sin(phase += speed*dt)`),
decay (`*= exp(-dt/τ)`). Three tools, one little ecosystem of fish.
