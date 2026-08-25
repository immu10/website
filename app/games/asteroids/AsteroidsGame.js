"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BOARD_W,
  BOARD_H,
  INITIAL_LIVES,
  SHIP_RADIUS,
  ROTATION_SPEED,
  THRUST_ACCEL,
  MAX_SPEED,
  DRAG,
  BRAKE_DRAG,
  RESPAWN_INVULN_MS,
  BULLET_SPEED,
  BULLET_LIFETIME_MS,
  FIRE_COOLDOWN_MS,
  ASTEROID_SIZES,
  asteroidCountForWave,
  wrap,
  randomAsteroidVelocity,
  spawnEdgePosition,
  makeAsteroid,
  splitAsteroid,
  circlesCollide,
  CHASE_SHIP_X,
  CHASE_SHIP_X_MIN,
  CHASE_SHIP_X_MAX,
  CHASE_INITIAL_LIVES,
  CHASE_ACCEL,
  CHASE_MAX_SPEED,
  CHASE_DRAG,
  CHASE_DISTANCE_SCORE_PER_PX,
  chaseScrollSpeedForElapsed,
  chaseSpawnIntervalForElapsed,
  chaseSpawnAsteroid,
  chaseBulletSpeedForElapsed,
  chaseFireCooldownForElapsed,
  POWERUP_TYPES,
  POWERUP_DROP_CHANCE,
  POWERUP_SUPPRESSED_DROP_CHANCE,
  POWERUP_SUPPRESS_MS,
  MAX_LIVES,
  POWERUP_RADIUS,
  POWERUP_LIFETIME_MS,
  RAPID_FIRE_COOLDOWN_MULTIPLIER,
  SPREAD_SHOT_ANGLE,
  SCORE_MULTIPLIER_FACTOR,
  SPEED_BOOST_MULTIPLIER,
  rollPowerupType,
  makePowerup,
  BOSS_INTERVAL_SECONDS,
  BOSS_RADIUS,
  BOSS_SCORE,
  BOSS_ENTRY_SPEED,
  BOSS_HOVER_X_FRACTION,
  BOSS_BOB_AMPLITUDE,
  BOSS_BOB_SPEED,
  BOSS_BULLET_RADIUS,
  makeBoss,
  BOSS_INTRO_GRACE_MS,
  BOSS_LASER_CHARGE_MS,
  BOSS_LASER_RECHARGE_MS,
  BOSS_LASER_ACTIVE_MS,
  BOSS_LASER_HALF_WIDTH,
  bossLaserPatternYs,
  BOSS_BURST_SHOT_INTERVAL_MS,
  BOSS_BURST_WINDUP_MS,
  bossBurstSizeForTier,
  bossBurstPauseForTier,
  bossSpiralChanceForTier,
  BOSS_SPIRAL_ARM_COUNT,
  BOSS_SPIRAL_BULLET_SPEED,
  BOSS_SPIRAL_DURATION_MS,
  BOSS_SPIRAL_ROTATION_SPEED,
  BOSS_SPIRAL_SHOT_INTERVAL_MS,
  BOSS_SPIRAL_WINDUP_MS,
  BOSS_PHASE_MIN_TIER,
  BOSS_PHASE_INTERVAL_MS,
  rollBossPhaseAttacks,
  DEFLECTOR_RECHARGE_MS,
  DEFLECTOR_FLASH_MS,
  DEFLECTOR_HIT_GRACE_MS,
  DUAL_FIRE_HEAT_MULTIPLIER,
  DUAL_FIRE_OFFSET,
  HEAT_MAX,
  HEAT_GAIN_PER_SECOND,
  HEAT_COOL_RATE,
  OVERHEAT_LOCKOUT_MS,
  coresForBossTier,
  SHOP_ITEMS,
  SHOP_ITEM_MAX_PURCHASES,
  shopItemCost,
  rollShopOffer,
  SHOP_REROLLS,
  SHOP_REROLL_COST,
  MERCHANT_OFFSET_X,
  MERCHANT_SHIELD_OFFSET_X,
  MERCHANT_SHIELD_RADIUS,
  MERCHANT_ENTER_MS,
  MERCHANT_LEAVE_SPEED,
  MERCHANT_CLEAR_RADIUS,
  randomBoardPerimeterPoint,
} from "./asteroidsEngine";
import { useAuth } from "@/app/games/AuthContext";
import GuestIcon from "@/app/games/GuestIcon";

const SPRITE_SRC = {
  ship: "/games/asteroids/ship.png",
  detailed: "/games/asteroids/meteor_detailed_large.png",
  square: "/games/asteroids/meteor_square_large.png",
  boss: "/games/asteroids/boss.png",
  shield: "/games/asteroids/powerups/shield.png",
  rapid_fire: "/games/asteroids/powerups/rapid_fire.png",
  spread_shot: "/games/asteroids/powerups/spread_shot.png",
  score_multiplier: "/games/asteroids/powerups/score_multiplier.png",
  speed_boost: "/games/asteroids/powerups/speed_boost.png",
  extra_life: "/games/asteroids/powerups/extra_life.png",
  bomb: "/games/asteroids/powerups/bomb.png",
  unlimited_fire: "/games/asteroids/powerups/unlimited_fire.png",
};

const POWERUP_COLORS = {
  shield: "#5ec8ff",
  rapid_fire: "#ffb057",
  spread_shot: "#ffe066",
  score_multiplier: "#c9a6ff",
  speed_boost: "#6effc2",
  extra_life: "#ff5e9c",
  bomb: "#ff5e5e",
  unlimited_fire: "#a8e6ff",
};

// Responsive board sizing — same approach as Tetris's cellSize auto-fit:
// budget out roughly how much horizontal/vertical chrome (heading, side
// panel, page padding, controls hint, touch D-pad on phones) surrounds the
// board, then size the canvas's *rendered* width (not its internal
// resolution — BOARD_W/BOARD_H stay fixed) to whatever fits. Recomputed on
// resize, which also fires on orientation change, so rotating the device
// reflows it the same way Tetris does.
const MIN_BOARD_RENDER_W = 260;
const BOARD_CHROME_W = 240;
const BOARD_CHROME_H = { desktop: 260, mobile: 480 };

// Rotating the canvas view means "up" on screen no longer matches "up" in
// the board's own (unrotated) coordinate space that physics/rendering run
// in. Rather than rotate the whole simulation, controls get remapped: a
// screen-relative press (the player always means "toward the top of what
// I'm looking at") is translated to whichever board-space direction
// currently appears there. Angles are clockwise-from-up, matching the CSS
// rotation applied to the canvas.
const DIR_ANGLES = { up: 0, right: 90, down: 180, left: 270 };
const ANGLE_DIRS = { 0: "up", 90: "right", 180: "down", 270: "left" };

function remapDirection(screenDir, rotation) {
  const boardAngle = ((DIR_ANGLES[screenDir] - rotation) % 360 + 360) % 360;
  return ANGLE_DIRS[boardAngle];
}

function createStars() {
  return Array.from({ length: 90 }, () => ({
    x: Math.random() * BOARD_W,
    y: Math.random() * BOARD_H,
    r: Math.random() * 1.4 + 0.3,
    a: 0.2 + Math.random() * 0.6,
  }));
}

function createCenteredShip() {
  return { x: BOARD_W / 2, y: BOARD_H / 2, angle: 0, vx: 0, vy: 0, invulnUntil: 0 };
}

function createChaseShip() {
  return { x: CHASE_SHIP_X, y: BOARD_H / 2, angle: Math.PI / 2, vx: 0, vy: 0, invulnUntil: 0 };
}

function createDeflector() {
  return {
    // No free charge — the deflector is fully store-gated, first purchase
    // included (see the "deflector" shop item).
    baseMax: 0,
    baseCharges: 0,
    // The shield powerup's charge only regenerates once Deflector's been
    // bought at least once (baseMax > 0) — that's the whole point of
    // paying for it. Before that, a pickup is a plain hold: use it within
    // DEFLECTOR_RECHARGE_MS (8s) of picking it up or it expires unused, and
    // if it blocks a hit it's gone for good until the next pickup — no
    // regen at all pre-purchase.
    bonusCharge: false,
    bonusExpiresAt: Infinity, // pre-purchase hold timer
    bonusNextChargeAt: Infinity, // post-purchase regen timer
    nextChargeAt: Infinity,
    graceUntil: 0,
    // { slot, startedAt, kind: "spend" | "regen" } — drives the per-segment
    // flash/fade in the shield render, nothing else.
    flashes: [],
  };
}

function createInitialState() {
  return {
    mode: "centered",
    ship: createCenteredShip(),
    bullets: [],
    asteroids: [],
    particles: [],
    powerups: [],
    activePowerups: {},
    powerupUiAccum: 0,
    powerupDropSuppressUntil: 0,
    brakeParticleAccum: 0,
    heat: 0,
    heatLockedUntil: 0,
    boss: null,
    bossBullets: [],
    nextBossAt: 0,
    bossesDefeated: 0,
    shopOpen: false,
    cores: 0,
    merchant: null,
    shopPurchaseCounts: {},
    shopOffer: [],
    shopRerollsLeft: 0,
    heatMaxBonus: 0,
    coolRateBonusPct: 0,
    dropChanceBonus: 0,
    lockoutReductionPct: 0,
    upgrades: { bulletDamage: 1, pierce: false, dualFire: false },
    // Chase-mode only in practice (nothing shoots back in classic), but
    // initialized unconditionally so no code path has to null-check it.
    deflector: createDeflector(),
    stars: createStars(),
    nextId: 1,
    wave: 0,
    distance: 0,
    distanceScore: 0,
    chaseElapsed: 0,
    // Advances only while running, unlike the rAF timestamp — everything
    // that schedules against an absolute deadline (fire cooldowns, buff
    // expiry, boss timers, bullet/powerup lifetimes) is keyed off this
    // instead of raw time, so a pause doesn't silently eat into any of it.
    gameTime: 0,
    scrollSpeed: 0,
    spawnAccum: 0,
    spawnInterval: 0,
    distanceUiAccum: 0,
    lastFireTime: 0,
    lastTime: 0,
    running: false,
    started: false,
    gameOver: false,
    score: 0,
    lives: INITIAL_LIVES,
  };
}

// Continuous collision check between two moving circles — did they ever get
// within (ra+rb) of each other at any point *during* this frame, not just
// at its end. circlesCollide alone only looks at where things ended up, so
// at high enough speed (chase mode's scroll ramp has no ceiling) a bullet
// can cross an asteroid's whole hitbox between one frame and the next
// without either frame's endpoint ever landing inside it — a bullet
// visibly passing through something it should have hit.
//
// Positions passed in are END-of-frame (after this frame's own += vx*dt
// already ran, same as everywhere circlesCollide is used) — start-of-frame
// position is reconstructed as pos - vel*dt rather than tracked separately.
// Working in a's frame of reference (relative position/velocity) reduces
// "two moving circles" to "one moving point vs. one still circle," which is
// the standard trick — same answer, one fewer moving part to reason about.
function sweptCirclesCollide(ax, ay, avx, avy, ar, bx, by, bvx, bvy, br, dt) {
  const ax0 = ax - avx * dt;
  const ay0 = ay - avy * dt;
  const bx0 = bx - bvx * dt;
  const by0 = by - bvy * dt;
  const px = ax0 - bx0;
  const py = ay0 - by0;
  const vx = avx - bvx;
  const vy = avy - bvy;
  const r = ar + br;
  const vv = vx * vx + vy * vy;
  if (vv < 1e-6) return px * px + py * py < r * r;
  // Time within [0, dt] the two are closest — vertex of the |p + v*t|^2
  // parabola, clamped to this frame's span.
  let t = -(px * vx + py * vy) / vv;
  if (t < 0) t = 0;
  else if (t > dt) t = dt;
  const cx = px + vx * t;
  const cy = py + vy * t;
  return cx * cx + cy * cy < r * r;
}

