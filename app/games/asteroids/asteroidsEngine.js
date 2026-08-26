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
export const THRUST_ACCEL = 437; // px/sec^2
export const MAX_SPEED = 538; // px/sec
export const DRAG = 0.55; // fraction of velocity shed per second — a light
// arcade-friendly drag so the ship coasts but doesn't drift forever, unlike
// true frictionless Asteroids physics.
export const BRAKE_DRAG = 3.2; // held brake sheds velocity much faster than
// passive drag, on both axes regardless of facing — not an instant stop,
// but a firm, deliberate one.
export const RESPAWN_INVULN_MS = 2000;

// Bullets.
export const BULLET_SPEED = 480; // px/sec
export const BULLET_LIFETIME_MS = 900;
export const FIRE_COOLDOWN_MS = 250;

// Weapon heat: the fire cooldown alone doesn't stop someone from just
// holding the trigger down forever at the max sustainable rate, so heat
// builds continuously while the fire key is held — not in discrete jumps
// per shot, so the gauge reads as a smooth rise rather than a staircase —
// and drains passively whenever it isn't. Hitting max locks firing out for
// a beat, draining back to empty over exactly that lockout so the gauge
// reads as "wait, then go" rather than a static block. Spread shot costs
// the same heat as a single shot (it's meant to be a strict upgrade, not a
// tradeoff), since heat no longer cares how many bullets a shot fired. The
// unlimited_fire powerup exempts the ship from heat entirely.
export const HEAT_MAX = 100;
export const HEAT_GAIN_PER_SECOND = 20;
export const HEAT_COOL_RATE = 30; // per second, while under max
export const OVERHEAT_LOCKOUT_MS = 1200;

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

// Centered mode only: a real beat between one wave clearing and the next
// spawning, instead of instant respawn — matters most right after a bomb,
// which can clear the board in a single frame and previously would spawn a
// fresh wave that same frame with zero warning.
export const WAVE_CLEAR_DELAY_MS = 1000;

// New-wave spawn points reroll if they'd land this close to the ship (see
// wrappedDistance — centered mode wraps, so "close" isn't just straight-
// line distance). Radius covers a large asteroid plus room to react, not
// just avoid instant overlap.
export const WAVE_SPAWN_SAFE_RADIUS = 140;

export function wrap(pos, w, h) {
  if (pos.x < 0) pos.x += w;
  else if (pos.x >= w) pos.x -= w;
  if (pos.y < 0) pos.y += h;
  else if (pos.y >= h) pos.y -= h;
}

