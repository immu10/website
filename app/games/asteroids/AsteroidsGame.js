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
  CHASE_INITIAL_LIVES,
  CHASE_VERTICAL_ACCEL,
  CHASE_MAX_VERTICAL_SPEED,
  CHASE_DRAG,
  CHASE_DISTANCE_SCORE_PER_PX,
  chaseScrollSpeedForDistance,
  chaseSpawnIntervalForDistance,
  chaseSpawnAsteroid,
  chaseBulletSpeedForDistance,
  chaseFireCooldownForDistance,
} from "./asteroidsEngine";
import { useAuth } from "@/app/games/AuthContext";
import GuestIcon from "@/app/games/GuestIcon";

const SPRITE_SRC = {
  ship: "/games/asteroids/ship.png",
  detailed: "/games/asteroids/meteor_detailed_large.png",
  square: "/games/asteroids/meteor_square_large.png",
};

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
    stars: createStars(),
    nextId: 1,
    wave: 0,
    distance: 0,
    distanceScore: 0,
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

function updateCenteredShip(s, dt, keys) {
  const ship = s.ship;
  if (keys.left) ship.angle -= ROTATION_SPEED * dt;
  if (keys.right) ship.angle += ROTATION_SPEED * dt;
  if (keys.up) {
    ship.vx += Math.sin(ship.angle) * THRUST_ACCEL * dt;
    ship.vy += -Math.cos(ship.angle) * THRUST_ACCEL * dt;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > MAX_SPEED) {
      ship.vx = (ship.vx / speed) * MAX_SPEED;
      ship.vy = (ship.vy / speed) * MAX_SPEED;
    }
  }
  ship.vx *= 1 - DRAG * dt;
  ship.vy *= 1 - DRAG * dt;
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  wrap(ship, BOARD_W, BOARD_H);
}

