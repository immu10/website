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
  generateTunnel,
  sampleTunnel,
  generateBeatGrid,
  estimatePhaseOffset,
} from "../audioAnalysis";

const AUDIO_URL = "/audio/relativity-1000handz.mp3";
const SEED = 1234; // fixed for now — rotating seeds are a later feature

const CANVAS_W = 700;
const CANVAS_H = 460;
const PLAYER_X = 120;
const PLAYER_SIZE = 22;
const TUNNEL_SAMPLE_STEP = 8; // px between rendered points along the tunnel wall curve
const SCROLL_SPEED = 220; // px/sec, drives the tunnel's screen position from audio.currentTime

const V_SPEED = 288; // px/sec constant vertical speed (was 320 — slowed 10%, direction flips felt too fast)

function createInitialState() {
  return {
    phase: "idle", // idle | analyzing | playing | gameOver
    keyframes: [],
    playerY: CANVAS_H / 2,
    playerVy: 0,
    direction: 1, // 1 = down, -1 = up — flipped by any of the mapped keys
    lastFrameTime: 0,
    passedCount: 0,
    passedKeyframeIndex: 1, // index 0 is the synthetic t=0 keyframe, already "passed"
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

    // Tunnel — continuous top/bottom walls zigzagging with the beat, player
    // flies through the gap between them the whole way, not discrete pillars.
    if (s.keyframes.length > 0) {
      const trackTimeAt = (x) => currentTime + (x - PLAYER_X) / SCROLL_SPEED;
      ctx.fillStyle = "#ff5e9c";

      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= CANVAS_W; x += TUNNEL_SAMPLE_STEP) {
        const { centerY, width } = sampleTunnel(s.keyframes, trackTimeAt(x));
        ctx.lineTo(x, centerY - width / 2);
      }
      ctx.lineTo(CANVAS_W, 0);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H);
      for (let x = 0; x <= CANVAS_W; x += TUNNEL_SAMPLE_STEP) {
        const { centerY, width } = sampleTunnel(s.keyframes, trackTimeAt(x));
        ctx.lineTo(x, centerY + width / 2);
      }
      ctx.lineTo(CANVAS_W, CANVAS_H);
      ctx.closePath();
      ctx.fill();
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

    const keyframes = generateTunnel(beatTimes, SEED, {
      energyEnvelope,
      canvasHeight: CANVAS_H,
      maxVerticalSpeed: V_SPEED,
    });
    ctx.close();

    setBpm(tempo);

    s.keyframes = keyframes;
    s.playerY = CANVAS_H / 2;
    s.playerVy = 0;
    s.direction = 1;
    s.passedCount = 0;
    s.passedKeyframeIndex = 1;
    s.lastFrameTime = 0;
    s.phase = "playing";
    setPassedCount(0);
    setPhase("playing");

    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.play();
  }, [beatMode]);

  // Keyboard input — all four keys (up/down, W/S) map to the same single
  // action: flip current direction. Not hold-to-steer anymore.
  useEffect(() => {
    const DIRECTION_KEYS = ["ArrowUp", "ArrowDown", "w", "W", "s", "S"];
    const onKeyDown = (e) => {
      if (!DIRECTION_KEYS.includes(e.key)) return;
      e.preventDefault();
      if (e.repeat) return; // ignore OS key-repeat while held
      const s = stateRef.current;
      s.direction = -s.direction;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
        const sample = sampleTunnel(s.keyframes, currentTime);

        if (autoplay) {
          // Steer toward the tunnel's current center — the reachability
          // safeguard in generateTunnel already guarantees the slope
          // between keyframes never exceeds V_SPEED, so a bot doing
          // nothing smarter than "move toward center" clears the course
          // by construction. The bot sets direction directly rather than
          // "pressing" the toggle key.
          const deadzone = 6;
          if (s.playerY > sample.centerY + deadzone) s.direction = -1;
          else if (s.playerY < sample.centerY - deadzone) s.direction = 1;
        }

        s.playerVy = s.direction * V_SPEED;
        s.playerY += s.playerVy * delta;
        s.playerY = Math.max(PLAYER_SIZE / 2, Math.min(CANVAS_H - PLAYER_SIZE / 2, s.playerY));

        const top = sample.centerY - sample.width / 2;
        const bottom = sample.centerY + sample.width / 2;
        const playerTop = s.playerY - PLAYER_SIZE / 2;
        const playerBottom = s.playerY + PLAYER_SIZE / 2;
        const collided = playerTop < top || playerBottom > bottom;

        while (
          s.passedKeyframeIndex < s.keyframes.length &&
          s.keyframes[s.passedKeyframeIndex].time < currentTime
        ) {
          s.passedKeyframeIndex++;
        }
        const newPassedCount = s.passedKeyframeIndex - 1;
        if (newPassedCount !== s.passedCount) {
          s.passedCount = newPassedCount;
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

      <p className="text-xs text-white/40">↑ / W / ↓ / S — any one flips direction</p>
      <p className="text-xs text-white/30">
        Track: &quot;Relativity&quot; by 1000 Handz (CC-BY, 1000Handz.com)
      </p>
    </div>
  );
}
