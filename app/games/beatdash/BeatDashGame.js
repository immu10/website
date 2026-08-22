"use client";

// Basic demo of the second, separate idea: a ground-based jump runner
// (Dino Run / Geometry Dash style) instead of the free-flight up/down
// runner in ../musicrunner. Single jump key, real gravity arc, obstacles
// sit on the ground. Same procedural-from-the-track approach as the other
// game (see ../audioAnalysis.js) — the gaps between obstacles are the
// "flat segments" naturally, since no obstacle just means open ground.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectOnsets,
  estimateTempo,
  computeEnergyEnvelope,
  generateGroundObstacles,
  estimateMaxClearWidth,
  generateBeatGrid,
  estimatePhaseOffset,
} from "../audioAnalysis";

const AUDIO_URL = "/audio/relativity-1000handz.mp3";
const SEED = 1234; // fixed for now — rotating seeds are a later feature

const CANVAS_W = 700;
const CANVAS_H = 300;
const GROUND_Y = CANVAS_H - 40;
const PLAYER_X = 100;
const PLAYER_SIZE = 26;
const SCROLL_SPEED = 260; // px/sec, drives obstacle screen position from audio.currentTime

const JUMP_VELOCITY = -480;
const GRAVITY = 1400; // px/sec^2, real arc-based jump
const MAX_JUMPS = 2; // double jump
const BLOCK_HEIGHT = 36; // obstacle height — shared by rendering, collision, and clear-width math

// Bot timing constants, derived from the same physics as the game itself —
// not tuned separately, so the bot stays correct if the jump constants
// above ever change.
const APEX_TIME = Math.abs(JUMP_VELOCITY) / GRAVITY; // time from jump to peak height
const SINGLE_JUMP_CLEAR_WIDTH = estimateMaxClearWidth({
  jumpVelocity: JUMP_VELOCITY,
  gravity: GRAVITY,
  scrollSpeed: SCROLL_SPEED,
  obstacleHeight: BLOCK_HEIGHT,
  playerSize: PLAYER_SIZE,
  doubleJump: false,
});

function createInitialState() {
  return {
    phase: "idle", // idle | analyzing | playing | gameOver
    obstacles: [],
    playerY: GROUND_Y,
    playerVy: 0,
    onGround: true,
    jumpsUsed: 0,
    lastFrameTime: 0,
    passedCount: 0,
    botTargetIndex: 0,
  };
}

