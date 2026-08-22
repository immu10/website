"use client";

// Basic demo: a two-key (up/down) beat-synced runner. The course is
// procedurally generated from the track's own detected beats + a fixed
// seed (see audioAnalysis.js), not hand-authored — same track+seed always
// produces the same course, which is what will eventually make this
// leaderboard-fair. No scoring/leaderboard wiring yet, this is just the
// playable loop.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectOnsets,
  estimateTempo,
  computeEnergyEnvelope,
  generateObstacles,
  generateBeatGrid,
  estimatePhaseOffset,
} from "../audioAnalysis";

const AUDIO_URL = "/audio/relativity-1000handz.mp3";
const SEED = 1234; // fixed for now — rotating seeds are a later feature

const CANVAS_W = 700;
const CANVAS_H = 460;
const PLAYER_X = 120;
const PLAYER_SIZE = 22;
const OBSTACLE_HALF_WIDTH = 18;
const SCROLL_SPEED = 220; // px/sec, drives obstacle screen position from audio.currentTime

const V_SPEED = 320; // px/sec while a direction key is held
const GRAVITY = 140; // px/sec^2, light drift when no key is held

function createInitialState() {
  return {
    phase: "idle", // idle | analyzing | playing | gameOver
    obstacles: [],
    playerY: CANVAS_H / 2,
    playerVy: 0,
    upHeld: false,
    downHeld: false,
    lastFrameTime: 0,
    passedCount: 0,
    survivedTime: 0,
  };
}

export default function MusicRunnerGame() {
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

    // Obstacles.
    ctx.fillStyle = "#ff5e9c";
    for (const ob of s.obstacles) {
      const x = PLAYER_X + (ob.time - currentTime) * SCROLL_SPEED;
      if (x < -OBSTACLE_HALF_WIDTH || x > CANVAS_W + OBSTACLE_HALF_WIDTH) continue;
      ctx.fillRect(x - OBSTACLE_HALF_WIDTH, 0, OBSTACLE_HALF_WIDTH * 2, ob.gapY);
      ctx.fillRect(
        x - OBSTACLE_HALF_WIDTH,
        ob.gapY + ob.gapHeight,
        OBSTACLE_HALF_WIDTH * 2,
        CANVAS_H - (ob.gapY + ob.gapHeight)
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

    const beatTimes =
      beatMode === "grid"
        ? generateBeatGrid(tempo, buffer.duration, {
            phaseOffset: estimatePhaseOffset(onsets, tempo),
          })
        : onsets;

    const obstacles = generateObstacles(beatTimes, SEED, {
      energyEnvelope,
      canvasHeight: CANVAS_H,
      maxVerticalSpeed: V_SPEED,
    });
    ctx.close();

    setBpm(tempo);

    s.obstacles = obstacles;
    s.playerY = CANVAS_H / 2;
    s.playerVy = 0;
    s.passedCount = 0;
    s.lastFrameTime = 0;
    s.phase = "playing";
    setPassedCount(0);
    setPhase("playing");

    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.play();
  }, [beatMode]);

  // Keyboard input.
  useEffect(() => {
    const onKeyDown = (e) => {
      const s = stateRef.current;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") s.upHeld = true;
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") s.downHeld = true;
    };
    const onKeyUp = (e) => {
      const s = stateRef.current;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") s.upHeld = false;
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") s.downHeld = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Game loop.
  useEffect(() => {
    let frameId;
    const loop = (time) => {
      const s = stateRef.current;
      if (s.phase === "playing") {
        const delta = (time - (s.lastFrameTime || time)) / 1000;
        s.lastFrameTime = time;

        const audio = audioRef.current;
        const currentTime = audio ? audio.currentTime : 0;

        let upHeld = s.upHeld;
        let downHeld = s.downHeld;
        if (autoplay) {
          // Steer toward the vertical center of the next un-passed
          // obstacle's gap — the same target the reachability safeguard in
          // generateObstacles already guarantees is always reachable in
          // time, so a bot doing nothing smarter than "move toward it"
          // clears the course by construction.
          const next = s.obstacles.find((ob) => !ob._passed);
          if (next) {
            const target = next.gapY + next.gapHeight / 2;
            const deadzone = 6;
            if (s.playerY > target + deadzone) {
              upHeld = true;
              downHeld = false;
            } else if (s.playerY < target - deadzone) {
              downHeld = true;
              upHeld = false;
            } else {
              upHeld = false;
              downHeld = false;
            }
          }
        }

        if (upHeld && !downHeld) s.playerVy = -V_SPEED;
        else if (downHeld && !upHeld) s.playerVy = V_SPEED;
        else s.playerVy += GRAVITY * delta;

        s.playerY += s.playerVy * delta;
        s.playerY = Math.max(PLAYER_SIZE / 2, Math.min(CANVAS_H - PLAYER_SIZE / 2, s.playerY));

        let newlyPassed = 0;
        let collided = false;
        for (const ob of s.obstacles) {
          const x = PLAYER_X + (ob.time - currentTime) * SCROLL_SPEED;
          const withinX = Math.abs(x - PLAYER_X) < OBSTACLE_HALF_WIDTH + PLAYER_SIZE / 2;
          if (withinX) {
            const topHit = s.playerY - PLAYER_SIZE / 2 < ob.gapY;
            const bottomHit = s.playerY + PLAYER_SIZE / 2 > ob.gapY + ob.gapHeight;
            if (topHit || bottomHit) collided = true;
          }
          if (!ob._passed && x < PLAYER_X - OBSTACLE_HALF_WIDTH) {
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
  }, [draw, autoplay]);

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
          className="rounded-lg bg-black/40 ring-1 ring-white/10"
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
                  Autoplay (bot steers, just watch)
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

      <p className="text-xs text-white/40">↑ / W up · ↓ / S down · no key = light drift</p>
      <p className="text-xs text-white/30">
        Track: &quot;Relativity&quot; by 1000 Handz (CC-BY, 1000Handz.com)
      </p>
    </div>
  );
}
