// Pure game-logic helpers for Asteroids — no rendering, no React. Kept
// separate from AsteroidsGame.js so the rules can be unit-tested/reused
// independently of the canvas drawing code. Mirrors the split used by
// typewriterEngine.js / tetrisEngine.js.

export const BOARD_W = 760;
export const BOARD_H = 500;

export const INITIAL_LIVES = 3;

// Ship physics.
export const SHIP_RADIUS = 12;
export const ROTATION_SPEED = 3.6; // rad/sec
export const THRUST_ACCEL = 260; // px/sec^2
export const MAX_SPEED = 320; // px/sec
export const DRAG = 0.55; // fraction of velocity shed per second — a light
// arcade-friendly drag so the ship coasts but doesn't drift forever, unlike
// true frictionless Asteroids physics.
export const RESPAWN_INVULN_MS = 2000;

// Bullets.
export const BULLET_SPEED = 480; // px/sec
export const BULLET_LIFETIME_MS = 900;
export const FIRE_COOLDOWN_MS = 250;

// Asteroids: three size tiers. Splitting goes large -> 2 medium -> 2 small
// -> gone, classic-Asteroids style.
export const ASTEROID_SIZES = {
  large: { radius: 34, speedMin: 20, speedMax: 55, score: 20 },
  medium: { radius: 20, speedMin: 40, speedMax: 90, score: 50 },
  small: { radius: 11, speedMin: 70, speedMax: 130, score: 100 },
};

const SPLIT_INTO = { large: "medium", medium: "small", small: null };

// How many large asteroids spawn at the start of each wave.
export function asteroidCountForWave(wave) {
  return Math.min(11, 3 + wave);
}

export function wrap(pos, w, h) {
  if (pos.x < 0) pos.x += w;
  else if (pos.x >= w) pos.x -= w;
  if (pos.y < 0) pos.y += h;
  else if (pos.y >= h) pos.y -= h;
}

export function randomAsteroidVelocity(size) {
  const { speedMin, speedMax } = ASTEROID_SIZES[size];
  const speed = speedMin + Math.random() * (speedMax - speedMin);
  const angle = Math.random() * Math.PI * 2;
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

// Spawns just outside a random edge, heading generally inward, so it doesn't
// materialize on top of the player.
export function spawnEdgePosition(w, h) {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: -20, y: Math.random() * h };
  if (edge === 1) return { x: w + 20, y: Math.random() * h };
  if (edge === 2) return { x: Math.random() * w, y: -20 };
  return { x: Math.random() * w, y: h + 20 };
}

export function makeAsteroid(id, size, pos, velocity) {
  return {
    id,
    size,
    x: pos.x,
    y: pos.y,
    vx: velocity.vx,
    vy: velocity.vy,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 2,
    variant: Math.random() < 0.5 ? "detailed" : "square",
  };
}

// Splits an asteroid into its next-size-down children (2 of them, kicked
// apart in roughly opposite directions), or returns [] if it was already
// the smallest tier.
export function splitAsteroid(asteroid, nextId) {
  const nextSize = SPLIT_INTO[asteroid.size];
  if (!nextSize) return [];
  const base = Math.atan2(asteroid.vy, asteroid.vx);
  return [0, 1].map((i) => {
    const angle = base + (i === 0 ? 1 : -1) * (0.6 + Math.random() * 0.6);
    const { speedMin, speedMax } = ASTEROID_SIZES[nextSize];
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    return makeAsteroid(
      nextId + i,
      nextSize,
      { x: asteroid.x, y: asteroid.y },
      { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed }
    );
  });
}