// Splits a fresh wave of large asteroids in around the edges — never right
// on top of the ship's center-spawn position.
function spawnWave(s, wave) {
  const count = asteroidCountForWave(wave);
  for (let i = 0; i < count; i++) {
    const pos = spawnEdgePosition(BOARD_W, BOARD_H);
    const velocity = randomAsteroidVelocity("large");
    s.asteroids.push(makeAsteroid(s.nextId++, "large", pos, velocity));
  }
}

function spawnParticles(s, x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 120;
    s.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 300 + Math.random() * 300,
      maxLife: 600,
      color,
    });
  }
}

function deflectorTotalCharges(d) {
  return d.baseCharges + (d.bonusCharge ? 1 : 0);
}

// Bonus charge goes first. Returns false when there was nothing left to
// spend and the hit should land for real.
function consumeDeflectorCharge(s, now) {
  const d = s.deflector;
  const slot = deflectorTotalCharges(d) - 1;
  if (slot < 0) return false;
  if (d.bonusCharge) {
    d.bonusCharge = false;
    d.bonusExpiresAt = Infinity;
    // Regen is a Deflector-purchase perk — spent pre-purchase, it's just
    // gone until the next pickup.
    if (d.baseMax > 0) d.bonusNextChargeAt = now + DEFLECTOR_RECHARGE_MS;
  } else {
    d.baseCharges -= 1;
    if (d.nextChargeAt === Infinity) d.nextChargeAt = now + DEFLECTOR_RECHARGE_MS;
  }
  d.flashes.push({ slot, startedAt: now, kind: "spend" });
  d.graceUntil = now + DEFLECTOR_HIT_GRACE_MS;
  return true;
}

function updateDeflector(s, now) {
  const d = s.deflector;
  if (d.baseCharges < d.baseMax && now >= d.nextChargeAt) {
    d.baseCharges += 1;
    d.flashes.push({ slot: deflectorTotalCharges(d) - 1, startedAt: now, kind: "regen" });
    d.nextChargeAt = d.baseCharges < d.baseMax ? now + DEFLECTOR_RECHARGE_MS : Infinity;
  }
  // Pre-purchase hold: an unused pickup expires instead of sitting forever.
  if (d.bonusCharge && d.baseMax === 0 && now >= d.bonusExpiresAt) {
    d.bonusCharge = false;
    d.bonusExpiresAt = Infinity;
  }
  // Post-purchase regen: only reachable once baseMax > 0 — see
  // consumeDeflectorCharge, which only arms this timer in that case.
  if (!d.bonusCharge && now >= d.bonusNextChargeAt) {
    d.bonusCharge = true;
    d.bonusNextChargeAt = Infinity;
    d.flashes.push({ slot: deflectorTotalCharges(d) - 1, startedAt: now, kind: "regen" });
  }
  if (d.flashes.length > 0) {
    d.flashes = d.flashes.filter((f) => now - f.startedAt < DEFLECTOR_FLASH_MS);
  }
}

// Aimed shots go at wherever the ship is right now (not led or tracked
// afterward), so standing still is a guaranteed hit and moving after it
// fires is a guaranteed dodge. Pattern shots ignore the ship entirely and
// fan out across the lane instead — that's what makes the invulnerability
// phases a dodge test rather than another aim check.
function fireBossBullet(s, boss, ship, now, shotIndex) {
  const muzzleX = boss.x - BOSS_RADIUS;
  let vx;
  let vy;
  if (boss.burstAimed) {
    const dx = ship.x - muzzleX;
    const dy = ship.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    vx = (dx / dist) * boss.bulletSpeed;
    vy = (dy / dist) * boss.bulletSpeed;
  } else {
    const spread = 0.5;
    const angle = Math.PI + (shotIndex - (boss.burstSizeThisVolley - 1) / 2) * spread;
    vx = Math.cos(angle) * boss.bulletSpeed;
    vy = Math.sin(angle) * boss.bulletSpeed;
  }
  s.bossBullets.push({ x: muzzleX, y: boss.y, vx, vy, bornAt: now });
}

function startBossBurst(boss, now, aimed) {
  boss.burstState = "windup";
  boss.burstPhaseAt = now;
  boss.burstShotsFired = 0;
  boss.burstAimed = aimed;
  boss.burstSizeThisVolley = bossBurstSizeForTier(boss.tier);
}

// Returns true on the frame the volley's last shot leaves the barrel — the
// caller decides what comes next (a pause, or the next scripted pattern).
function stepBossBurst(s, boss, ship, now) {
  if (boss.burstState === "windup") {
    if (now - boss.burstPhaseAt < BOSS_BURST_WINDUP_MS) return false;
    boss.burstState = "firing";
    boss.burstPhaseAt = now;
    boss.burstShotsFired = 0;
  }
  if (boss.burstShotsFired > 0 && now - boss.burstPhaseAt < BOSS_BURST_SHOT_INTERVAL_MS) {
    return false;
  }
  boss.burstPhaseAt = now;
  fireBossBullet(s, boss, ship, now, boss.burstShotsFired);
  boss.burstShotsFired += 1;
  return boss.burstShotsFired >= boss.burstSizeThisVolley;
}

function startBossSpiral(boss, now) {
  boss.spiralState = "windup";
  boss.spiralPhaseAt = now;
  boss.spiralAngle = Math.random() * Math.PI * 2;
  boss.spiralShotAccum = 0;
}

function stepBossSpiral(s, boss, now, dt) {
  if (boss.spiralState === "windup") {
    if (now - boss.spiralPhaseAt < BOSS_SPIRAL_WINDUP_MS) return false;
    boss.spiralState = "firing";
    boss.spiralPhaseAt = now;
  }
  boss.spiralAngle += BOSS_SPIRAL_ROTATION_SPEED * dt;
  boss.spiralShotAccum += dt * 1000;
  while (boss.spiralShotAccum >= BOSS_SPIRAL_SHOT_INTERVAL_MS) {
    boss.spiralShotAccum -= BOSS_SPIRAL_SHOT_INTERVAL_MS;
    for (let i = 0; i < BOSS_SPIRAL_ARM_COUNT; i++) {
      const angle = boss.spiralAngle + (i * Math.PI * 2) / BOSS_SPIRAL_ARM_COUNT;
      s.bossBullets.push({
        x: boss.x,
        y: boss.y,
        vx: Math.cos(angle) * BOSS_SPIRAL_BULLET_SPEED,
        vy: Math.sin(angle) * BOSS_SPIRAL_BULLET_SPEED,
        bornAt: now,
      });
    }
  }
  if (now - boss.spiralPhaseAt < BOSS_SPIRAL_DURATION_MS) return false;
  boss.spiralState = "idle";
  return true;
}

function startBossLaser(boss, ship, now, mode) {
  boss.laserPatternMode = mode;
  boss.laserState = "charging";
  boss.laserPhaseAt = now;
  if (mode === "simultaneous") {
    boss.laserYs = bossLaserPatternYs();
    boss.laserVolleyBeams = 1; // every beam is on screen at once, so one "beam" of work
  } else {
    boss.laserY = ship.y;
    boss.laserVolleyBeams = boss.laserBeamsTotal;
  }
  boss.laserBeamsRemaining = boss.laserVolleyBeams;
}

// Beams per volley: the first charges slow (a fair warning), any beam after
// it in the same volley re-locks onto the ship's current spot and charges
// much faster. Returns true when the whole volley is spent.
function stepBossLaser(boss, ship, now) {
  if (boss.laserState === "charging") {
    const chargeMs =
      boss.laserBeamsRemaining === boss.laserVolleyBeams
        ? BOSS_LASER_CHARGE_MS
        : BOSS_LASER_RECHARGE_MS;
    if (now - boss.laserPhaseAt >= chargeMs) {
      boss.laserState = "firing";
      boss.laserPhaseAt = now;
    }
    return false;
  }
  if (now - boss.laserPhaseAt < BOSS_LASER_ACTIVE_MS) return false;
  boss.laserBeamsRemaining -= 1;
  if (boss.laserBeamsRemaining > 0) {
    boss.laserState = "charging";
    boss.laserY = ship.y;
    boss.laserPhaseAt = now;
    return false;
  }
  boss.laserState = "idle";
  return true;
}

// Phase attacks always use the non-lock-on variants — during a phase the
// boss can't be shot, so the only thing left to do is read the pattern.
function startBossPhaseAttack(boss, ship, now) {
  const attack = boss.phaseQueue[0];
  if (attack === "burst") startBossBurst(boss, now, false);
  else if (attack === "spiral") startBossSpiral(boss, now);
  else startBossLaser(boss, ship, now, "simultaneous");
}

// The y positions a firing beam actually occupies — one entry in lock-on
// mode, several in simultaneous mode. Used by both the hit check and the
// render so the two can't disagree.
function bossLaserBeamYs(boss) {
  return boss.laserPatternMode === "simultaneous" ? boss.laserYs : [boss.laserY];
}

// Enters from a true random point on the board's border each time (see
// randomBoardPerimeterPoint), so it's never the same beat twice, and drifts
// in from there to the rest spot beside the ship — facing stays fixed on
// its eventual exit heading throughout (see the render code), so it reads
// as sliding in sideways rather than turning to face its approach.
function createMerchant(shipX, shipY, now) {
  const restX = shipX + MERCHANT_OFFSET_X;
  const restY = shipY;
  const from = randomBoardPerimeterPoint();
  return {
    x: from.x,
    y: from.y,
    fromX: from.x,
    fromY: from.y,
    restX,
    restY,
    dirX: 1, // exit heading — set for real by closeShop, this is just a default
    dirY: 0,
    state: "entering", // entering | idle | leaving
    phaseAt: now,
  };
}

// Entering eases into place; leaving just keeps going in the same straight
// line past the rest point and off the far side of the screen, sweeping
// any asteroid it passes near — a flythrough, not a retreat. Returns true
// once the merchant should be dropped from state entirely.
function updateMerchant(s, m, now, dt) {
  if (m.state === "entering") {
    const t = Math.min(1, (now - m.phaseAt) / MERCHANT_ENTER_MS);
    const eased = 1 - (1 - t) * (1 - t);
    m.x = m.fromX + (m.restX - m.fromX) * eased;
    m.y = m.fromY + (m.restY - m.fromY) * eased;
    if (t >= 1) m.state = "idle";
    return false;
  }
  if (m.state !== "leaving") return false;
  m.x += m.dirX * MERCHANT_LEAVE_SPEED * dt;
  m.y += m.dirY * MERCHANT_LEAVE_SPEED * dt;
  const cleared = new Set();
  for (const a of s.asteroids) {
    if (circlesCollide(a.x, a.y, ASTEROID_SIZES[a.size].radius, m.x, m.y, MERCHANT_CLEAR_RADIUS)) {
      cleared.add(a.id);
      spawnParticles(s, a.x, a.y, "#ffd15e", 8);
    }
  }
  if (cleared.size > 0) s.asteroids = s.asteroids.filter((a) => !cleared.has(a.id));
  return m.x < -120 || m.x > BOARD_W + 120 || m.y < -120 || m.y > BOARD_H + 120;
}

