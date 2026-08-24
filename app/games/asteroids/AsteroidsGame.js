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
  HEAT_MAX,
  HEAT_GAIN_PER_SECOND,
  HEAT_COOL_RATE,
  OVERHEAT_LOCKOUT_MS,
  coresForBossTier,
  SHOP_ITEMS,
  shopItemCost,
  MERCHANT_OFFSET_X,
  MERCHANT_SHIELD_OFFSET_X,
  MERCHANT_SHIELD_RADIUS,
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
    heatMaxBonus: 0,
    coolRateBonusPct: 0,
    dropChanceBonus: 0,
    lockoutReductionPct: 0,
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

    ctx.fillStyle = "#ff5e9c";
    for (const b of s.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

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
      const invulnerable = nowMs < boss.vulnerableAt;
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
      if (boss.laserState === "charging") {
        const progress = Math.min(1, (nowMs - boss.laserPhaseAt) / BOSS_LASER_CHARGE_MS);
        // Grows from a thin flicker to a solid line as the charge fills, so
        // the last moment before firing reads as "about to go off."
        ctx.strokeStyle = `rgba(255,94,94,${0.25 + progress * 0.5})`;
        ctx.lineWidth = 1 + progress * 3;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -nowMs / 20;
        ctx.beginPath();
        ctx.moveTo(0, boss.laserY);
        ctx.lineTo(boss.x - BOSS_RADIUS, boss.laserY);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (boss.laserState === "firing") {
        ctx.fillStyle = "rgba(255,94,94,0.35)";
        ctx.fillRect(0, boss.laserY - BOSS_LASER_HALF_WIDTH - 4, boss.x - BOSS_RADIUS, BOSS_LASER_HALF_WIDTH * 2 + 8);
        ctx.fillStyle = "#ff5e5e";
        ctx.fillRect(0, boss.laserY - BOSS_LASER_HALF_WIDTH, boss.x - BOSS_RADIUS, BOSS_LASER_HALF_WIDTH * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(0, boss.laserY - 2, boss.x - BOSS_RADIUS, 4);
      }

      drawSprite(ctx, "boss", boss.x, boss.y, BOSS_RADIUS * 2.3, boss.rotation);

      const barW = BOSS_RADIUS * 2;
      const barX = boss.x - BOSS_RADIUS;
      const barY = boss.y - BOSS_RADIUS - 16;
      const pct = Math.max(0, boss.health / boss.maxHealth);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(barX, barY, barW, 6);
      ctx.fillStyle = invulnerable ? "#5ec8ff" : "#ff5e5e";
      ctx.fillRect(barX, barY, barW * pct, 6);
    }

    // Merchant + shield during the shop interlude — gold glow (distinct
    // from the boss's blue/red) so it doesn't read as another hazard, and
    // a shield dome facing the oncoming rocks it's blocking.
    if (s.shopOpen && s.merchant) {
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
    // saved you — losing a life resets the slate.
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
    const cost = shopItemCost(key, bought);
    if (s.cores < cost) return;
    s.cores -= cost;
    s.shopPurchaseCounts[key] = bought + 1;
    if (key === "heat_capacity") s.heatMaxBonus += 15;
    else if (key === "coolant_boost") s.coolRateBonusPct += 0.25;
    else if (key === "extra_life") s.lives += 1;
    else if (key === "lucky_scavenger") s.dropChanceBonus += 0.03;
    else if (key === "shorter_overheat") s.lockoutReductionPct += 0.15;
    setCores(s.cores);
    setShopPurchaseCounts({ ...s.shopPurchaseCounts });
    if (key === "extra_life") setLives(s.lives);
  }, []);

  const closeShop = useCallback(() => {
    const s = stateRef.current;
    s.shopOpen = false;
    s.merchant = null;
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
        const shielded = "shield" in s.activePowerups;
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
          s.heat = Math.min(effectiveHeatMax, s.heat + HEAT_GAIN_PER_SECOND * dt);
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
          for (const offset of spreadOffsets) {
            const angle = ship.angle + offset;
            s.bullets.push({
              x: nose.x,
              y: nose.y,
              vx: Math.sin(angle) * bulletSpeed,
              vy: -Math.cos(angle) * bulletSpeed,
              bornAt: now,
            });
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
              }
            } else {
              boss.y =
                boss.baseY +
                Math.sin(((now - boss.spawnedAt) / 1000) * BOSS_BOB_SPEED) * BOSS_BOB_AMPLITUDE;
              if (now - boss.lastFireTime > boss.fireInterval && now >= boss.vulnerableAt) {
                boss.lastFireTime = now;
                // Aimed at wherever the ship is right now (not tracked or
                // led afterward), so standing still is a guaranteed hit and
                // moving after it fires is a guaranteed dodge.
                const muzzleX = boss.x - BOSS_RADIUS;
                const dx = ship.x - muzzleX;
                const dy = ship.y - boss.y;
                const dist = Math.hypot(dx, dy) || 1;
                s.bossBullets.push({
                  x: muzzleX,
                  y: boss.y,
                  vx: (dx / dist) * boss.bulletSpeed,
                  vy: (dy / dist) * boss.bulletSpeed,
                  bornAt: now,
                });
              }

              // Laser volleys: the first beam charges slow (a fair warning),
              // but a beam beyond the first in the same volley re-locks
              // onto the ship's current spot and charges much faster — see
              // bossLaserBeamsForTier for how many beams a volley has.
              if (boss.laserState === "idle") {
                if (now >= boss.nextLaserAt && now >= boss.vulnerableAt) {
                  boss.laserState = "charging";
                  boss.laserY = ship.y;
                  boss.laserPhaseAt = now;
                  boss.laserBeamsRemaining = boss.laserBeamsTotal;
                }
              } else if (boss.laserState === "charging") {
                const chargeMs =
                  boss.laserBeamsRemaining === boss.laserBeamsTotal
                    ? BOSS_LASER_CHARGE_MS
                    : BOSS_LASER_RECHARGE_MS;
                if (now - boss.laserPhaseAt >= chargeMs) {
                  boss.laserState = "firing";
                  boss.laserPhaseAt = now;
                }
              } else if (boss.laserState === "firing") {
                if (now - boss.laserPhaseAt >= BOSS_LASER_ACTIVE_MS) {
                  boss.laserBeamsRemaining -= 1;
                  if (boss.laserBeamsRemaining > 0) {
                    boss.laserState = "charging";
                    boss.laserY = ship.y;
                    boss.laserPhaseAt = now;
                  } else {
                    boss.laserState = "idle";
                    boss.nextLaserAt = now + boss.laserInterval;
                  }
                }
              }
            }
          }
          for (const b of s.bossBullets) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
          }
          s.bossBullets = s.bossBullets.filter((b) => b.x > -20);
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

        // Bullet vs asteroid, and — since flying into a drifting pickup
        // proved fiddly — bullet vs powerup too, so shooting one collects it.
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
            now >= s.boss.vulnerableAt &&
            circlesCollide(b.x, b.y, 2, s.boss.x, s.boss.y, BOSS_RADIUS)
          ) {
            deadBullets.add(b);
            s.boss.health -= 1;
            spawnParticles(s, b.x, b.y, "#ff5e5e", 6);
          }
          if (deadBullets.has(b)) continue;
          for (const a of s.asteroids) {
            if (deadAsteroids.has(a.id)) continue;
            const { radius, score: pts } = ASTEROID_SIZES[a.size];
            if (circlesCollide(b.x, b.y, 2, a.x, a.y, radius)) {
              deadBullets.add(b);
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
              break;
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
          s.merchant = { x: ship.x + MERCHANT_OFFSET_X, y: ship.y };
          setLives(s.lives);
          setCores(s.cores);
          setShopOpen(true);
        }
        if (deadAsteroids.size > 0 || collectedPowerups.size > 0 || bossDefeated) setScore(s.score);

        // Ship vs asteroid, boss, and boss bullets. Untouchable while the
        // shop is open — the merchant's shield is the in-world reason, this
        // is the actual guarantee.
        if (now >= ship.invulnUntil && !shielded && !s.shopOpen) {
          let hit = false;
          for (const a of s.asteroids) {
            const { radius } = ASTEROID_SIZES[a.size];
            if (circlesCollide(ship.x, ship.y, SHIP_RADIUS * 0.8, a.x, a.y, radius)) {
              hit = true;
              break;
            }
          }
          if (!hit && s.boss && circlesCollide(ship.x, ship.y, SHIP_RADIUS * 0.8, s.boss.x, s.boss.y, BOSS_RADIUS)) {
            hit = true;
          }
          if (!hit) {
            for (const b of s.bossBullets) {
              if (circlesCollide(ship.x, ship.y, SHIP_RADIUS * 0.8, b.x, b.y, BOSS_BULLET_RADIUS)) {
                hit = true;
                break;
              }
            }
          }
          if (
            !hit &&
            s.boss &&
            s.boss.laserState === "firing" &&
            ship.x < s.boss.x &&
            Math.abs(ship.y - s.boss.laserY) < BOSS_LASER_HALF_WIDTH + SHIP_RADIUS * 0.8
          ) {
            hit = true;
          }
          if (hit) {
            spawnParticles(s, ship.x, ship.y, "#ff5e9c", 16);
            respawnShip();
          }
        }

        // Merchant's shield vs asteroids — the "rocks bouncing off the
        // shield" part of the shop animation. No score/drops from these;
        // it's a scripted interlude, not real combat.
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
                  {Object.entries(SHOP_ITEMS).map(([key, item]) => {
                    const bought = shopPurchaseCounts[key] || 0;
                    const cost = shopItemCost(key, bought);
                    return (
                      <button
                        key={key}
                        onClick={() => buyItem(key)}
                        disabled={cores < cost}
                        className="flex w-28 flex-col items-center gap-0.5 rounded-lg bg-white/10 px-2 py-2 text-center text-xs text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-40"
                      >
                        <span className="font-medium">{item.label}</span>
                        <span className="text-white/60">{item.desc}</span>
                        <span className="font-heading text-[#ffd15e]">{cost}</span>
                      </button>
                    );
                  })}
                </div>
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