export default function BeatDashGame() {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const stateRef = useRef(createInitialState());
  const [phase, setPhase] = useState("idle");
  const [passedCount, setPassedCount] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [bpm, setBpm] = useState(null);
  const [beatMode, setBeatMode] = useState("onsets"); // onsets | grid
  const [autoplay, setAutoplay] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;
    const audio = audioRef.current;
    const currentTime = audio ? audio.currentTime : 0;

    ctx.fillStyle = "#0b0b12";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Ground line.
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + PLAYER_SIZE / 2);
    ctx.lineTo(CANVAS_W, GROUND_Y + PLAYER_SIZE / 2);
    ctx.stroke();

    // Obstacles (ground blocks).
    ctx.fillStyle = "#ff5e9c";
    for (const ob of s.obstacles) {
      const x = PLAYER_X + (ob.time - currentTime) * SCROLL_SPEED;
      if (x < -ob.width || x > CANVAS_W + ob.width) continue;
      ctx.fillRect(
        x - ob.width / 2,
        GROUND_Y + PLAYER_SIZE / 2 - BLOCK_HEIGHT,
        ob.width,
        BLOCK_HEIGHT
      );
    }

    // Player.
    ctx.fillStyle = "#4dd8f7";
    ctx.fillRect(
      PLAYER_X - PLAYER_SIZE / 2,
      s.playerY - PLAYER_SIZE / 2,
      PLAYER_SIZE,
      PLAYER_SIZE
    );
  }, []);

  const startGame = useCallback(async () => {
    const s = stateRef.current;
    s.phase = "analyzing";
    setPhase("analyzing");

    const res = await fetch(AUDIO_URL);
    const arrayBuffer = await res.arrayBuffer();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    const onsets = detectOnsets(buffer);
    const tempo = estimateTempo(onsets);
    const energyEnvelope = computeEnergyEnvelope(buffer);
    const maxClearWidth = estimateMaxClearWidth({
      jumpVelocity: JUMP_VELOCITY,
      gravity: GRAVITY,
      scrollSpeed: SCROLL_SPEED,
      obstacleHeight: BLOCK_HEIGHT,
      playerSize: PLAYER_SIZE,
      doubleJump: MAX_JUMPS > 1,
    });
    const beatTimes =
      beatMode === "grid"
        ? generateBeatGrid(tempo, buffer.duration, {
            phaseOffset: estimatePhaseOffset(onsets, tempo),
          })
        : onsets;

    const obstacles = generateGroundObstacles(beatTimes, SEED, {
      energyEnvelope,
      scrollSpeed: SCROLL_SPEED,
      maxClearWidth,
    });
    ctx.close();

    setBpm(tempo);
    s.obstacles = obstacles;
    s.playerY = GROUND_Y;
    s.playerVy = 0;
    s.onGround = true;
    s.jumpsUsed = 0;
    s.botTargetIndex = 0;
    s.passedCount = 0;
    s.lastFrameTime = 0;
    s.phase = "playing";
    setPassedCount(0);
    setPhase("playing");

    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.play();
  }, [beatMode]);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "playing" && s.jumpsUsed < MAX_JUMPS) {
      s.playerVy = JUMP_VELOCITY;
      s.onGround = false;
      s.jumpsUsed += 1;
    }
  }, []);

  // Input: one key does everything (jump), same as a single tap/click game.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [jump]);

  // Game loop.
  useEffect(() => {
    let frameId;
    const loop = (time) => {
      const s = stateRef.current;
      if (s.phase === "playing") {
        // Capped so a stutter (backgrounded tab, GC pause, slow device)
        // can't produce one oversized frame step that tunnels the player
        // through a block's 36px height between two sampled positions —
        // a real bug, not intended leniency: it read as "the cube didn't
        // kill me, it just let a double jump through."
        const delta = Math.min((time - (s.lastFrameTime || time)) / 1000, 1 / 30);
        s.lastFrameTime = time;

        s.playerVy += GRAVITY * delta;
        s.playerY += s.playerVy * delta;
        if (s.playerY >= GROUND_Y) {
          s.playerY = GROUND_Y;
          s.playerVy = 0;
          s.onGround = true;
          s.jumpsUsed = 0;
        }

        const audio = audioRef.current;
        const currentTime = audio ? audio.currentTime : 0;

        if (autoplay) {
          // Track exactly one target obstacle at a time (by index, not a
          // scan-every-obstacle-every-frame loop) — the trigger window
          // below is wider than the minimum guaranteed gap between merged
          // obstacles, so scanning all of them could have two obstacles
          // "active" simultaneously and jump for the wrong one, or spend
          // the double jump on the wrong target.
          while (
            s.botTargetIndex < s.obstacles.length &&
            s.obstacles[s.botTargetIndex].time - currentTime < -0.05
          ) {
            s.botTargetIndex++;
          }
          const target = s.obstacles[s.botTargetIndex];
          if (target) {
            const timeToArrival = target.time - currentTime;
            // Jump when the obstacle is APEX_TIME away, so the jump's peak
            // height (its highest point) lines up with the obstacle's
            // center arriving — the window generateGroundObstacles' width
            // cap was computed around. Wide (double-jump-required)
            // obstacles get a second jump once the first has crested (vy
            // crossing back to falling).
            if (timeToArrival <= APEX_TIME + 0.03) {
              if (s.jumpsUsed === 0) {
                jump();
              } else if (
                target.width > SINGLE_JUMP_CLEAR_WIDTH &&
                s.jumpsUsed === 1 &&
                s.playerVy >= 0
              ) {
                jump();
              }
            }
          }
        }

        let newlyPassed = 0;
        let collided = false;
        for (const ob of s.obstacles) {
          const x = PLAYER_X + (ob.time - currentTime) * SCROLL_SPEED;
          const withinX = Math.abs(x - PLAYER_X) < ob.width / 2 + PLAYER_SIZE / 2;
          // Only a threat while the player is on/near the ground — airborne
          // above the block's top clears it, matching a real jump arc.
          const blockTop = GROUND_Y + PLAYER_SIZE / 2 - BLOCK_HEIGHT;
          if (withinX && s.playerY + PLAYER_SIZE / 2 > blockTop) collided = true;
          if (!ob._passed && x < PLAYER_X - ob.width / 2) {
            ob._passed = true;
            newlyPassed++;
          }
        }
        if (newlyPassed > 0) {
          s.passedCount += newlyPassed;
          setPassedCount(s.passedCount);
        }

        if (collided || (audio && audio.ended)) {
          s.phase = "gameOver";
          setPhase("gameOver");
          setFinalTime(currentTime);
          if (audio) audio.pause();
        }

        draw();
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [draw, autoplay, jump]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="flex flex-col items-center gap-4">
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={jump}
          className="cursor-pointer rounded-lg bg-black/40 ring-1 ring-white/10"
        />
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/70 p-3 text-center">
            {phase === "idle" && (
              <>
                <div className="flex items-center gap-2 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
                  {[
                    { key: "onsets", label: "Onsets" },
                    { key: "grid", label: "BPM grid" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setBeatMode(opt.key)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        beatMode === opt.key
                          ? "bg-[#ff5e9c]/30 text-white"
                          : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-white/60">
                  <input
                    type="checkbox"
                    checked={autoplay}
                    onChange={(e) => setAutoplay(e.target.checked)}
                  />
                  Autoplay (bot jumps, just watch)
                </label>
                <button
                  onClick={startGame}
                  className="rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  Start
                </button>
              </>
            )}
            {phase === "analyzing" && (
              <p className="font-heading text-xl text-white">Analyzing track…</p>
            )}
            {phase === "gameOver" && (
              <>
                <p className="font-heading text-2xl text-white">Game over</p>
                <p className="text-sm text-white/70">
                  Survived {finalTime.toFixed(1)}s · {passedCount} passed
                  {bpm && ` · ~${bpm} BPM`} · {beatMode}
                  {autoplay && " · autoplay"}
                </p>
                <button
                  onClick={startGame}
                  className="rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  Restart
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-white/40">
        Space / ↑ / W / click = jump — double jump available
      </p>
      <p className="text-xs text-white/30">
        Track: &quot;Relativity&quot; by 1000 Handz (CC-BY, 1000Handz.com)
      </p>
    </div>
  );
}