function updateCenteredShip(s, dt, keys, speedBoosted) {
  const ship = s.ship;
  const accel = speedBoosted ? THRUST_ACCEL * SPEED_BOOST_MULTIPLIER : THRUST_ACCEL;
  const maxSpeed = speedBoosted ? MAX_SPEED * SPEED_BOOST_MULTIPLIER : MAX_SPEED;
  if (keys.left) ship.angle -= ROTATION_SPEED * dt;
  if (keys.right) ship.angle += ROTATION_SPEED * dt;
  if (keys.up) {
    ship.vx += Math.sin(ship.angle) * accel * dt;
    ship.vy += -Math.cos(ship.angle) * accel * dt;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > maxSpeed) {
      ship.vx = (ship.vx / speed) * maxSpeed;
      ship.vy = (ship.vy / speed) * maxSpeed;
    }
  }
  const dragRate = keys.down ? BRAKE_DRAG : DRAG;
  const dragFactor = Math.max(0, 1 - dragRate * dt);
  ship.vx *= dragFactor;
  ship.vy *= dragFactor;

  // Brief skid trail while braking at any real speed — purely cosmetic,
  // throttled so it's a trickle, not a burst every frame.
  if (keys.down && Math.hypot(ship.vx, ship.vy) > 40) {
    s.brakeParticleAccum += dt * 1000;
    if (s.brakeParticleAccum > 60) {
      s.brakeParticleAccum = 0;
      spawnParticles(s, ship.x, ship.y, "#8cd2ff", 2);
    }
  }

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  wrap(ship, BOARD_W, BOARD_H);
}

// Applies a picked-up powerup's effect. Bomb/extra life are instant;
// everything else (re)arms that type's own slot in the active-buffs set —
// different types stack freely, but picking up the same type again just
// refreshes its clock instead of adding a second copy. Any pickup — of any
// type — also suppresses further drops for a while, so chaining several
// buffs back to back is the exception, not the norm.
function applyPowerupPickup(s, type, now, scoreMult) {
  s.powerupDropSuppressUntil = now + POWERUP_SUPPRESS_MS;
  if (type === "extra_life") {
    s.lives = Math.min(MAX_LIVES, s.lives + 1);
  } else if (type === "shield") {
    // Before Deflector's bought (baseMax 0), a pickup is a plain hold: use
    // it within DEFLECTOR_RECHARGE_MS or it expires, and it doesn't come
    // back on its own if spent — see updateDeflector/consumeDeflectorCharge.
    // Once bought, it behaves like a bought charge instead (regenerates).
    const d = s.deflector;
    d.bonusCharge = true;
    if (d.baseMax === 0) d.bonusExpiresAt = now + DEFLECTOR_RECHARGE_MS;
  } else if (type === "bomb") {
    const chase = s.mode === "chase";
    for (const a of s.asteroids) {
      // Chase mode's score is distance + boss bonuses only — a bomb clear
      // is a panic button there, not a scoring move.
      if (!chase) s.score += ASTEROID_SIZES[a.size].score * scoreMult;
      spawnParticles(s, a.x, a.y, "#c9c9e8");
    }
    s.asteroids = [];
  } else {
    s.activePowerups[type] = now + POWERUP_TYPES[type].duration;
  }
}

function updateChaseShip(s, dt, keys, speedBoosted) {
  const ship = s.ship;
  const accel = speedBoosted ? CHASE_ACCEL * SPEED_BOOST_MULTIPLIER : CHASE_ACCEL;
  const maxSpeed = speedBoosted ? CHASE_MAX_SPEED * SPEED_BOOST_MULTIPLIER : CHASE_MAX_SPEED;

  if (keys.up) ship.vy -= accel * dt;
  if (keys.down) ship.vy += accel * dt;
  if (ship.vy > maxSpeed) ship.vy = maxSpeed;
  if (ship.vy < -maxSpeed) ship.vy = -maxSpeed;
  ship.vy *= 1 - CHASE_DRAG * dt;
  ship.y += ship.vy * dt;
  const marginY = SHIP_RADIUS;
  if (ship.y < marginY) {
    ship.y = marginY;
    ship.vy = 0;
  } else if (ship.y > BOARD_H - marginY) {
    ship.y = BOARD_H - marginY;
    ship.vy = 0;
  }

  if (keys.left) ship.vx -= accel * dt;
  if (keys.right) ship.vx += accel * dt;
  if (ship.vx > maxSpeed) ship.vx = maxSpeed;
  if (ship.vx < -maxSpeed) ship.vx = -maxSpeed;
  ship.vx *= 1 - CHASE_DRAG * dt;
  ship.x += ship.vx * dt;
  if (ship.x < CHASE_SHIP_X_MIN) {
    ship.x = CHASE_SHIP_X_MIN;
    ship.vx = 0;
  } else if (ship.x > CHASE_SHIP_X_MAX) {
    ship.x = CHASE_SHIP_X_MAX;
    ship.vx = 0;
  }
}

