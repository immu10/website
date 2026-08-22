"use client";

// Reverse-engineering step, not a game yet: forget procedural map
// generation entirely — just prove out "cubes react to the track" as a
// live equalizer-style visualization. One cube per frequency band tracks
// that band's real-time amplitude (via an AnalyserNode, not the offline
// onset/energy analysis the other two games use), each in its own lane and
// color, while all of them sweep left to right together over the song's
// duration. No obstacles, no scoring — purely a feel-check for how audio
// maps to motion before any game mechanics get layered on top.

import { useCallback, useEffect, useRef, useState } from "react";

const AUDIO_URL = "/audio/relativity-1000handz.mp3";

const CANVAS_W = 700;
const CANVAS_H = 300;
const CUBE_SIZE = 24;
const MARGIN = 14;

// Fractions of the analyser's bin range (0..1 = 0Hz..Nyquist), not exact Hz
// — good enough for "four visually distinct reactive zones," not a precise
// crossover design. Weighted toward the low end since music energy tends to
// concentrate there.
const BANDS = [
  { name: "bass", from: 0, to: 0.04, color: "#ff5e9c" },
  { name: "low-mid", from: 0.04, to: 0.12, color: "#fb923c" },
  { name: "mid", from: 0.12, to: 0.3, color: "#4ade80" },
  { name: "treble", from: 0.3, to: 1.0, color: "#4dd8f7" },
];

export default function BeatVizGame() {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const seekRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const audioCtxRef = useRef(null);
  const smoothedYRef = useRef(BANDS.map(() => CANVAS_H / BANDS.length / 2));
  const seekingRef = useRef(false);
  const [phase, setPhase] = useState("idle"); // idle | playing | ended

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const audio = audioRef.current;
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    ctx.fillStyle = "#0b0b12";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const laneHeight = CANVAS_H / BANDS.length;

    if (analyser && dataArray) analyser.getByteFrequencyData(dataArray);

    const progress =
      audio && audio.duration ? Math.min(1, audio.currentTime / audio.duration) : 0;
    const x = MARGIN + progress * (CANVAS_W - MARGIN * 2 - CUBE_SIZE);

    BANDS.forEach((band, i) => {
      const laneTop = i * laneHeight;

      // Lane separator.
      if (i > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath();
        ctx.moveTo(0, laneTop);
        ctx.lineTo(CANVAS_W, laneTop);
        ctx.stroke();
      }

      let amplitudeNorm = 0;
      if (analyser && dataArray) {
        const from = Math.floor(band.from * dataArray.length);
        const to = Math.max(from + 1, Math.floor(band.to * dataArray.length));
        let sum = 0;
        for (let k = from; k < to; k++) sum += dataArray[k];
        amplitudeNorm = sum / (to - from) / 255; // 0..1
      }

      const targetY =
        laneTop + laneHeight - MARGIN - amplitudeNorm * (laneHeight - 2 * MARGIN);
      smoothedYRef.current[i] += (targetY - smoothedYRef.current[i]) * 0.35;

      ctx.fillStyle = band.color;
      ctx.fillRect(x, smoothedYRef.current[i] - CUBE_SIZE / 2, CUBE_SIZE, CUBE_SIZE);
    });

    // Keep the seek bar in sync every frame instead of relying on the
    // 'loadedmetadata' event alone for max/disabled — that event can fire
    // before the listener attaches (a real race, not hypothetical: it lost
    // that race in testing), leaving the bar stuck at max=0 forever.
    // Skip the value sync specifically while the user is actively
    // dragging, so we don't yank the thumb back mid-drag.
    if (seekRef.current) {
      const dur = audio ? audio.duration : 0;
      if (dur && Number.isFinite(dur)) {
        seekRef.current.max = String(dur);
        seekRef.current.disabled = false;
      }
      if (!seekingRef.current) seekRef.current.value = audio ? audio.currentTime : 0;
    }
  }, []);

  const ensureAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaElementSource(audio);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    } else if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
  }, []);

  const start = useCallback(async () => {
    await ensureAudioGraph();
    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.play();
    setPhase("playing");
  }, [ensureAudioGraph]);

  const onSeekInput = useCallback((e) => {
    seekingRef.current = true;
    const audio = audioRef.current;
    audio.currentTime = Number(e.target.value);
  }, []);

  const onSeekCommit = useCallback(async () => {
    seekingRef.current = false;
    // Seeking works on the plain <audio> element even before Start has ever
    // been pressed, but the reactive cubes need the analyser graph hooked
    // up — set it up (without forcing playback) so scrubbing before your
    // first Start still shows live-reactive amplitude once you do play.
    await ensureAudioGraph();
  }, [ensureAudioGraph]);

  // Animation loop — always running so it can redraw an idle state too;
  // the audio-reactive part only kicks in once analyser data exists.
  useEffect(() => {
    let frameId;
    const loop = () => {
      draw();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [draw]);

  useEffect(() => {
    const audio = audioRef.current;
    const onEnded = () => setPhase("ended");
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

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
            <button
              onClick={start}
              className="rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              {phase === "ended" ? "Replay" : "Start"}
            </button>
          </div>
        )}
      </div>

      <input
        ref={seekRef}
        type="range"
        min={0}
        max={0}
        step={0.01}
        defaultValue={0}
        onInput={onSeekInput}
        onChange={onSeekCommit}
        onMouseUp={onSeekCommit}
        onTouchEnd={onSeekCommit}
        className="w-full max-w-md accent-[#ff5e9c]"
      />

      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/50">
        {BANDS.map((band) => (
          <span key={band.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: band.color }}
            />
            {band.name}
          </span>
        ))}
      </div>

      <p className="text-xs text-white/40">
        One cube per frequency band, no map generation — X sweeps with track progress.
      </p>
      <p className="text-xs text-white/30">
        Track: &quot;Relativity&quot; by 1000 Handz (CC-BY, 1000Handz.com)
      </p>
    </div>
  );
}