export function circlesCollide(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

// --- Chase mode ---
// Ship stays within a lane on the left side of the screen — free to move on
// both axes, but never as far right as the oncoming rocks spawn — while the
// world scrolls past it left-ward instead of wrapping. One life, endless,
// gets harder with distance. Reuses the same ship/bullet/asteroid
// primitives above — only spawn/scroll/scoring differ from centered mode.

export const CHASE_SHIP_X = Math.round(BOARD_W * 0.22); // spawn position
export const CHASE_SHIP_X_MIN = Math.round(BOARD_W * 0.08);
export const CHASE_SHIP_X_MAX = Math.round(BOARD_W * 0.4);
export const CHASE_INITIAL_LIVES = 1;

export const CHASE_ACCEL = 900; // px/sec^2, both axes
export const CHASE_MAX_SPEED = 380; // px/sec, both axes
export const CHASE_DRAG = 4.5; // heavier than centered mode's DRAG — with
// only one life, snappy stops matter more than coasting.

export const CHASE_BASE_SCROLL_SPEED = 140; // px/sec
export const CHASE_SPAWN_INTERVAL_BASE_MS = 900;
export const CHASE_SPAWN_INTERVAL_MIN_MS = 280;

// Points per pixel of distance flown, on top of the usual per-asteroid
// score — small enough that kills still dominate at high skill, but keeps
// the score climbing even during a quiet stretch.
export const CHASE_DISTANCE_SCORE_PER_PX = 0.1;

// Uncapped on purpose — the ramp is the real endgame. There's no top speed
// to "beat"; you just fly until the density of oncoming rocks outpaces
// whatever's still dodgeable.
//
// Driven by elapsed time, not distance: distance = integral of scroll
// speed, so a distance-based ramp feeds back into itself (faster ->
// more distance per second -> faster still), which compounds into
// exponential growth — doubling every ~14s, thousands of px/sec within two
// minutes. Elapsed seconds grows at a flat 1/sec no matter how fast you're
// going, so this ramp is a plain, predictable straight line instead.
export const CHASE_SCROLL_ACCEL = 4; // px/sec, added per second elapsed

export function chaseScrollSpeedForElapsed(elapsedSeconds) {
  return CHASE_BASE_SCROLL_SPEED + elapsedSeconds * CHASE_SCROLL_ACCEL;
}

export function chaseSpawnIntervalForElapsed(elapsedSeconds) {
  return Math.max(
    CHASE_SPAWN_INTERVAL_MIN_MS,
    CHASE_SPAWN_INTERVAL_BASE_MS - elapsedSeconds * 12
  );
}

// Guns keep pace with how fast you're flying: both scale with the same
// speedFactor (current scroll speed relative to the base), so bullets stay
// meaningfully faster than the oncoming rocks and fire rate climbs right
// alongside the difficulty ramp. Cooldown still has a floor — even at
// absurd late-game speeds, fire rate stays a rate rather than a beam.
export const CHASE_MIN_FIRE_COOLDOWN_MS = 90;

export function chaseBulletSpeedForElapsed(elapsedSeconds) {
  const speedFactor = chaseScrollSpeedForElapsed(elapsedSeconds) / CHASE_BASE_SCROLL_SPEED;
  return BULLET_SPEED * speedFactor;
}

export function chaseFireCooldownForElapsed(elapsedSeconds) {
  const speedFactor = chaseScrollSpeedForElapsed(elapsedSeconds) / CHASE_BASE_SCROLL_SPEED;
  return Math.max(CHASE_MIN_FIRE_COOLDOWN_MS, FIRE_COOLDOWN_MS / speedFactor);
}

// Spawns just past the right edge at a random height, drifting with the
// scroll (plus a little vertical wobble) so it reads as an obstacle in the
// ship's path rather than a random flung rock.
export function chaseSpawnAsteroid(id, elapsedSeconds) {
  const sizes = ["large", "medium", "small"];
  const size = sizes[Math.floor(Math.random() * sizes.length)];
  const scrollSpeed = chaseScrollSpeedForElapsed(elapsedSeconds);
  const pos = { x: BOARD_W + 40, y: Math.random() * BOARD_H };
  const velocity = {
    vx: -scrollSpeed * (0.85 + Math.random() * 0.3),
    vy: (Math.random() - 0.5) * 40,
  };
  return makeAsteroid(id, size, pos, velocity);
}

// --- Powerups (centered mode only for now) ---
// Timed buffs replace whatever's currently active rather than stacking —
// picking up a second one just resets the clock on the new effect. Extra
// life and bomb are instant, one-shot effects instead of timed buffs, so
// they don't touch the "currently active" slot at all.

export const POWERUP_TYPES = {
  shield: { duration: 6000, instant: false },
  rapid_fire: { duration: 8000, instant: false },
  spread_shot: { duration: 8000, instant: false },
  score_multiplier: { duration: 10000, instant: false },
  speed_boost: { duration: 8000, instant: false },
  extra_life: { duration: 0, instant: true },
  bomb: { duration: 0, instant: true },
};

export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_RADIUS = 14;
export const POWERUP_LIFETIME_MS = 9000;
const POWERUP_DRIFT_SPEED_MIN = 15;
const POWERUP_DRIFT_SPEED_MAX = 40;

export const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4;
export const SPREAD_SHOT_ANGLE = 0.22; // radians between center and outer bullets
export const SCORE_MULTIPLIER_FACTOR = 2;
export const SPEED_BOOST_MULTIPLIER = 1.6;

export function rollPowerupType() {
  const types = Object.keys(POWERUP_TYPES);
  return types[Math.floor(Math.random() * types.length)];
}

// Drifts slowly in a random direction so it reads as a pickup drifting in
// the wreckage, not another asteroid.
export function makePowerup(id, type, x, y, now) {
  const angle = Math.random() * Math.PI * 2;
  const speed = POWERUP_DRIFT_SPEED_MIN + Math.random() * (POWERUP_DRIFT_SPEED_MAX - POWERUP_DRIFT_SPEED_MIN);
  return {
    id,
    type,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    bornAt: now,
  };
}