// Shortest distance between two points on a board that wraps at w/h — e.g.
// a point at x=5 and one at x=w-5 are only 10px apart going "around the
// edge," not w-10px apart in a straight line. Needed anywhere that measures
// closeness in centered mode, since the arena being a torus means the
// straight-line distance is often the wrong answer.
export function wrappedDistance(ax, ay, bx, by, w, h) {
  // Normalize first — callers may pass points slightly outside [0,w)/[0,h)
  // (e.g. spawnEdgePosition's just-off-the-edge spawns), which the plain
  // abs-diff check below would otherwise get backwards right at the edge.
  const nax = ((ax % w) + w) % w;
  const nbx = ((bx % w) + w) % w;
  const nay = ((ay % h) + h) % h;
  const nby = ((by % h) + h) % h;
  let dx = Math.abs(nax - nbx);
  if (dx > w / 2) dx = w - dx;
  let dy = Math.abs(nay - nby);
  if (dy > h / 2) dy = h - dy;
  return Math.hypot(dx, dy);
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

// rootId ties every asteroid spawned from the same original large one
// together (defaults to its own id for a fresh top-level spawn) — see
// splitAsteroid and the drop-roll in AsteroidsGame.js, which uses it so a
// split family only ever drops one powerup total, not one per fragment.
export function makeAsteroid(id, size, pos, velocity, rootId = id) {
  return {
    id,
    rootId,
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
      { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed },
      asteroid.rootId
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
export const CHASE_MAX_SPEED = 538; // px/sec, both axes
export const CHASE_DRAG = 4.5; // heavier than centered mode's DRAG — with
// only one life, snappy stops matter more than coasting.

// Reward for surviving a boss fight, not just a shop purchase — stacks
// every kill, uncapped, same "let it keep climbing" philosophy as the rest
// of chase's late-game scaling.
export const CHASE_BOSS_KILL_SPEED_BONUS = 0.05; // +5% accel/max-speed per kill

export function chaseShipSpeedMultiplierForBossesDefeated(bossesDefeated) {
  return 1 + bossesDefeated * CHASE_BOSS_KILL_SPEED_BONUS;
}

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
//
// The acceleration itself now decays toward a floor rather than staying
// flat: a straight line at 8px/sec^2 forever meant a run that survived
// several bosses was outrunning what's dodgeable long before it ran out of
// lives. Speed still climbs without limit — it's the *rate* of climb that
// eases off, so there's no cap to hit and no discontinuity to feel.
export const CHASE_SCROLL_ACCEL = 8; // px/sec^2 at t=0
export const CHASE_SCROLL_ACCEL_FLOOR = 2; // px/sec^2 the accel decays toward
export const CHASE_SCROLL_ACCEL_DECAY_TAU = 60; // seconds

// Closed-form integral of accel(t) = FLOOR + decay * exp(-t/TAU) — no need
// to accumulate speed frame by frame, so it stays a pure function of
// elapsed time like the rest of the ramp helpers.
export function chaseScrollSpeedForElapsed(elapsedSeconds) {
  const decay = CHASE_SCROLL_ACCEL - CHASE_SCROLL_ACCEL_FLOOR;
  return (
    CHASE_BASE_SCROLL_SPEED +
    CHASE_SCROLL_ACCEL_FLOOR * elapsedSeconds +
    decay *
      CHASE_SCROLL_ACCEL_DECAY_TAU *
      (1 - Math.exp(-elapsedSeconds / CHASE_SCROLL_ACCEL_DECAY_TAU))
  );
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

// While a boss is up, the world scroll speed (and how often asteroids
// spawn) eases down — a boss fight is already the main threat, so the
// background asteroid stream doesn't need to be at full difficulty on top
// of it. Deliberately NOT applied to chaseFireCooldownForElapsed/
// chaseBulletSpeedForElapsed above — those read elapsed time directly, not
// this damping, so the player's own gun keeps progressing normally through
// a fight instead of also getting slower.
export const CHASE_BOSS_SCROLL_DAMP = 0.7; // 30% reduction while a boss is present
export const CHASE_BOSS_SCROLL_EASE_TAU = 1.2; // seconds — ease in/out, not a snap

// Spawn interval divides by the same damp factor (rather than being left
// alone) so a slower scroll doesn't just mean asteroids linger on screen
// longer at an unchanged spawn rate — that would net out to MORE clutter,
// the opposite of the point.
export function chaseSpawnIntervalForDamp(elapsedSeconds, damp) {
  return chaseSpawnIntervalForElapsed(elapsedSeconds) / damp;
}

export function chaseFireCooldownForElapsed(elapsedSeconds) {
  const speedFactor = chaseScrollSpeedForElapsed(elapsedSeconds) / CHASE_BASE_SCROLL_SPEED;
  return Math.max(CHASE_MIN_FIRE_COOLDOWN_MS, FIRE_COOLDOWN_MS / speedFactor);
}

// Spawns just past the right edge at a random height, drifting with the
// scroll (plus a little vertical wobble) so it reads as an obstacle in the
// ship's path rather than a random flung rock.
// Takes the actual current scroll speed rather than deriving it from
// elapsed time itself, so a spawn during a damped boss fight (see
// CHASE_BOSS_SCROLL_DAMP) comes in at the same reduced speed the world is
// actually scrolling at, instead of the full undamped rate.
export function chaseSpawnAsteroid(id, scrollSpeed) {
  const sizes = ["large", "medium", "small"];
  const size = sizes[Math.floor(Math.random() * sizes.length)];
  const pos = { x: BOARD_W + 40, y: Math.random() * BOARD_H };
  const velocity = {
    vx: -scrollSpeed * (0.85 + Math.random() * 0.3),
    vy: (Math.random() - 0.5) * 40,
  };
  return makeAsteroid(id, size, pos, velocity);
}

// --- Chase boss ---
// First boss shows up BOSS_INTERVAL_SECONDS into a run; beating one arms
// the next spawn BOSS_INTERVAL_SECONDS after that kill, not on the
// original fixed cadence — a long fight just pushes the next one back.
//
// Each boss is tougher than the last: `tier` is how many bosses this run
// has already beaten (0 for the first one), and HP/fire rate/bullet speed/
// laser cadence all scale off it — see the boss*ForTier functions below.

export const BOSS_INTERVAL_SECONDS = 20;
export const BOSS_RADIUS = 60;
export const BOSS_HEALTH = 40; // tier 0 baseline — see bossHealthForTier
export const BOSS_SCORE = 1000; // tier 0 baseline — see bossScoreForTier

export function bossScoreForTier(tier) {
  return BOSS_SCORE + tier * 500;
}
export const BOSS_ENTRY_SPEED = 90; // px/sec while flying in from the right
export const BOSS_HOVER_X_FRACTION = 0.72; // settles here once it arrives
export const BOSS_BOB_AMPLITUDE = 70; // px, vertical weave once settled
export const BOSS_BOB_SPEED = 0.6; // rad/sec-ish
export const BOSS_BULLET_SPEED = 220; // tier 0 baseline
export const BOSS_BULLET_RADIUS = 4;

// Bullets come out in bursts, not a continuous stream: a flat interval that
// floored at 150ms by the mid tiers read as nonstop spam with no rhythm to
// learn. A burst is telegraphed (windup), fires a tight volley, then leaves
// a real gap to move in. Difficulty scales by *burst size*, not by shrinking
// the gap — the pause only tapers mildly, so there's always a window.
export const BOSS_BURST_SIZE_BASE = 2;
export const BOSS_BURST_SIZE_PER_TIER = 0.5;
export const BOSS_BURST_SIZE_MAX = 6;
export const BOSS_BURST_SHOT_INTERVAL_MS = 100; // spacing within one burst
export const BOSS_BURST_PAUSE_MS = 900; // between bursts, tier 0
export const BOSS_BURST_PAUSE_MIN_MS = 600;
export const BOSS_BURST_WINDUP_MS = 700;

// Spiral: bullets radiate from the boss center on a few rotating arms. Arms
// rather than a solid disc on purpose — the wide empty bands between them
// are the dodge lane, so it's a bullet-hell pattern that's always readable.
export const BOSS_SPIRAL_ARM_COUNT = 3;
export const BOSS_SPIRAL_BULLET_SPEED = 170;
export const BOSS_SPIRAL_DURATION_MS = 2600;
export const BOSS_SPIRAL_ROTATION_SPEED = 1.6; // rad/sec
export const BOSS_SPIRAL_SHOT_INTERVAL_MS = 90;
export const BOSS_SPIRAL_WINDUP_MS = 700;

// Tier 6+ bosses periodically go untouchable and run a scripted pattern or
// two before becoming a target again — a breather from DPS-racing that has
// to be survived rather than shot through.
export const BOSS_PHASE_MIN_TIER = 6;
export const BOSS_PHASE_INTERVAL_MS = 16000;

// Can't be damaged until it's fully flown in and held position for a beat —
// otherwise a lucky shot during the entry animation kills it before it's
// even had a chance to fight back. Bullets are gated on this same deadline
// (see the fire check in AsteroidsGame.js), so immunity ending and it
// opening fire happen in the same frame — no window where it's shooting
// but still can't be shot back.
export const BOSS_INTRO_GRACE_MS = 900;

// Laser: a second attack alongside the regular bullet spam. Each beam locks
// onto the ship's y position the moment it starts charging (not tracked
// live), so a player who moves off that line during the charge dodges it
// clean — it's a read-and-react check, not an inescapable hit. Tougher
// bosses fire a volley of several beams per activation instead of one —
// the first still gives a fair warning, but the follow-up beams in the
// same volley re-lock and charge much faster, so a volley is a real
// forces-you-to-keep-moving threat rather than one dodge and done.
export const BOSS_LASER_INTERVAL_MS = 3500; // tier 0 baseline, between volleys
export const BOSS_LASER_INTERVAL_MIN_MS = 1800;
export const BOSS_LASER_CHARGE_MS = 1400; // first beam in a volley
export const BOSS_LASER_RECHARGE_MS = 500; // subsequent beams in the same volley
export const BOSS_LASER_ACTIVE_MS = 350;
export const BOSS_LASER_HALF_WIDTH = 9;
export const BOSS_LASER_MAX_BEAMS = 4;

// Simultaneous mode picks beam positions from this many evenly spaced slots
// and drops one at random — the dropped slot is a guaranteed full-height
// lane, in a different place every time, so the pattern is survivable
// without being memorizable.
export const BOSS_LASER_PATTERN_SLOTS = BOSS_LASER_MAX_BEAMS + 1;

// Growth steepens from tier 10 on — DPS growth is capped (fire-rate ramp
// tops out, damage upgrades get pricier) while a flat +40/tier forever was
// letting late fights get comparatively easier instead of harder.
export const BOSS_HEALTH_STEEP_TIER = 10;
export const BOSS_HEALTH_PER_TIER = 40;
export const BOSS_HEALTH_PER_TIER_STEEP = 50;

export function bossHealthForTier(tier) {
  if (tier < BOSS_HEALTH_STEEP_TIER) return BOSS_HEALTH + tier * BOSS_HEALTH_PER_TIER;
  const atThreshold = BOSS_HEALTH + BOSS_HEALTH_STEEP_TIER * BOSS_HEALTH_PER_TIER;
  return atThreshold + (tier - BOSS_HEALTH_STEEP_TIER) * BOSS_HEALTH_PER_TIER_STEEP;
}

export function bossBurstSizeForTier(tier) {
  return Math.min(
    BOSS_BURST_SIZE_MAX,
    Math.floor(BOSS_BURST_SIZE_BASE + tier * BOSS_BURST_SIZE_PER_TIER)
  );
}

export function bossBurstPauseForTier(tier) {
  return Math.max(BOSS_BURST_PAUSE_MIN_MS, BOSS_BURST_PAUSE_MS - tier * 35);
}

// Spiral is a surprise the first time it shows up (a coin flip's worth at
// tier 2), then just another card in the deck alongside bursts.
export function bossSpiralChanceForTier(tier) {
  if (tier < 2) return 0;
  if (tier === 2) return 0.3;
  return 0.5;
}

export function bossBulletSpeedForTier(tier) {
  return BOSS_BULLET_SPEED + tier * 20;
}

export function bossLaserIntervalForTier(tier) {
  return Math.max(BOSS_LASER_INTERVAL_MIN_MS, BOSS_LASER_INTERVAL_MS - tier * 300);
}

// Beams per volley: one more every second tier, so it climbs steadily
// instead of plateauing.
export function bossLaserBeamsForTier(tier) {
  return Math.min(BOSS_LASER_MAX_BEAMS, 1 + Math.floor(tier / 2));
}

// The y positions for a simultaneous volley — see BOSS_LASER_PATTERN_SLOTS.
export function bossLaserPatternYs() {
  const skip = Math.floor(Math.random() * BOSS_LASER_PATTERN_SLOTS);
  const ys = [];
  for (let i = 0; i < BOSS_LASER_PATTERN_SLOTS; i++) {
    if (i === skip) continue;
    ys.push(((i + 0.5) / BOSS_LASER_PATTERN_SLOTS) * BOARD_H);
  }
  return ys;
}

export function makeBoss(now, tier) {
  return {
    x: BOARD_W + 80,
    y: BOARD_H / 2,
    baseY: BOARD_H / 2,
    tier,
    health: bossHealthForTier(tier),
    maxHealth: bossHealthForTier(tier),
    bulletSpeed: bossBulletSpeedForTier(tier),
    laserInterval: bossLaserIntervalForTier(tier),
    laserBeamsTotal: bossLaserBeamsForTier(tier),
    laserVolleyBeams: 0, // beams in the volley currently running
    laserBeamsRemaining: 0,
    spawnedAt: now,
    entered: false,
    vulnerableAt: Infinity,
    rotation: -Math.PI / 2,
    laserState: "idle", // idle | charging | firing
    laserPatternMode: "lockon", // lockon (laserY) | simultaneous (laserYs)
    laserY: BOARD_H / 2,
    laserYs: [],
    laserPhaseAt: 0,
    nextLaserAt: Infinity,
    // Burst/spiral share one "what's the gun doing" slot — only one of them
    // runs at a time, with the laser on its own parallel timer as before.
    burstState: "pause", // windup | firing | pause
    burstShotsFired: 0,
    burstPhaseAt: now,
    burstSizeThisVolley: bossBurstSizeForTier(tier),
    burstAimed: true,
    spiralState: "idle", // idle | windup | firing
    spiralAngle: 0,
    spiralPhaseAt: 0,
    spiralShotAccum: 0,
    // Invulnerability phases (tier 6+ only) — see BOSS_PHASE_MIN_TIER.
    phaseActive: false,
    phaseQueue: [],
    nextPhaseAt: Infinity,
  };
}

// 1-2 patterns, rolled fresh for each invulnerability phase so a phase is
// never the same twice in a row for long.
export function rollBossPhaseAttacks() {
  const pool = ["burst", "laser", "spiral"];
  const count = 1 + Math.floor(Math.random() * 2);
  return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
}

// --- Shop (chase mode, opens right after each boss kill) ---
// Cores are a separate currency from score, earned only from boss kills —
// spending them doesn't cost you anything on the leaderboard. Each item can
// be bought repeatedly in a run; every repeat purchase of the *same* item
// costs more (SHOP_COST_GROWTH), so cores naturally spread across items
// rather than all piling into one stat.

export function coresForBossTier(tier) {
  return 5 + tier;
}

export const SHOP_ITEMS = {
  heat_capacity: { label: "Heat Capacity", desc: "+15 max heat", baseCost: 2 },
  coolant_boost: { label: "Coolant Boost", desc: "+25% cool rate", baseCost: 2 },
  extra_life: { label: "Extra Life", desc: "+1 life", baseCost: 5 },
  lucky_scavenger: { label: "Lucky Scavenger", desc: "+2% powerup drops", baseCost: 2 },
  shorter_overheat: { label: "Shorter Overheat", desc: "-15% lockout time", baseCost: 3 },
  pierce: { label: "Piercing Rounds", desc: "Bullets pierce through targets", baseCost: 4 },
  damage: { label: "Sharpened Rounds", desc: "+0.25 damage per hit", baseCost: 3 },
  // No free starting charge — the deflector is fully store-gated now, so
  // the first purchase is what gives you your first charge at all. Costs
  // are a hand-set list (DEFLECTOR_COSTS) rather than the usual growth
  // formula, since the jump from 3 to 6 is steeper than 1.35x.
  deflector: { label: "Deflector Charge", desc: "+1 shield charge (max 4 total)", baseCost: 3 },
  dual_fire: {
    label: "Twin Cannons",
    desc: "Fire two guns, +50% heat instead of +100%",
    baseCost: 8,
  },
};

// Everything not listed here is uncapped — repeat-purchase cost growth is
// the throttle. These are the ones where more copies would mean nothing
// (a flag you either have or don't) or would trivialize getting hit.
export const SHOP_ITEM_MAX_PURCHASES = {
  pierce: 1,
  dual_fire: 1,
  deflector: 3,
  extra_life: 5,
};

export const SHOP_COST_GROWTH = 1.35;

// Deflector's 3 purchases have their own hand-tuned prices instead of the
// usual growth formula.
export const DEFLECTOR_COSTS = [5, 6, 8];

export function shopItemCost(itemKey, timesBought) {
  if (itemKey === "deflector") return DEFLECTOR_COSTS[timesBought];
  return Math.round(SHOP_ITEMS[itemKey].baseCost * Math.pow(SHOP_COST_GROWTH, timesBought));
}

// Some items don't enter the offer pool until a run has gotten far enough —
// twin cannons and piercing rounds are strong enough that seeing them turn
// 1 in an early roll would swing the whole shop economy for that visit.
// Everything not listed here is eligible from the first shop on.
export const SHOP_ITEM_MIN_BOSSES_DEFEATED = {
  deflector: 2,
  dual_fire: 3,
  pierce: 5,
};

// Twin Cannons ramps into full offer odds instead of jumping straight to
// them the moment it unlocks — softens the single-barrel stretch right
// after boss 3 without pushing the unlock gate itself back further.
export const DUAL_FIRE_OFFER_WEIGHT_BY_BOSSES = { 3: 0.5, 4: 1, 5: 1.5 };
const DUAL_FIRE_OFFER_WEIGHT_LATER = 1.5; // holds at the tier-5 weight from boss 6 on

function shopItemOfferWeight(key, bossesDefeated) {
  if (key === "dual_fire") {
    return DUAL_FIRE_OFFER_WEIGHT_BY_BOSSES[bossesDefeated] ?? DUAL_FIRE_OFFER_WEIGHT_LATER;
  }
  return 1;
}

// Gacha shop: instead of every item being buyable every visit, the trader
// offers a random SHOP_OFFER_SIZE-item subset, with a couple of paid
// rerolls if the draw is bad. Cores spent on a reroll are gone whether or
// not the new draw is any better — same as everything else in the shop,
// cores are a sunk cost the moment they're spent.
export const SHOP_OFFER_SIZE = 4;
export const SHOP_REROLLS = 2;
export const SHOP_REROLL_COST = 1;

// Eligible = not already maxed out, and past its unlock gate if it has
// one. Falls back to fewer than SHOP_OFFER_SIZE items early on rather than
// padding the offer with something you can't buy.
export function rollShopOffer(shopPurchaseCounts, bossesDefeated) {
  const pool = Object.keys(SHOP_ITEMS).filter((key) => {
    const max = SHOP_ITEM_MAX_PURCHASES[key];
    const bought = shopPurchaseCounts[key] || 0;
    if (max !== undefined && bought >= max) return false;
    const minBosses = SHOP_ITEM_MIN_BOSSES_DEFEATED[key];
    if (minBosses !== undefined && bossesDefeated < minBosses) return false;
    return true;
  });
  const weights = pool.map((key) => shopItemOfferWeight(key, bossesDefeated));
  const offer = [];
  while (offer.length < SHOP_OFFER_SIZE && pool.length > 0) {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= weights[i];
      if (r <= 0) break;
    }
    offer.push(pool.splice(i, 1)[0]);
    weights.splice(i, 1);
  }
  return offer;
}

// Merchant ship + shield shown while the shop is open. Asteroids that reach
// the shield are destroyed there instead of reaching the player — the
// player is untouchable for the whole interlude regardless, this is just
// the in-world reason why.
export const MERCHANT_OFFSET_X = 100; // px right of the ship, resting position
export const MERCHANT_SHIELD_OFFSET_X = 55; // further right of the merchant
export const MERCHANT_SHIELD_RADIUS = 50;

// Entrance: flies in from a true random point on the board's border
// (weighted by edge length, not one of a fixed set of directions — see
// randomBoardPerimeterPoint) and eases into its resting spot, facing its
// exit heading the whole time so it reads as drifting in sideways rather
// than turning to face its approach. Exit: always straight ahead of the
// ship's current lane regardless of which edge it came in from, sweeping
// the field clean as it goes — a flythrough, not a retreat.
export const MERCHANT_ENTER_MS = 550;
export const MERCHANT_LEAVE_SPEED = 300; // px/sec
export const MERCHANT_CLEAR_RADIUS = 50; // matches the shield's reach

// Weighted by edge length so every point on the perimeter is equally
// likely, not one of 4 fixed directions. 20px past the edge, same margin
// spawnEdgePosition uses, so it reads as arriving from off-screen.
export function randomBoardPerimeterPoint() {
  const perimeter = 2 * (BOARD_W + BOARD_H);
  let d = Math.random() * perimeter;
  if (d < BOARD_W) return { x: d, y: -20 };
  d -= BOARD_W;
  if (d < BOARD_H) return { x: BOARD_W + 20, y: d };
  d -= BOARD_H;
  if (d < BOARD_W) return { x: BOARD_W - d, y: BOARD_H + 20 };
  d -= BOARD_W;
  return { x: -20, y: BOARD_H - d };
}

// --- Powerups ---
// Different timed buffs stack freely (shield + rapid fire + speed boost can
// all be running at once); picking up a second of the *same* type just
// refreshes its clock rather than adding a second copy. Getting hit clears
// every active buff, not just the one that would've saved you — a life
// lost wipes the slate. Extra life and bomb are instant, one-shot effects
// instead of timed buffs, so they never touch the active-buffs set at all.

// unlockWave/unlockSeconds gate a type out of the drop pool until the run
// has gotten that far — centered mode checks wave, chase mode checks
// elapsed seconds. Basics are available from the start; the more
// game-changing ones (bomb especially) only start appearing once a run has
// proven it's going somewhere.
export const POWERUP_TYPES = {
  // instant: grants a bonus deflector charge on pickup rather than a timed
  // buff — see DEFLECTOR_RECHARGE_MS. Duration is deliberately 0 so it
  // never lands in the active-buffs set.
  shield: { duration: 0, instant: true, unlockWave: 1, unlockSeconds: 0 },
  rapid_fire: { duration: 8000, instant: false, unlockWave: 1, unlockSeconds: 0 },
  extra_life: { duration: 0, instant: true, unlockWave: 1, unlockSeconds: 0 },
  speed_boost: { duration: 8000, instant: false, unlockWave: 2, unlockSeconds: 20 },
  spread_shot: { duration: 8000, instant: false, unlockWave: 3, unlockSeconds: 40 },
  // chaseOnly: classic mode has no weapon heat, so this would be a no-op
  // pickup there — excluded from its drop pool entirely.
  unlimited_fire: { duration: 8000, instant: false, unlockWave: 3, unlockSeconds: 40, chaseOnly: true },
  score_multiplier: { duration: 10000, instant: false, unlockWave: 4, unlockSeconds: 60 },
  bomb: { duration: 0, instant: true, unlockWave: 5, unlockSeconds: 80 },
};

export const POWERUP_DROP_CHANCE = 0.15;
// Picking up any powerup suppresses the drop odds for a while afterward —
// otherwise a lucky early chain (e.g. rapid fire + spread shot back to
// back) trivializes the run instead of being an occasional boost.
export const POWERUP_SUPPRESSED_DROP_CHANCE = 0.04;
export const POWERUP_SUPPRESS_MS = 6000;
export const POWERUP_RADIUS = 17; // +20% over the original 14
export const POWERUP_LIFETIME_MS = 9000;
const POWERUP_DRIFT_SPEED_MIN = 15;
const POWERUP_DRIFT_SPEED_MAX = 40;

// Chase-only cap — 1-life start makes uncapped stacking a much bigger deal
// than in centered, which has no shop/boss-kill life sources to compound
// with and so isn't capped at all (see applyPowerupPickup).
export const MAX_LIVES = 3;

// Deflector: every ship has at least one charge, and a charge eats exactly
// one hit. Base charges come back on their own after a cooldown (bought
// ones included); the shield powerup instead grants a single non-
// regenerating bonus charge, a spare heart rather than a window of
// invincibility — the old timed full-invuln shield made whole boss phases
// free, which is why this replaced it.
export const DEFLECTOR_RECHARGE_MS = 8000;
export const DEFLECTOR_FLASH_MS = 250;
// One contact would otherwise burn every charge in consecutive frames,
// since a blocked hit leaves the ship exactly where it was, still touching
// whatever hit it.
export const DEFLECTOR_HIT_GRACE_MS = 400;

// Two guns cost less heat than two shots would — the upgrade is meant to be
// worth buying, so the second barrel is a discount, not a doubling.
export const DUAL_FIRE_HEAT_MULTIPLIER = 1.5;
export const DUAL_FIRE_OFFSET = 14; // px to each side of the ship's centerline — wing-mounted

export const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4;
export const SPREAD_SHOT_ANGLE = 0.22; // radians between center and outer bullets
export const SCORE_MULTIPLIER_FACTOR = 2;
export const SPEED_BOOST_MULTIPLIER = 1.6;

// progress is the current wave (centered) or elapsed seconds (chase) —
// whichever matches mode. Falls back to the full pool if nothing's
// unlocked yet, so a drop always has something to give.
export function rollPowerupType(mode, progress) {
  const key = mode === "chase" ? "unlockSeconds" : "unlockWave";
  const eligible = Object.entries(POWERUP_TYPES).filter(
    ([, cfg]) => !cfg.chaseOnly || mode === "chase"
  );
  const unlocked = eligible.filter(([, cfg]) => progress >= cfg[key]).map(([type]) => type);
  const pool = unlocked.length > 0 ? unlocked : eligible.map(([type]) => type);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Drifts slowly in a random direction so it reads as a pickup hovering in
// the wreckage, not another asteroid — same in both modes now. It used to
// inherit the chase-mode scroll speed, which at higher difficulty blew it
// past the ship before there was any real chance to grab it; now it just
// hovers near where it dropped and expires on its own timer
// (POWERUP_LIFETIME_MS) instead of racing off-screen.
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