function updateChaseShip(s, dt, keys) {
  const ship = s.ship;
  if (keys.up) ship.vy -= CHASE_VERTICAL_ACCEL * dt;
  if (keys.down) ship.vy += CHASE_VERTICAL_ACCEL * dt;
  if (ship.vy > CHASE_MAX_VERTICAL_SPEED) ship.vy = CHASE_MAX_VERTICAL_SPEED;
  if (ship.vy < -CHASE_MAX_VERTICAL_SPEED) ship.vy = -CHASE_MAX_VERTICAL_SPEED;
  ship.vy *= 1 - CHASE_DRAG * dt;
  ship.y += ship.vy * dt;
  const margin = SHIP_RADIUS;
  if (ship.y < margin) {
    ship.y = margin;
    ship.vy = 0;
  } else if (ship.y > BOARD_H - margin) {
    ship.y = BOARD_H - margin;
    ship.vy = 0;
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
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  // Leaderboard: sessionTokenRef is minted fresh per game (see startGame),
  // same anti-cheat approach as Tetris/Typewriter — see
  // /api/games/asteroids/score for why.
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
    fetch("/api/games/asteroids/leaderboard")
      .then((res) => res.json())
      .then((data) => setLeaderboard(data.entries ?? []))
      .catch(() => {});
  }, []);

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
      const res = await fetch("/api/games/asteroids/score", {
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
  }, [playerName, fetchLeaderboard]);

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

    if (s.started && !(s.gameOver && s.lives <= 0)) {
      const invuln = performance.now() < s.ship.invulnUntil;
      // Blink while invulnerable so a fresh respawn is visibly telegraphed.
      if (!invuln || Math.floor(performance.now() / 100) % 2 === 0) {
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
    if (s.lives <= 0) {
      endGame();
      return;
    }
    s.ship = s.mode === "chase" ? createChaseShip() : createCenteredShip();
    s.ship.invulnUntil = performance.now() + RESPAWN_INVULN_MS;
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
        s.scrollSpeed = chaseScrollSpeedForDistance(0);
        s.spawnInterval = chaseSpawnIntervalForDistance(0);
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
      setGameOver(false);
      setPaused(false);
      setStarted(true);
      setSubmitState("idle");
      setSubmitError("");

      sessionTokenRef.current = null;
      fetch("/api/games/asteroids/session", { method: "POST" })
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
        const now = time;
        const keys = keysRef.current;
        const ship = s.ship;
        const chase = s.mode === "chase";

        if (chase) updateChaseShip(s, dt, keys);
        else updateCenteredShip(s, dt, keys);

        const fireCooldown = chase
          ? chaseFireCooldownForDistance(s.distance)
          : FIRE_COOLDOWN_MS;
        const bulletSpeed = chase
          ? chaseBulletSpeedForDistance(s.distance)
          : BULLET_SPEED;
        if (keys.fire && now - s.lastFireTime > fireCooldown) {
          s.lastFireTime = now;
          const nose = {
            x: ship.x + Math.sin(ship.angle) * SHIP_RADIUS,
            y: ship.y - Math.cos(ship.angle) * SHIP_RADIUS,
          };
          s.bullets.push({
            x: nose.x,
            y: nose.y,
            vx: Math.sin(ship.angle) * bulletSpeed,
            vy: -Math.cos(ship.angle) * bulletSpeed,
            bornAt: now,
          });
        }

        s.bullets = s.bullets.filter((b) => now - b.bornAt < BULLET_LIFETIME_MS);
        for (const b of s.bullets) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (!chase) wrap(b, BOARD_W, BOARD_H);
        }

        if (chase) {
          s.distance += s.scrollSpeed * dt;
          s.scrollSpeed = chaseScrollSpeedForDistance(s.distance);
          s.spawnInterval = chaseSpawnIntervalForDistance(s.distance);

          s.spawnAccum += dt * 1000;
          if (s.spawnAccum > s.spawnInterval) {
            s.spawnAccum = 0;
            s.asteroids.push(chaseSpawnAsteroid(s.nextId++, s.distance));
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

          const newDistanceScore = Math.floor(s.distance * CHASE_DISTANCE_SCORE_PER_PX);
          if (newDistanceScore > s.distanceScore) {
            s.score += newDistanceScore - s.distanceScore;
            s.distanceScore = newDistanceScore;
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

        // Bullet vs asteroid.
        const deadBullets = new Set();
        const deadAsteroids = new Set();
        const spawned = [];
        for (const b of s.bullets) {
          if (deadBullets.has(b)) continue;
          for (const a of s.asteroids) {
            if (deadAsteroids.has(a.id)) continue;
            const { radius, score: pts } = ASTEROID_SIZES[a.size];
            if (circlesCollide(b.x, b.y, 2, a.x, a.y, radius)) {
              deadBullets.add(b);
              deadAsteroids.add(a.id);
              s.score += pts;
              spawnParticles(s, a.x, a.y, "#c9c9e8");
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
          setScore(s.score);
        }
        if (spawned.length > 0) s.asteroids.push(...spawned);

        // Ship vs asteroid.
        if (now >= ship.invulnUntil) {
          for (const a of s.asteroids) {
            const { radius } = ASTEROID_SIZES[a.size];
            if (circlesCollide(ship.x, ship.y, SHIP_RADIUS * 0.8, a.x, a.y, radius)) {
              spawnParticles(s, ship.x, ship.y, "#ff5e9c", 16);
              respawnShip();
              break;
            }
          }
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
          keysRef.current.left = true;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          keysRef.current.right = true;
          break;
        case "ArrowUp":
        case "w":
        case "W":
          keysRef.current.up = true;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          keysRef.current.down = true;
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
          keysRef.current.left = false;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          keysRef.current.right = false;
          break;
        case "ArrowUp":
        case "w":
        case "W":
          keysRef.current.up = false;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          keysRef.current.down = false;
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
  }, [togglePause]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full flex-row flex-wrap items-start justify-center gap-4">
        <div className="flex flex-col items-center gap-3">
          <div className="relative" style={{ width: BOARD_W, maxWidth: "100%" }}>
            <canvas
              ref={canvasRef}
              width={BOARD_W}
              height={BOARD_H}
              className="w-full rounded-lg bg-black/40 ring-1 ring-white/10"
              style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}` }}
            />
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
                        Centered
                      </button>
                      <button
                        onClick={() => startGame("chase")}
                        className="rounded-full bg-[#ff5e9c]/20 px-5 py-2 font-medium text-white ring-1 ring-[#ff5e9c]/40 backdrop-blur-sm transition-colors hover:bg-[#ff5e9c]/30"
                      >
                        Chase
                      </button>
                    </div>
                    <p className="max-w-[16rem] text-xs text-white/40">
                      Centered: drift in an open arena that wraps at the
                      edges. Chase: endless rightward flight, one life —
                      dodge or shoot what&apos;s in your way.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-white/40">
            {mode === "chase"
              ? "↑ ↓ / W S move · space fire · Esc pause. One life."
              : "← → / A D rotate · ↑ / W thrust · space fire · Esc pause."}
          </p>
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

          <button
            onClick={togglePause}
            disabled={!started || gameOver}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            {paused ? "Resume" : "Pause"}
          </button>

          <div>
            <Link
              href="/games/leaderboard?game=asteroids"
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