export default function AsteroidsGame() {
  const canvasRef = useRef(null);
  const imagesRef = useRef({});

  // Mutable game state lives in a ref, outside React's render cycle, so the
  // animation loop and input handlers can read/write it every frame without
  // triggering re-renders; React state below is only for the bits the UI
  // needs to display. Mirrors the ref/state split used by
  // TypewriterGame.js / TetrisGame.js.
  const stateRef = useRef(createInitialState());
  const keysRef = useRef({ left: false, right: false, up: false, down: false, fire: false });

  const [mode, setMode] = useState("centered");
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(0);
  const [distance, setDistance] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [activePowerupsUi, setActivePowerupsUi] = useState([]);
  const [shopOpen, setShopOpen] = useState(false);
  const [cores, setCores] = useState(0);
  const [shopPurchaseCounts, setShopPurchaseCounts] = useState({});
  const [shopOffer, setShopOffer] = useState([]);
  const [shopRerollsLeft, setShopRerollsLeft] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  // Rendered board width in px — auto-fit to the viewport, same pattern as
  // Tetris's cellSize: starts at the native resolution, the effect below
  // shrinks it to fit as soon as window dimensions are available (SSR has
  // none — `maxWidth: "100%"` on the wrapper covers that first frame), and
  // the slider lets the player override it freely, same as Tetris's board-
  // size slider. Once overridden, auto-fit stops adjusting it on
  // resize/rotation until "Default" is pressed again.
  const [boardRenderW, setBoardRenderW] = useState(BOARD_W);
  const manualBoardSizeRef = useRef(false);

  // Manual canvas rotation — a desktop-friendly "play it vertical" option,
  // independent of device/screen orientation. Cycles 0 -> 90 -> 180 -> 270.
  // Controls remap to match (see remapDirection/setDirectionKey below) —
  // "up" always means toward the top of whatever's currently on screen.
  const [canvasRotation, setCanvasRotation] = useState(0);
  const canvasRotationRef = useRef(0);
  useEffect(() => {
    canvasRotationRef.current = canvasRotation;
    // Rotating mid-hold would otherwise leave a stale board-space flag
    // stuck true (set under the old mapping, never cleared since the key
    // release now clears a different flag under the new one).
    const keys = keysRef.current;
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
  }, [canvasRotation]);

  const boardRenderH = boardRenderW * (BOARD_H / BOARD_W);
  const rotatedSideways = canvasRotation === 90 || canvasRotation === 270;
  const canvasTransform =
    canvasRotation === 90
      ? "rotate(90deg) translateY(-100%)"
      : canvasRotation === 180
        ? "rotate(180deg) translate(-100%, -100%)"
        : canvasRotation === 270
          ? "rotate(270deg) translateX(-100%)"
          : "none";

  // Sets/clears the board-space key that a screen-relative direction
  // currently maps to, given the live canvas rotation. Used by both
  // keyboard and the touch D-pad, so remapping is consistent everywhere.
  const setDirectionKey = useCallback((screenDir, pressed) => {
    keysRef.current[remapDirection(screenDir, canvasRotationRef.current)] = pressed;
  }, []);

  const computeBoardFit = useCallback(() => {
    const isMobile = window.innerWidth < 640; // matches the sm: breakpoint elsewhere
    const widthBudget = window.innerWidth - BOARD_CHROME_W;
    const heightBudget =
      window.innerHeight - (isMobile ? BOARD_CHROME_H.mobile : BOARD_CHROME_H.desktop);
    const maxWByHeight = heightBudget * (BOARD_W / BOARD_H);
    const fit = Math.min(widthBudget, maxWByHeight);
    return Math.max(MIN_BOARD_RENDER_W, Math.min(BOARD_W, fit));
  }, []);

  const applyBoardFit = useCallback(() => {
    if (!manualBoardSizeRef.current) setBoardRenderW(computeBoardFit());
  }, [computeBoardFit]);

  useEffect(() => {
    // Initial fit needs window dimensions, unavailable during SSR/first
    // render, so this has to run post-mount rather than as initial state.
    applyBoardFit();
    // orientationchange can fire before the browser has settled on the new
    // innerWidth/innerHeight (notably iOS Safari), so re-check shortly
    // after too rather than trusting the values at the moment it fires.
    const onOrientationChange = () => {
      applyBoardFit();
      setTimeout(applyBoardFit, 200);
    };
    window.addEventListener("resize", applyBoardFit);
    window.addEventListener("orientationchange", onOrientationChange);
    return () => {
      window.removeEventListener("resize", applyBoardFit);
      window.removeEventListener("orientationchange", onOrientationChange);
    };
  }, [applyBoardFit]);

  // Leaderboard: sessionTokenRef is minted fresh per game (see startGame),
  // same anti-cheat approach as Tetris/Typewriter — see
  // /api/games/asteroids-classic/score (or -chase) for why. Classic and
  // Chase are separate leaderboards since they score completely
  // differently — see gamesList.js's LEADERBOARDS export.
  const sessionTokenRef = useRef(null);
  const [playerName, setPlayerName] = useState("");
  const [submitState, setSubmitState] = useState("idle"); // idle | submitting | submitted | error
  const [submitError, setSubmitError] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const { loggedIn, username, setModalOpen: setAuthModalOpen } = useAuth();

  useEffect(() => {
    // localStorage is unavailable during SSR/first render, so this has to
    // run post-mount rather than as initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerName(localStorage.getItem("asteroids-name") ?? "");
  }, []);

  // Preload sprites once. draw() checks img.complete before drawing, so a
  // slow load just means a blank frame or two rather than a broken game.
  useEffect(() => {
    for (const [key, src] of Object.entries(SPRITE_SRC)) {
      const img = new Image();
      img.src = src;
      imagesRef.current[key] = img;
    }
  }, []);

  const fetchLeaderboard = useCallback(() => {
    const slug = mode === "chase" ? "asteroids-chase" : "asteroids-classic";
    fetch(`/api/games/${slug}/leaderboard`)
      .then((res) => res.json())
      .then((data) => setLeaderboard(data.entries ?? []))
      .catch(() => {});
  }, [mode]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const submitScore = useCallback(async () => {
    const token = sessionTokenRef.current;
    if (!token) {
      setSubmitState("error");
      setSubmitError("No active session — try restarting.");
      return;
    }
    setSubmitState("submitting");
    try {
      const slug = mode === "chase" ? "asteroids-chase" : "asteroids-classic";
      const res = await fetch(`/api/games/${slug}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playerName,
          score: stateRef.current.score,
          token,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitState("error");
        setSubmitError(data.error ?? "Submission failed.");
        return;
      }
      localStorage.setItem("asteroids-name", playerName);
      setSubmitState("submitted");
      fetchLeaderboard();
    } catch {
      setSubmitState("error");
      setSubmitError("Network error.");
    }
  }, [playerName, fetchLeaderboard, mode]);

  const drawSprite = (ctx, key, x, y, size, rotation) => {
    const img = imagesRef.current[key];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }
    ctx.restore();
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;

    ctx.fillStyle = "#0b0b12";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    for (const star of s.stars) {
      ctx.fillStyle = `rgba(255,255,255,${star.a})`;
      ctx.fillRect(star.x, star.y, star.r, star.r);
    }

    for (const p of s.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Bullets currently overlapping the boss draw here, under the boss
    // sprite, so a piercing round visibly passes *through* it; everything
    // else draws on top after the boss (see below).
    const bulletsOverBoss = [];
    const bulletsInFront = [];
    for (const b of s.bullets) {
      if (s.boss && circlesCollide(b.x, b.y, 2, s.boss.x, s.boss.y, BOSS_RADIUS)) {
        bulletsOverBoss.push(b);
      } else {
        bulletsInFront.push(b);
      }
    }
    const drawBullets = (list) => {
      ctx.fillStyle = "#ff5e9c";
      for (const b of list) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawBullets(bulletsOverBoss);

    for (const a of s.asteroids) {
      const { radius } = ASTEROID_SIZES[a.size];
      const key = a.variant === "detailed" ? "detailed" : "square";
      drawSprite(ctx, key, a.x, a.y, radius * 2.3, a.rotation);
    }

    const nowMs = s.gameTime;
    for (const p of s.powerups) {
      const remaining = POWERUP_LIFETIME_MS - (nowMs - p.bornAt);
      // Blink for the last couple seconds before despawning, so a missed
      // pickup doesn't just vanish without warning.
      if (remaining < 2000 && Math.floor(nowMs / 150) % 2 === 0) continue;
      const pulse = 1 + Math.sin(nowMs / 220 + p.id) * 0.08;
      drawSprite(ctx, p.type, p.x, p.y, POWERUP_RADIUS * 2.4 * pulse, 0);
    }

    ctx.fillStyle = "#ff5e5e";
    for (const b of s.bossBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BOSS_BULLET_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    if (s.boss) {
      const boss = s.boss;
      const invulnerable = nowMs < boss.vulnerableAt || boss.phaseActive;
      // Glow ring behind the sprite, and a health bar above it — both just
      // plain canvas shapes, same treatment as the powerup badges. Blue
      // while it can't be hurt yet, red once it's a fair target.
      const glowRgb = invulnerable ? "94,200,255" : "255,94,94";
      for (let i = 6; i > 0; i--) {
        ctx.fillStyle = `rgba(${glowRgb},${0.03 * (7 - i)})`;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, BOSS_RADIUS + i * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Phases look nothing like the brief intro grace: a hard, pulsing ring
      // that says "shooting me is pointless right now, dodge instead."
      if (boss.phaseActive) {
        const pulse = 0.5 + Math.sin(nowMs / 120) * 0.25;
        ctx.strokeStyle = `rgba(94,200,255,${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, BOSS_RADIUS + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (boss.laserState !== "idle") {
        const beamYs = bossLaserBeamYs(boss);
        if (boss.laserState === "charging") {
          const progress = Math.min(1, (nowMs - boss.laserPhaseAt) / BOSS_LASER_CHARGE_MS);
          // Grows from a thin flicker to a solid line as the charge fills, so
          // the last moment before firing reads as "about to go off."
          ctx.strokeStyle = `rgba(255,94,94,${0.25 + progress * 0.5})`;
          ctx.lineWidth = 1 + progress * 3;
          ctx.setLineDash([10, 8]);
          ctx.lineDashOffset = -nowMs / 20;
          for (const beamY of beamYs) {
            ctx.beginPath();
            ctx.moveTo(0, beamY);
            ctx.lineTo(boss.x - BOSS_RADIUS, beamY);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        } else {
          for (const beamY of beamYs) {
            ctx.fillStyle = "rgba(255,94,94,0.35)";
            ctx.fillRect(0, beamY - BOSS_LASER_HALF_WIDTH - 4, boss.x - BOSS_RADIUS, BOSS_LASER_HALF_WIDTH * 2 + 8);
            ctx.fillStyle = "#ff5e5e";
            ctx.fillRect(0, beamY - BOSS_LASER_HALF_WIDTH, boss.x - BOSS_RADIUS, BOSS_LASER_HALF_WIDTH * 2);
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.fillRect(0, beamY - 2, boss.x - BOSS_RADIUS, 4);
          }
        }
      }

      drawSprite(ctx, "boss", boss.x, boss.y, BOSS_RADIUS * 2.3, boss.rotation);

      // Windup telegraph for the gun attacks — same "it's coming" language
      // as the laser charge, but on the boss itself since a burst/spiral
      // has no beam line to draw ahead of time.
      const windup =
        boss.burstState === "windup"
          ? (nowMs - boss.burstPhaseAt) / BOSS_BURST_WINDUP_MS
          : boss.spiralState === "windup"
            ? (nowMs - boss.spiralPhaseAt) / BOSS_SPIRAL_WINDUP_MS
            : -1;
      if (windup >= 0) {
        const flash = Math.min(1, windup) * (0.55 + Math.sin(nowMs / 60) * 0.25);
        ctx.fillStyle = `rgba(255,220,120,${flash * 0.45})`;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, BOSS_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,220,120,${flash})`;
        ctx.lineWidth = 2 + Math.min(1, windup) * 3;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, BOSS_RADIUS + 6 - Math.min(1, windup) * 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      const barW = BOSS_RADIUS * 2;
      const barX = boss.x - BOSS_RADIUS;
      const barY = boss.y - BOSS_RADIUS - 16;
      const pct = Math.max(0, boss.health / boss.maxHealth);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(barX, barY, barW, 6);
      ctx.fillStyle = invulnerable ? "#5ec8ff" : "#ff5e5e";
      ctx.fillRect(barX, barY, barW * pct, 6);
    }

    drawBullets(bulletsInFront);

    // Merchant + shield — gold glow (distinct from the boss's blue/red) so
    // it doesn't read as another hazard. Drawn through all three states
    // (entering/idle/leaving), not just while the shop UI is up, so the
    // flythrough is visible after the shop's already closed. Facing is
    // fixed on its exit heading (straight ahead of the ship) the entire
    // time, entrance included, so drifting in from any border point reads
    // as a sideways slide rather than a turn. Shield never drops, same
    // reason — it's up for as long as the merchant is on screen at all.
    if (s.merchant) {
      const m = s.merchant;
      for (let i = 6; i > 0; i--) {
        ctx.fillStyle = `rgba(255,209,94,${0.03 * (7 - i)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, SHIP_RADIUS * 2 + i * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      drawSprite(ctx, "ship", m.x, m.y, SHIP_RADIUS * 2.6, Math.PI / 2);

      const shieldX = m.x + MERCHANT_SHIELD_OFFSET_X;
      const pulse = 1 + Math.sin(nowMs / 300) * 0.05;
      ctx.beginPath();
      ctx.moveTo(shieldX, m.y);
      ctx.arc(shieldX, m.y, MERCHANT_SHIELD_RADIUS * pulse, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(94,200,255,0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(94,200,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (s.started && !(s.gameOver && s.lives <= 0)) {
      const invuln = nowMs < s.ship.invulnUntil;
      // Blink while invulnerable so a fresh respawn is visibly telegraphed.
      if (!invuln || Math.floor(nowMs / 100) % 2 === 0) {
        const size = SHIP_RADIUS * 2.6;
        // Chase mode auto-flies forward the whole time, so its flame is
        // always lit while running; centered mode's flame only shows while
        // the thrust key is actually held.
        const showFlame = s.running && (s.mode === "chase" || keysRef.current.up);
        if (showFlame) {
          ctx.save();
          ctx.translate(s.ship.x, s.ship.y);
          ctx.rotate(s.ship.angle);
          ctx.fillStyle = "rgba(255,180,80,0.85)";
          ctx.beginPath();
          ctx.moveTo(-4, SHIP_RADIUS * 0.9);
          ctx.lineTo(4, SHIP_RADIUS * 0.9);
          ctx.lineTo(0, SHIP_RADIUS * 1.8 + Math.random() * 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        drawSprite(ctx, "ship", s.ship.x, s.ship.y, size, s.ship.angle);

        // Brake flares: two small icy jets flashing forward from the nose,
        // opposite the rear thruster and a different color so it doesn't
        // read as "still accelerating." Oriented off the actual drift
        // vector, not the ship's facing — with inertia, those two can
        // point in completely different directions while spinning, and
        // pinning it to ship.angle looked wrong whenever they diverged.
        const brakeSpeed = Math.hypot(s.ship.vx, s.ship.vy);
        const braking = s.running && s.mode === "centered" && keysRef.current.down && brakeSpeed > 15;
        if (braking) {
          const travelAngle = Math.atan2(s.ship.vx, -s.ship.vy);
          ctx.save();
          ctx.translate(s.ship.x, s.ship.y);
          ctx.rotate(travelAngle);
          ctx.fillStyle = "rgba(140,210,255,0.85)";
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(side * SHIP_RADIUS * 0.5, -SHIP_RADIUS * 0.6);
            ctx.lineTo(side * SHIP_RADIUS * 0.9, -SHIP_RADIUS * 0.6);
            ctx.lineTo(side * SHIP_RADIUS * 0.65, -SHIP_RADIUS * 1.3 - Math.random() * 4);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }

    // Deflector: one full semicircle per available charge, wrapping the
    // front and sides of the ship and open at the back, stacked outward as
    // concentric rings — so 3 charges reads as 3 nested semicircles rather
    // than one arc carved into wedges. Rings flash bright as they're spent
    // and fade back in as they recharge.
    if (s.started && !(s.gameOver && s.lives <= 0)) {
      const d = s.deflector;
      const maxSlots = d.baseMax + 1; // +1 for the powerup's bonus charge
      const total = d.baseCharges + (d.bonusCharge ? 1 : 0);
      const arcHalf = Math.PI / 2; // 90 deg each way — a full semicircle, open at the back
      const facing = s.ship.angle - Math.PI / 2; // ship.angle is clockwise-from-up
      const ringGap = 5;
      for (let slot = 0; slot < maxSlots; slot++) {
        const spend = d.flashes.find((x) => x.slot === slot && x.kind === "spend");
        const regen = d.flashes.find((x) => x.slot === slot && x.kind === "regen");
        if (slot >= total && !spend) continue;
        let color;
        let width;
        if (spend) {
          const t = Math.max(0, 1 - (nowMs - spend.startedAt) / DEFLECTOR_FLASH_MS);
          color = `rgba(200,240,255,${t})`;
          width = 3 + t * 3;
        } else {
          const t = regen ? Math.min(1, (nowMs - regen.startedAt) / DEFLECTOR_FLASH_MS) : 1;
          color = `rgba(94,200,255,${0.55 * t})`;
          width = 3;
        }
        const radius = SHIP_RADIUS * 1.7 + slot * ringGap;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(s.ship.x, s.ship.y, radius, facing - arcHalf, facing + arcHalf);
        ctx.stroke();
      }
    }

    // Weapon heat gauge — floats just off the ship's upper-right so it
    // stays in view no matter where the ship wanders, rather than sitting
    // in a fixed HUD spot far from what you're actually looking at. Fills
    // as heat rises: blue/green while safe, amber then red as it climbs,
    // flashes red while locked out so "why can't I shoot" reads instantly.
    // Clamped to the board so it doesn't clip off-screen near the edges.
    // Chase mode only — classic has no heat mechanic.
    if (s.mode === "chase" && s.started && !(s.gameOver && s.lives <= 0)) {
      const heatR = 13;
      const heatMargin = heatR + 4;
      const heatCx = Math.min(BOARD_W - heatMargin, Math.max(heatMargin, s.ship.x + SHIP_RADIUS * 2.4));
      const heatCy = Math.min(BOARD_H - heatMargin, Math.max(heatMargin, s.ship.y - SHIP_RADIUS * 2.4));
      const locked = nowMs < s.heatLockedUntil;
      const heatPct = Math.min(1, s.heat / (HEAT_MAX + s.heatMaxBonus));

      ctx.beginPath();
      ctx.arc(heatCx, heatCy, heatR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (heatPct > 0) {
        let fillColor;
        if (locked) {
          fillColor = Math.floor(nowMs / 150) % 2 === 0 ? "#ff5e5e" : "#ffb3b3";
        } else if (heatPct > 0.75) {
          fillColor = "#ff8a5e";
        } else if (heatPct > 0.4) {
          fillColor = "#ffd15e";
        } else {
          fillColor = "#8cd2ff";
        }
        const startAngle = -Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(heatCx, heatCy);
        ctx.arc(heatCx, heatCy, heatR - 3, startAngle, startAngle + Math.PI * 2 * heatPct);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
      }

      if (locked) {
        ctx.fillStyle = "rgba(255,94,94,0.9)";
        ctx.font = "600 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("OVERHEATED", heatCx, heatCy + heatR + 12);
        ctx.textAlign = "left";
      }
    }
  }, []);

  const endGame = useCallback(() => {
    const s = stateRef.current;
    s.running = false;
    s.gameOver = true;
    setGameOver(true);
  }, []);

  const respawnShip = useCallback(() => {
    const s = stateRef.current;
    s.lives -= 1;
    setLives(s.lives);
    // A hit wipes every active buff, not just whichever one would've
    // saved you — losing a life resets the slate. Deflector is left alone:
    // a hit only reaches the ship at all once every charge is already
    // spent (see consumeDeflectorCharge), so there's nothing to reset —
    // refilling here would make losing a life a free shield recharge.
    s.activePowerups = {};
    if (s.lives <= 0) {
      endGame();
      return;
    }
    s.ship = s.mode === "chase" ? createChaseShip() : createCenteredShip();
    s.ship.invulnUntil = s.gameTime + RESPAWN_INVULN_MS;
  }, [endGame]);

  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (!s.started || s.gameOver) return;
    setPaused((prev) => {
      const next = !prev;
      s.running = !next;
      return next;
    });
  }, []);

  const buyItem = useCallback((key) => {
    const s = stateRef.current;
    const bought = s.shopPurchaseCounts[key] || 0;
    const max = SHOP_ITEM_MAX_PURCHASES[key];
    if (max !== undefined && bought >= max) return;
    const cost = shopItemCost(key, bought);
    if (s.cores < cost) return;
    s.cores -= cost;
    s.shopPurchaseCounts[key] = bought + 1;
    if (key === "heat_capacity") s.heatMaxBonus += 15;
    else if (key === "coolant_boost") s.coolRateBonusPct += 0.25;
    else if (key === "extra_life") s.lives += 1;
    else if (key === "lucky_scavenger") s.dropChanceBonus += 0.02;
    else if (key === "shorter_overheat") s.lockoutReductionPct += 0.15;
    else if (key === "damage") s.upgrades.bulletDamage += 0.25;
    else if (key === "pierce") s.upgrades.pierce = true;
    else if (key === "dual_fire") s.upgrades.dualFire = true;
    else if (key === "deflector") {
      // Bought charges regenerate like the free one, so the max goes up and
      // the new charge is handed over already full.
      s.deflector.baseMax += 1;
      s.deflector.baseCharges += 1;
    }
    setCores(s.cores);
    setShopPurchaseCounts({ ...s.shopPurchaseCounts });
    if (key === "extra_life") setLives(s.lives);
  }, []);

  const rerollShop = useCallback(() => {
    const s = stateRef.current;
    if (s.shopRerollsLeft <= 0 || s.cores < SHOP_REROLL_COST) return;
    s.cores -= SHOP_REROLL_COST;
    s.shopRerollsLeft -= 1;
    s.shopOffer = rollShopOffer(s.shopPurchaseCounts, s.bossesDefeated);
    setCores(s.cores);
    setShopRerollsLeft(s.shopRerollsLeft);
    setShopOffer(s.shopOffer);
  }, []);

  const closeShop = useCallback(() => {
    const s = stateRef.current;
    s.shopOpen = false;
    // Merchant doesn't just vanish — regardless of which edge it came in
    // from, it always exits straight ahead of the ship (matching the
    // ship's current lane), sweeping any debris directly in that line as
    // it flies off (see updateMerchant). Gameplay resumes immediately; the
    // flythrough plays out in the background.
    if (s.merchant) {
      const m = s.merchant;
      m.state = "leaving";
      m.y = s.ship.y;
      m.dirX = 1;
      m.dirY = 0;
    }
    setShopOpen(false);
  }, []);

  const startGame = useCallback(
    (chosenMode) => {
      const s = stateRef.current;
      Object.assign(s, createInitialState());
      s.mode = chosenMode;
      s.running = true;
      s.started = true;

      if (chosenMode === "chase") {
        s.ship = createChaseShip();
        s.lives = CHASE_INITIAL_LIVES;
        s.scrollSpeed = chaseScrollSpeedForElapsed(0);
        s.spawnInterval = chaseSpawnIntervalForElapsed(0);
        s.nextBossAt = BOSS_INTERVAL_SECONDS;
      } else {
        s.ship = createCenteredShip();
        s.lives = INITIAL_LIVES;
        s.wave = 1;
        spawnWave(s, s.wave);
      }

      setMode(chosenMode);
      setScore(0);
      setWave(s.wave);
      setDistance(0);
      setLives(s.lives);
      setActivePowerupsUi([]);
      setShopOpen(false);
      setCores(0);
      setShopPurchaseCounts({});
      setGameOver(false);
      setPaused(false);
      setStarted(true);
      setSubmitState("idle");
      setSubmitError("");

      sessionTokenRef.current = null;
      const sessionSlug = chosenMode === "chase" ? "asteroids-chase" : "asteroids-classic";
      fetch(`/api/games/${sessionSlug}/session`, { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          sessionTokenRef.current = data.token ?? null;
        })
        .catch(() => {});

      draw();
    },
    [draw]
  );

  const backToModeSelect = useCallback(() => {
    const s = stateRef.current;
    s.started = false;
    s.running = false;
    setStarted(false);
    setGameOver(false);
  }, []);

  // Animation loop. The per-frame mutation logic (bullets/asteroids/
  // particles) lives directly in this loop rather than in a memoized
  // callback — mirrors how Tetris/Typewriter keep their own per-frame array
  // mutations (e.g. `for (const w of s.words) w.y += dy`) inline in the
  // loop body, which the React Compiler's mutation analysis can verify as
  // safe in a way it can't for the same code inside a useCallback.
  useEffect(() => {
    let frameId;
    const loop = (time) => {
      const s = stateRef.current;
      if (s.running) {
        const delta = time - (s.lastTime || time);
        s.lastTime = time;
        const dt = Math.min(0.05, delta / 1000);
        s.gameTime += dt * 1000;
        const now = s.gameTime;
        const keys = keysRef.current;
        const ship = s.ship;
        const chase = s.mode === "chase";

        for (const type of Object.keys(s.activePowerups)) {
          if (now >= s.activePowerups[type]) delete s.activePowerups[type];
        }
        const rapidFire = "rapid_fire" in s.activePowerups;
        const spreadShot = "spread_shot" in s.activePowerups;
        const speedBoost = "speed_boost" in s.activePowerups;
        const unlimitedFire = "unlimited_fire" in s.activePowerups;
        const scoreMult = "score_multiplier" in s.activePowerups ? SCORE_MULTIPLIER_FACTOR : 1;

        // Weapon heat: chase mode only — classic keeps its original
        // unlimited-sustained-fire feel, just cooldown-limited like always.
        // Rises smoothly the whole time fire is held (not in jumps per
        // shot), drains fast (empties over exactly the lockout) while
        // locked, drains slow whenever it's neither — see HEAT_* comments
        // in the engine file. Shop purchases raise the effective max and
        // cool rate for the rest of the run.
        const effectiveHeatMax = HEAT_MAX + s.heatMaxBonus;
        const effectiveCoolRate = HEAT_COOL_RATE * (1 + s.coolRateBonusPct);
        const effectiveLockoutMs = OVERHEAT_LOCKOUT_MS * (1 - s.lockoutReductionPct);
        if (!chase) {
          // no-op: heat stays at 0, never locks out
        } else if (now < s.heatLockedUntil) {
          s.heat = Math.max(0, s.heat - (effectiveHeatMax / (effectiveLockoutMs / 1000)) * dt);
        } else if (keys.fire && !unlimitedFire && !s.shopOpen) {
          const heatRate =
            HEAT_GAIN_PER_SECOND * (s.upgrades.dualFire ? DUAL_FIRE_HEAT_MULTIPLIER : 1);
          s.heat = Math.min(effectiveHeatMax, s.heat + heatRate * dt);
          if (s.heat >= effectiveHeatMax) s.heatLockedUntil = now + effectiveLockoutMs;
        } else {
          s.heat = Math.max(0, s.heat - effectiveCoolRate * dt);
        }

        if (!s.shopOpen) {
          if (chase) updateChaseShip(s, dt, keys, speedBoost);
          else updateCenteredShip(s, dt, keys, speedBoost);
        }

        let fireCooldown = chase
          ? chaseFireCooldownForElapsed(s.chaseElapsed)
          : FIRE_COOLDOWN_MS;
        if (rapidFire) fireCooldown *= RAPID_FIRE_COOLDOWN_MULTIPLIER;
        const bulletSpeed = chase
          ? chaseBulletSpeedForElapsed(s.chaseElapsed)
          : BULLET_SPEED;
        if (keys.fire && now - s.lastFireTime > fireCooldown && now >= s.heatLockedUntil && !s.shopOpen) {
          s.lastFireTime = now;
          const nose = {
            x: ship.x + Math.sin(ship.angle) * SHIP_RADIUS,
            y: ship.y - Math.cos(ship.angle) * SHIP_RADIUS,
          };
          const spreadOffsets = spreadShot ? [-SPREAD_SHOT_ANGLE, 0, SPREAD_SHOT_ANGLE] : [0];
          // Twin cannons multiply the spread rather than replacing it — the
          // two upgrades are bought separately, so neither should quietly
          // cancel the other out.
          const barrels = s.upgrades.dualFire ? [-1, 1] : [0];
          // Wing-mounted, not converged at the nose tip — fired from the
          // ship's center-body sides so two shots visibly read as two guns.
          const origin = s.upgrades.dualFire ? ship : nose;
          for (const offset of spreadOffsets) {
            const angle = ship.angle + offset;
            for (const side of barrels) {
              s.bullets.push({
                x: origin.x + Math.cos(ship.angle) * side * DUAL_FIRE_OFFSET,
                y: origin.y + Math.sin(ship.angle) * side * DUAL_FIRE_OFFSET,
                vx: Math.sin(angle) * bulletSpeed,
                vy: -Math.cos(angle) * bulletSpeed,
                bornAt: now,
              });
            }
          }
        }

        s.bullets = s.bullets.filter((b) => now - b.bornAt < BULLET_LIFETIME_MS);
        for (const b of s.bullets) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (!chase) wrap(b, BOARD_W, BOARD_H);
        }

        if (chase) {
          // Shop interlude: distance/difficulty timer freeze, but asteroids
          // keep flying and spawning at whatever rate was already in
          // effect — the "rocks bouncing off the shield" animation needs
          // them alive, it's only progression that's on hold.
          if (!s.shopOpen) {
            s.chaseElapsed += dt;
            s.distance += s.scrollSpeed * dt;
          }
          s.scrollSpeed = chaseScrollSpeedForElapsed(s.chaseElapsed);
          s.spawnInterval = chaseSpawnIntervalForElapsed(s.chaseElapsed);

          s.spawnAccum += dt * 1000;
          if (s.spawnAccum > s.spawnInterval) {
            s.spawnAccum = 0;
            s.asteroids.push(chaseSpawnAsteroid(s.nextId++, s.chaseElapsed));
          }

          for (const a of s.asteroids) {
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            a.rotation += a.spin * dt;
          }
          s.asteroids = s.asteroids.filter((a) => a.x > -80);

          for (const star of s.stars) {
            star.x -= s.scrollSpeed * 0.3 * dt;
            if (star.x < 0) star.x += BOARD_W;
          }

          if (!s.shopOpen) {
            const newDistanceScore = Math.floor(s.distance * CHASE_DISTANCE_SCORE_PER_PX);
            if (newDistanceScore > s.distanceScore) {
              s.score += newDistanceScore - s.distanceScore;
              s.distanceScore = newDistanceScore;
            }
          }

          s.distanceUiAccum += dt * 1000;
          if (s.distanceUiAccum > 200) {
            s.distanceUiAccum = 0;
            setDistance(Math.floor(s.distance));
          }
        } else {
          for (const a of s.asteroids) {
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            a.rotation += a.spin * dt;
            wrap(a, BOARD_W, BOARD_H);
          }
        }

        // Boss: spawn on schedule, fly in, then weave + fire while chase
        // asteroids keep spawning around it as usual.
        if (chase) {
          if (!s.boss && s.chaseElapsed >= s.nextBossAt) {
            s.boss = makeBoss(now, s.bossesDefeated);
          }
          if (s.boss) {
            const boss = s.boss;
            if (!boss.entered) {
              boss.x -= BOSS_ENTRY_SPEED * dt;
              const targetX = BOARD_W * BOSS_HOVER_X_FRACTION;
              if (boss.x <= targetX) {
                boss.x = targetX;
                boss.entered = true;
                boss.vulnerableAt = now + BOSS_INTRO_GRACE_MS;
                boss.nextLaserAt = now + boss.laserInterval;
                boss.burstPhaseAt = now;
                if (boss.tier >= BOSS_PHASE_MIN_TIER) {
                  boss.nextPhaseAt = now + BOSS_PHASE_INTERVAL_MS;
                }
              }
            } else {
              boss.y =
                boss.baseY +
                Math.sin(((now - boss.spawnedAt) / 1000) * BOSS_BOB_SPEED) * BOSS_BOB_AMPLITUDE;
            }
            // Attacks stay gated on the intro grace deadline that also gates
            // damage, so immunity ending and it opening fire land on the
            // same frame.
            if (boss.entered && now >= boss.vulnerableAt) {
              // Invulnerability phase (tier 6+): everything else is on hold
              // while a rolled sequence of pattern attacks plays out. Only
              // started from a clean slate so a phase never cuts a volley
              // that's already mid-flight in half.
              if (
                !boss.phaseActive &&
                now >= boss.nextPhaseAt &&
                boss.laserState === "idle" &&
                boss.spiralState === "idle" &&
                boss.burstState === "pause"
              ) {
                boss.phaseActive = true;
                boss.phaseQueue = rollBossPhaseAttacks();
                startBossPhaseAttack(boss, ship, now);
              }

              if (boss.phaseActive) {
                const attack = boss.phaseQueue[0];
                let done = false;
                if (attack === "burst") done = stepBossBurst(s, boss, ship, now);
                else if (attack === "spiral") done = stepBossSpiral(s, boss, now, dt);
                else done = stepBossLaser(boss, ship, now);
                if (done) {
                  boss.phaseQueue.shift();
                  if (boss.phaseQueue.length > 0) {
                    startBossPhaseAttack(boss, ship, now);
                  } else {
                    boss.phaseActive = false;
                    boss.nextPhaseAt = now + BOSS_PHASE_INTERVAL_MS;
                    boss.burstState = "pause";
                    boss.burstPhaseAt = now;
                    boss.nextLaserAt = now + boss.laserInterval;
                  }
                }
              } else {
                // Gun slot: bursts by default, with the spiral rolled in as
                // an alternative from tier 2 on — see
                // bossSpiralChanceForTier. Only one of the two runs at a
                // time; the laser below is on its own parallel timer.
                if (boss.spiralState !== "idle") {
                  if (stepBossSpiral(s, boss, now, dt)) {
                    boss.burstState = "pause";
                    boss.burstPhaseAt = now;
                  }
                } else if (boss.burstState === "pause") {
                  if (now - boss.burstPhaseAt >= bossBurstPauseForTier(boss.tier)) {
                    if (Math.random() < bossSpiralChanceForTier(boss.tier)) {
                      startBossSpiral(boss, now);
                    } else {
                      startBossBurst(boss, now, true);
                    }
                  }
                } else if (stepBossBurst(s, boss, ship, now)) {
                  boss.burstState = "pause";
                  boss.burstPhaseAt = now;
                }

                if (boss.laserState === "idle") {
                  if (now >= boss.nextLaserAt) startBossLaser(boss, ship, now, "lockon");
                } else if (stepBossLaser(boss, ship, now)) {
                  boss.nextLaserAt = now + boss.laserInterval;
                }
              }
            }
          }
          for (const b of s.bossBullets) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
          }
          // Spiral bullets radiate in every direction, so culling only off
          // the left edge would leak them off the other three.
          s.bossBullets = s.bossBullets.filter(
            (b) => b.x > -20 && b.x < BOARD_W + 60 && b.y > -60 && b.y < BOARD_H + 60
          );
        }

        // Merchant: entering/idle/leaving runs independent of s.shopOpen so
        // the exit flythrough keeps playing after the shop UI is gone and
        // gameplay has already resumed.
        if (s.merchant && updateMerchant(s, s.merchant, now, dt)) {
          s.merchant = null;
        }

        // Powerups: move/expire first so bullet and ship collision checks
        // below see up-to-date positions. Centered mode drifts + wraps like
        // its asteroids; chase mode scrolls with the world + gets culled
        // off the left edge like its asteroids.
        if (chase) {
          for (const p of s.powerups) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
          }
          s.powerups = s.powerups.filter(
            (p) => p.x > -80 && now - p.bornAt < POWERUP_LIFETIME_MS
          );
        } else {
          for (const p of s.powerups) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            wrap(p, BOARD_W, BOARD_H);
          }
          s.powerups = s.powerups.filter((p) => now - p.bornAt < POWERUP_LIFETIME_MS);
        }

        // Bullet vs boss bullet: they trade off, one for one. Resolved
        // before anything else so a shot that got cancelled can't also
        // register a hit on the same frame.
        // Disabled for now — playtest found it trivializes boss fights.
        // Flip this back on once the boss side is tuned to expect it.
        if (false && s.bullets.length > 0 && s.bossBullets.length > 0) {
          const cancelledPlayer = new Set();
          const cancelledBoss = new Set();
          for (const b of s.bullets) {
            for (const bb of s.bossBullets) {
              if (cancelledBoss.has(bb)) continue;
              if (circlesCollide(b.x, b.y, 2, bb.x, bb.y, BOSS_BULLET_RADIUS)) {
                cancelledPlayer.add(b);
                cancelledBoss.add(bb);
                spawnParticles(s, (b.x + bb.x) / 2, (b.y + bb.y) / 2, "#ffd15e", 5);
                break;
              }
            }
          }
          if (cancelledPlayer.size > 0) {
            s.bullets = s.bullets.filter((b) => !cancelledPlayer.has(b));
            s.bossBullets = s.bossBullets.filter((b) => !cancelledBoss.has(b));
          }
        }

        // Bullet vs asteroid, and — since flying into a drifting pickup
        // proved fiddly — bullet vs powerup too, so shooting one collects it.
        const pierce = s.upgrades.pierce;
        const deadBullets = new Set();
        const deadAsteroids = new Set();
        const collectedPowerups = new Set();
        const spawned = [];
        for (const b of s.bullets) {
          if (deadBullets.has(b)) continue;
          for (const p of s.powerups) {
            if (collectedPowerups.has(p.id)) continue;
            if (circlesCollide(b.x, b.y, 2, p.x, p.y, POWERUP_RADIUS)) {
              deadBullets.add(b);
              collectedPowerups.add(p.id);
              spawnParticles(s, p.x, p.y, POWERUP_COLORS[p.type], 12);
              applyPowerupPickup(s, p.type, now, scoreMult);
              break;
            }
          }
          if (deadBullets.has(b)) continue;
          if (
            s.boss &&
            !s.boss.phaseActive &&
            now >= s.boss.vulnerableAt &&
            !(b.hitIds && b.hitIds.has("boss")) &&
            // Boss motion (bob) is slow enough to treat as stationary here —
            // it's the bullet's speed that gets extreme, not the boss's.
            sweptCirclesCollide(b.x, b.y, b.vx, b.vy, 2, s.boss.x, s.boss.y, 0, 0, BOSS_RADIUS, dt)
          ) {
            // A piercing bullet overlaps the boss for many frames, so it has
            // to remember it already scored — asteroids need no such
            // bookkeeping since a hit destroys them outright.
            if (pierce) (b.hitIds ??= new Set()).add("boss");
            else deadBullets.add(b);
            s.boss.health -= s.upgrades.bulletDamage;
            spawnParticles(s, b.x, b.y, "#ff5e5e", 6);
          }
          if (deadBullets.has(b)) continue;
          for (const a of s.asteroids) {
            if (deadAsteroids.has(a.id)) continue;
            const { radius, score: pts } = ASTEROID_SIZES[a.size];
            // Swept only in chase — centered-mode asteroids/bullets wrap
            // around the board edges, which would otherwise read as a
            // huge one-frame jump and produce bogus phantom collisions.
            // Chase never wraps (culled at the edges instead), and it's
            // the only mode where speed runs away far enough to tunnel.
            const collided = chase
              ? sweptCirclesCollide(b.x, b.y, b.vx, b.vy, 2, a.x, a.y, a.vx, a.vy, radius, dt)
              : circlesCollide(b.x, b.y, 2, a.x, a.y, radius);
            if (collided) {
              if (!pierce) deadBullets.add(b);
              deadAsteroids.add(a.id);
              // Chase mode's score is distance + boss bonuses only —
              // asteroids there are obstacles to clear, not points.
              if (!chase) s.score += pts * scoreMult;
              spawnParticles(s, a.x, a.y, "#c9c9e8");
              const dropChance =
                (now < s.powerupDropSuppressUntil
                  ? POWERUP_SUPPRESSED_DROP_CHANCE
                  : POWERUP_DROP_CHANCE) + s.dropChanceBonus;
              if (Math.random() < dropChance) {
                const type = chase
                  ? rollPowerupType("chase", s.chaseElapsed)
                  : rollPowerupType("centered", s.wave);
                s.powerups.push(makePowerup(s.nextId++, type, a.x, a.y, now));
              }
              const children = splitAsteroid(a, s.nextId);
              s.nextId += children.length;
              spawned.push(...children);
              if (!pierce) break;
            }
          }
        }
        if (deadBullets.size > 0) s.bullets = s.bullets.filter((b) => !deadBullets.has(b));
        if (deadAsteroids.size > 0) {
          s.asteroids = s.asteroids.filter((a) => !deadAsteroids.has(a.id));
        }
        if (spawned.length > 0) s.asteroids.push(...spawned);
        if (collectedPowerups.size > 0) {
          s.powerups = s.powerups.filter((p) => !collectedPowerups.has(p.id));
          setLives(s.lives);
        }
        let bossDefeated = false;
        if (s.boss && s.boss.health <= 0) {
          bossDefeated = true;
          s.score += BOSS_SCORE * scoreMult;
          // Guaranteed reward for the kill itself — unlike the random
          // extra_life powerup, this isn't capped at MAX_LIVES.
          s.lives += 1;
          spawnParticles(s, s.boss.x, s.boss.y, "#ff5e5e", 40);
          s.cores += coresForBossTier(s.boss.tier);
          s.boss = null;
          s.bossesDefeated += 1;
          s.nextBossAt = s.chaseElapsed + BOSS_INTERVAL_SECONDS;
          s.shopOpen = true;
          s.merchant = createMerchant(ship.x, ship.y, now);
          s.shopOffer = rollShopOffer(s.shopPurchaseCounts, s.bossesDefeated);
          s.shopRerollsLeft = SHOP_REROLLS;
          setLives(s.lives);
          setCores(s.cores);
          setShopOpen(true);
          setShopOffer(s.shopOffer);
          setShopRerollsLeft(s.shopRerollsLeft);
        }
        if (deadAsteroids.size > 0 || collectedPowerups.size > 0 || bossDefeated) setScore(s.score);

        // Ship vs asteroid, boss, and boss bullets. Untouchable while the
        // shop is open — the merchant's shield is the in-world reason, this
        // is the actual guarantee.
        updateDeflector(s, now);
        if (now >= ship.invulnUntil && now >= s.deflector.graceUntil && !s.shopOpen) {
          let hit = false;
          for (const a of s.asteroids) {
            const { radius } = ASTEROID_SIZES[a.size];
            // Same wrap caveat as the bullet-vs-asteroid check above —
            // swept only makes sense where nothing wraps mid-frame.
            const shipHit = chase
              ? sweptCirclesCollide(
                  ship.x,
                  ship.y,
                  ship.vx,
                  ship.vy,
                  SHIP_RADIUS * 0.8,
                  a.x,
                  a.y,
                  a.vx,
                  a.vy,
                  radius,
                  dt
                )
              : circlesCollide(ship.x, ship.y, SHIP_RADIUS * 0.8, a.x, a.y, radius);
            if (shipHit) {
              hit = true;
              break;
            }
          }
          if (!hit && s.boss && circlesCollide(ship.x, ship.y, SHIP_RADIUS * 0.8, s.boss.x, s.boss.y, BOSS_RADIUS)) {
            hit = true;
          }
          if (!hit) {
            for (const b of s.bossBullets) {
              // Boss bullets only exist in chase mode, which never wraps —
              // safe to always use the swept check here.
              if (
                sweptCirclesCollide(
                  ship.x,
                  ship.y,
                  ship.vx,
                  ship.vy,
                  SHIP_RADIUS * 0.8,
                  b.x,
                  b.y,
                  b.vx,
                  b.vy,
                  BOSS_BULLET_RADIUS,
                  dt
                )
              ) {
                hit = true;
                break;
              }
            }
          }
          if (!hit && s.boss && s.boss.laserState === "firing" && ship.x < s.boss.x) {
            hit = bossLaserBeamYs(s.boss).some(
              (beamY) => Math.abs(ship.y - beamY) < BOSS_LASER_HALF_WIDTH + SHIP_RADIUS * 0.8
            );
          }
          if (hit) {
            if (consumeDeflectorCharge(s, now)) {
              spawnParticles(s, ship.x, ship.y, POWERUP_COLORS.shield, 12);
            } else {
              spawnParticles(s, ship.x, ship.y, "#ff5e9c", 16);
              respawnShip();
            }
          }
        }

        // Merchant's shield vs asteroids — the "rocks bouncing off the
        // shield" part of the shop animation. No score/drops from these;
        // it's a scripted interlude, not real combat. Never drops for as
        // long as the shop is open (entering included); once it closes the
        // exit flythrough's own sweep takes over debris-clearing duty.
        if (s.shopOpen && s.merchant) {
          const shieldX = s.merchant.x + MERCHANT_SHIELD_OFFSET_X;
          const shieldY = s.merchant.y;
          const deadAtShield = new Set();
          for (const a of s.asteroids) {
            if (circlesCollide(a.x, a.y, ASTEROID_SIZES[a.size].radius, shieldX, shieldY, MERCHANT_SHIELD_RADIUS)) {
              deadAtShield.add(a.id);
              spawnParticles(s, a.x, a.y, "#5ec8ff", 8);
            }
          }
          if (deadAtShield.size > 0) {
            s.asteroids = s.asteroids.filter((a) => !deadAtShield.has(a.id));
          }
        }

        // Ship vs powerup (still collectible by touch, not just by shooting).
        {
          let collectedId = null;
          for (const p of s.powerups) {
            if (circlesCollide(ship.x, ship.y, SHIP_RADIUS * 0.8, p.x, p.y, POWERUP_RADIUS)) {
              spawnParticles(s, p.x, p.y, POWERUP_COLORS[p.type], 12);
              applyPowerupPickup(s, p.type, now, scoreMult);
              collectedId = p.id;
              break;
            }
          }
          if (collectedId !== null) {
            s.powerups = s.powerups.filter((p) => p.id !== collectedId);
            setLives(s.lives);
            setScore(s.score);
          }
        }

        s.powerupUiAccum += dt * 1000;
        if (s.powerupUiAccum > 150) {
          s.powerupUiAccum = 0;
          setActivePowerupsUi(
            Object.entries(s.activePowerups).map(([type, expiresAt]) => ({
              type,
              remaining: Math.max(0, Math.ceil((expiresAt - now) / 1000)),
            }))
          );
        }

        // Particles.
        for (const p of s.particles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt * 1000;
        }
        s.particles = s.particles.filter((p) => p.life > 0);

        // Wave clear (centered mode only — chase spawns continuously).
        if (!chase && s.asteroids.length === 0 && s.running) {
          s.wave += 1;
          spawnWave(s, s.wave);
          setWave(s.wave);
        }
      } else {
        s.lastTime = time;
      }
      draw();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [draw, respawnShip]);

  // Initial paint.
  useEffect(() => {
    draw();
  }, [draw]);

  // Keyboard controls — held keys drive continuous rotation/thrust/fire in
  // the animation loop, rather than one-shot moves like Tetris/Typewriter.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          setDirectionKey("left", true);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          setDirectionKey("right", true);
          break;
        case "ArrowUp":
        case "w":
        case "W":
          setDirectionKey("up", true);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          setDirectionKey("down", true);
          break;
        case " ":
          keysRef.current.fire = true;
          break;
        case "Escape":
          togglePause();
          break;
        default:
          break;
      }
    };
    const onKeyUp = (e) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          setDirectionKey("left", false);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          setDirectionKey("right", false);
          break;
        case "ArrowUp":
        case "w":
        case "W":
          setDirectionKey("up", false);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          setDirectionKey("down", false);
          break;
        case " ":
          keysRef.current.fire = false;
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [togglePause, setDirectionKey]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full flex-row flex-wrap items-start justify-center gap-4">
        <div className="flex flex-col items-center gap-3">
          {/* Outer box stays unrotated, sized to whatever the rotated
              canvas's footprint is (dimensions swap at 90/270) — the menu
              text and buttons live here, upright, filling that footprint.
              Only the canvas inside gets the rotation transform: rotating
              is about reorienting the *game view* for a comfortable
              physical setup, not making the player tilt their head to
              read a menu. */}
          <div
            className="relative"
            style={{
              width: rotatedSideways ? boardRenderH : boardRenderW,
              height: rotatedSideways ? boardRenderW : boardRenderH,
              maxWidth: "100%",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                width: boardRenderW,
                height: boardRenderH,
                transform: canvasTransform,
                transformOrigin: "top left",
              }}
            >
              <canvas
                ref={canvasRef}
                width={BOARD_W}
                height={BOARD_H}
                className="h-full w-full rounded-lg bg-black/40 ring-1 ring-white/10"
              />
            </div>
            {(!started || gameOver || paused) && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/70 p-3 text-center">
                {paused && !gameOver ? (
                  <>
                    <p className="font-heading text-2xl text-white">Paused</p>
                    <button
                      onClick={togglePause}
                      className="pointer-events-auto rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
                    >
                      Resume
                    </button>
                  </>
                ) : gameOver ? (
                  <>
                    <p className="font-heading text-2xl text-white">Game over</p>
                    <p className="text-sm text-white/70">Score: {score}</p>

                    {submitState === "submitted" ? (
                      <p className="text-sm text-emerald-300">
                        Score submitted!
                      </p>
                    ) : (
                      <div className="pointer-events-auto flex flex-col items-center gap-2">
                        {loggedIn ? (
                          <p className="text-xs text-white/60">
                            Submitting as{" "}
                            <span className="text-white">{username}</span> —
                            only updates if it beats your best.
                          </p>
                        ) : (
                          <>
                            <p className="max-w-[12rem] text-center text-xs text-white/50">
                              Log in to save this to an account, or submit as a
                              guest below.
                            </p>
                            <button
                              type="button"
                              onClick={() => setAuthModalOpen(true)}
                              className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
                            >
                              Log in
                            </button>
                            <div className="my-1 text-[0.65rem] uppercase tracking-wide text-white/30">
                              or continue as guest
                            </div>
                            <input
                              type="text"
                              value={playerName}
                              onChange={(e) => setPlayerName(e.target.value)}
                              placeholder="Name"
                              maxLength={16}
                              className="w-32 rounded-full bg-white/10 px-3 py-1 text-center text-sm text-white ring-1 ring-white/20 placeholder:text-white/40 focus:outline-none"
                            />
                          </>
                        )}
                        <button
                          onClick={submitScore}
                          disabled={
                            submitState === "submitting" ||
                            (!loggedIn && !playerName.trim())
                          }
                          className="rounded-full bg-[#ff5e9c]/20 px-4 py-1.5 text-sm font-medium text-white ring-1 ring-[#ff5e9c]/40 backdrop-blur-sm transition-colors hover:bg-[#ff5e9c]/30 disabled:opacity-40"
                        >
                          {submitState === "submitting"
                            ? "Submitting..."
                            : "Submit score"}
                        </button>
                        {submitState === "error" && (
                          <p className="max-w-[10rem] text-xs text-red-300">
                            {submitError}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="pointer-events-auto flex items-center gap-3">
                      <button
                        onClick={() => startGame(mode)}
                        className="rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
                      >
                        Restart
                      </button>
                      <button
                        onClick={backToModeSelect}
                        className="text-xs text-white/50 underline underline-offset-2 hover:text-white/80"
                      >
                        Change mode
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-heading text-2xl text-white">Choose a mode</p>
                    <div className="pointer-events-auto flex gap-3">
                      <button
                        onClick={() => startGame("centered")}
                        className="rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
                      >
                        Classic
                      </button>
                      <button
                        onClick={() => startGame("chase")}
                        className="rounded-full bg-[#ff5e9c]/20 px-5 py-2 font-medium text-white ring-1 ring-[#ff5e9c]/40 backdrop-blur-sm transition-colors hover:bg-[#ff5e9c]/30"
                      >
                        Chase
                      </button>
                    </div>
                    <p className="max-w-[16rem] text-xs text-white/40">
                      Classic: drift in an open arena that wraps at the
                      edges. Chase: endless rightward flight, one life —
                      dodge or shoot what&apos;s in your way.
                    </p>
                  </>
                )}
              </div>
            )}

            {shopOpen && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 rounded-b-lg bg-black/80 p-3">
                <p className="font-heading text-lg text-white">
                  Trader — <span className="text-[#ffd15e]">{cores}</span> cores
                </p>
                <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
                  {shopOffer.map((key) => {
                    const item = SHOP_ITEMS[key];
                    const bought = shopPurchaseCounts[key] || 0;
                    const max = SHOP_ITEM_MAX_PURCHASES[key];
                    const maxed = max !== undefined && bought >= max;
                    const cost = shopItemCost(key, bought);
                    return (
                      <button
                        key={key}
                        onClick={() => buyItem(key)}
                        disabled={maxed || cores < cost}
                        className="flex w-28 flex-col items-center gap-0.5 rounded-lg bg-white/10 px-2 py-2 text-center text-xs text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-40"
                      >
                        <span className="font-medium">{item.label}</span>
                        <span className="text-white/60">{item.desc}</span>
                        <span className="font-heading text-[#ffd15e]">
                          {maxed ? (max === 1 ? "Owned" : "Maxed") : cost}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={rerollShop}
                  disabled={shopRerollsLeft <= 0 || cores < SHOP_REROLL_COST}
                  className="pointer-events-auto rounded-full bg-white/10 px-4 py-1 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-40"
                >
                  Reroll ({SHOP_REROLL_COST} core) — {shopRerollsLeft} left
                </button>
                <button
                  onClick={closeShop}
                  className="pointer-events-auto rounded-full bg-[#ff5e9c]/20 px-5 py-1.5 text-sm font-medium text-white ring-1 ring-[#ff5e9c]/40 backdrop-blur-sm transition-colors hover:bg-[#ff5e9c]/30"
                >
                  Continue
                </button>
              </div>
            )}
          </div>

          {/* One row: phone-only powerup status + pause (hidden at sm+,
              where the sidebar carries them instead so they don't show
              twice) sit beside Rotate view, which stays visible at every
              size. Side by side rather than stacked — stacking pushed the
              controls hint/D-pad down by a lot on phones. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {activePowerupsUi.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 sm:hidden">
                {activePowerupsUi.map((p) => (
                  <div key={p.type} className="flex items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/games/asteroids/powerups/${p.type}.png`}
                      alt=""
                      className="h-6 w-6"
                    />
                    <span className="font-heading text-sm text-white">
                      {p.remaining}s
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={togglePause}
              disabled={!started || gameOver}
              className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-40 sm:hidden"
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              onClick={() => setCanvasRotation((r) => (r + 90) % 360)}
              className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              ⟳ Rotate view
            </button>
          </div>

          <p className="text-xs text-white/40">
            {mode === "chase"
              ? "arrows / WASD move · space fire · Esc pause. One life."
              : "← → / A D rotate · ↑ / W thrust · ↓ / S brake · space fire · Esc pause."}
          </p>

          {/* Touch controls, phones/small screens only. Same keysRef flags
              as keyboard input, so they drive rotation+thrust+brake in
              Classic and direct movement in Chase automatically — no
              mode-specific button set needed. */}
          <div className="mx-auto flex w-full max-w-xs shrink-0 items-center justify-between gap-8 sm:hidden">
            <div className="grid shrink-0 grid-cols-3 grid-rows-3 gap-1.5">
              <button
                onPointerDown={() => setDirectionKey("up", true)}
                onPointerUp={() => setDirectionKey("up", false)}
                onPointerLeave={() => setDirectionKey("up", false)}
                onPointerCancel={() => setDirectionKey("up", false)}
                aria-label={mode === "chase" ? "Move up" : "Thrust"}
                className="col-start-2 row-start-1 h-12 w-12 touch-manipulation select-none rounded-full bg-white/10 text-xl text-white ring-1 ring-white/15 backdrop-blur-sm active:bg-white/25"
              >
                ▲
              </button>
              <button
                onPointerDown={() => setDirectionKey("left", true)}
                onPointerUp={() => setDirectionKey("left", false)}
                onPointerLeave={() => setDirectionKey("left", false)}
                onPointerCancel={() => setDirectionKey("left", false)}
                aria-label={mode === "chase" ? "Move left" : "Rotate left"}
                className="col-start-1 row-start-2 h-12 w-12 touch-manipulation select-none rounded-full bg-white/10 text-xl text-white ring-1 ring-white/15 backdrop-blur-sm active:bg-white/25"
              >
                ◀
              </button>
              <button
                onPointerDown={() => setDirectionKey("right", true)}
                onPointerUp={() => setDirectionKey("right", false)}
                onPointerLeave={() => setDirectionKey("right", false)}
                onPointerCancel={() => setDirectionKey("right", false)}
                aria-label={mode === "chase" ? "Move right" : "Rotate right"}
                className="col-start-3 row-start-2 h-12 w-12 touch-manipulation select-none rounded-full bg-white/10 text-xl text-white ring-1 ring-white/15 backdrop-blur-sm active:bg-white/25"
              >
                ▶
              </button>
              <button
                onPointerDown={() => setDirectionKey("down", true)}
                onPointerUp={() => setDirectionKey("down", false)}
                onPointerLeave={() => setDirectionKey("down", false)}
                onPointerCancel={() => setDirectionKey("down", false)}
                aria-label={mode === "chase" ? "Move down" : "Brake"}
                className="col-start-2 row-start-3 h-12 w-12 touch-manipulation select-none rounded-full bg-white/10 text-xl text-white ring-1 ring-white/15 backdrop-blur-sm active:bg-white/25"
              >
                ▼
              </button>
            </div>

            <button
              onPointerDown={() => (keysRef.current.fire = true)}
              onPointerUp={() => (keysRef.current.fire = false)}
              onPointerLeave={() => (keysRef.current.fire = false)}
              onPointerCancel={() => (keysRef.current.fire = false)}
              aria-label="Fire"
              className="h-16 w-16 shrink-0 touch-manipulation select-none rounded-full bg-[#ff5e9c]/15 text-sm font-medium text-white ring-1 ring-[#ff5e9c]/40 backdrop-blur-sm active:bg-[#ff5e9c]/30"
            >
              Fire
            </button>
          </div>
        </div>

        <div className="flex w-32 flex-col gap-4 font-body text-white/80 sm:w-40">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">
              Score
            </div>
            <div className="font-heading text-xl text-white">{score}</div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">
              {mode === "chase" ? "Distance" : "Wave"}
            </div>
            <div className="font-heading text-xl text-white">
              {mode === "chase" ? distance : wave}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">
              Lives
            </div>
            <div className="font-heading text-xl text-white">
              {"♥".repeat(Math.max(0, lives)) || "—"}
            </div>
          </div>

          {activePowerupsUi.length > 0 && (
            <div className="hidden sm:block">
              <div className="text-xs uppercase tracking-wide text-white/40">
                Powerups
              </div>
              <div className="flex flex-wrap gap-2">
                {activePowerupsUi.map((p) => (
                  <div key={p.type} className="flex items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/games/asteroids/powerups/${p.type}.png`}
                      alt=""
                      className="h-6 w-6"
                    />
                    <span className="font-heading text-sm text-white">
                      {p.remaining}s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={togglePause}
            disabled={!started || gameOver}
            className="hidden rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-40 sm:block"
          >
            {paused ? "Resume" : "Pause"}
          </button>

          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/40">
              <label htmlFor="asteroids-size">Board size</label>
              <button
                onClick={() => {
                  manualBoardSizeRef.current = false;
                  applyBoardFit();
                }}
                className="normal-case text-white/50 underline underline-offset-2 hover:text-white/80"
              >
                Default
              </button>
            </div>
            <input
              id="asteroids-size"
              type="range"
              min={MIN_BOARD_RENDER_W}
              max={BOARD_W}
              value={boardRenderW}
              onChange={(e) => {
                manualBoardSizeRef.current = true;
                setBoardRenderW(Number(e.target.value));
              }}
              className="mt-1 w-full accent-[#ff5e9c]"
            />
          </div>

          <div>
            <Link
              href={`/games/leaderboard?game=${mode === "chase" ? "asteroids-chase" : "asteroids-classic"}`}
              className="text-xs uppercase tracking-wide text-white/40 underline underline-offset-2 hover:text-white/70"
            >
              Leaderboard
            </Link>
            <p className="text-[0.65rem] text-white/30">
              Can take up to a minute to update.
            </p>
            {leaderboard.length === 0 ? (
              <p className="mt-1 text-xs text-white/40">No scores yet.</p>
            ) : (
              <ol className="mt-1 flex flex-col gap-0.5 text-sm text-white/80">
                {leaderboard.map((entry, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      <span className="truncate">
                        {i + 1}. {entry.name}
                      </span>
                      {entry.guest && (
                        <span title="Guest account" className="shrink-0">
                          <GuestIcon className="h-3 w-3 text-white/40" />
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-heading text-white">
                      {entry.score}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
