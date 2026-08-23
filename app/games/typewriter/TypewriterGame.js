"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BOARD_W,
  BOARD_H,
  DANGER_Y,
  INITIAL_LIVES,
  WORDS_PER_LEVEL,
  pickWord,
  levelForWordsTyped,
  fallSpeedForLevel,
  spawnIntervalForLevel,
  scoreForWord,
  wpmFromChars,
} from "./typewriterEngine";
import { useAuth } from "@/app/games/AuthContext";
import GuestIcon from "@/app/games/GuestIcon";

// Temporary: start straight at level 3 instead of ramping up from 1.
const START_LEVEL = 3;
const START_WORDS_TYPED = (START_LEVEL - 1) * WORDS_PER_LEVEL;

function createInitialState() {
  return {
    words: [],
    nextId: 1,
    spawnAccum: 0,
    lastTime: 0,
    running: false,
    started: false,
    gameOver: false,
    score: 0,
    wordsTyped: START_WORDS_TYPED,
    level: START_LEVEL,
    lives: INITIAL_LIVES,
    streak: 0,
    correctChars: 0,
    startTime: 0,
    lockedId: null,
  };
}

export default function TypewriterGame() {
  const canvasRef = useRef(null);
  const inputRef = useRef(null);

  // Mutable game state lives in a ref, outside React's render cycle, so the
  // animation loop and input handler can read/write it every frame without
  // triggering re-renders; React state below is only for the bits the UI
  // needs to display.
  const stateRef = useRef(createInitialState());

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [wpm, setWpm] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [typedValue, setTypedValue] = useState("");

  // Leaderboard: sessionTokenRef is minted fresh per game (see startGame),
  // mirroring Tetris's anti-cheat approach — see /api/games/tetris/score for
  // why. The typewriter API routes don't exist yet, so this stays inert
  // (session mint fails silently, submit shows an error) until they're added.
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
    setPlayerName(localStorage.getItem("typewriter-name") ?? "");
  }, []);

  const fetchLeaderboard = useCallback(() => {
    fetch("/api/games/typewriter/leaderboard")
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
      const res = await fetch("/api/games/typewriter/score", {
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
      localStorage.setItem("typewriter-name", playerName);
      setSubmitState("submitted");
      fetchLeaderboard();
    } catch {
      setSubmitState("error");
      setSubmitError("Network error.");
    }
  }, [playerName, fetchLeaderboard]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0b0b12";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    // Danger line.
    ctx.strokeStyle = "rgba(255,94,156,0.4)";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y);
    ctx.lineTo(BOARD_W, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    const s = stateRef.current;
    const buffer = (inputRef.current?.value ?? "").toLowerCase();

    ctx.font = "600 22px 'JetBrains Mono', monospace";
    ctx.textBaseline = "middle";
    for (const w of s.words) {
      const isLocked = w.id === s.lockedId;

      // Split into three runs: correctly-typed prefix, mistyped tail (typos
      // the player hasn't backspaced yet), and the untyped remainder.
      let matchedLen = 0;
      if (isLocked) {
        while (
          matchedLen < buffer.length &&
          matchedLen < w.text.length &&
          buffer[matchedLen] === w.text[matchedLen]
        ) {
          matchedLen++;
        }
      }
      const correctPart = isLocked ? w.text.slice(0, matchedLen) : "";
      const errorPart = isLocked ? buffer.slice(matchedLen) : "";
      const restPart = isLocked ? w.text.slice(buffer.length) : w.text;

      let x = w.x;
      if (correctPart) {
        ctx.fillStyle = "#ff5e9c";
        ctx.fillText(correctPart, x, w.y);
        x += ctx.measureText(correctPart).width;
      }
      if (errorPart) {
        ctx.fillStyle = "#d2042d";
        ctx.fillText(errorPart, x, w.y);
        x += ctx.measureText(errorPart).width;
      }
      ctx.fillStyle = isLocked ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)";
      ctx.fillText(restPart, x, w.y);
    }
  }, []);

  const nextFromBoard = useCallback((level) => {
    const s = stateRef.current;
    return pickWord(level, s.words.map((w) => w.text));
  }, []);

  const spawnWord = useCallback(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    const text = nextFromBoard(s.level);
    const ctx = canvas?.getContext("2d");
    let width = text.length * 13;
    if (ctx) {
      ctx.font = "600 22px 'JetBrains Mono', monospace";
      width = ctx.measureText(text).width;
    }
    const x = 12 + Math.random() * Math.max(0, BOARD_W - 24 - width);
    s.words.push({ id: s.nextId++, text, x, y: -10 });
  }, [nextFromBoard]);

  const completeWord = useCallback((word) => {
    const s = stateRef.current;
    s.words = s.words.filter((w) => w.id !== word.id);
    s.wordsTyped += 1;
    s.streak += 1;
    s.score += scoreForWord(word.text, s.streak - 1);
    s.correctChars += word.text.length;
    const newLevel = levelForWordsTyped(s.wordsTyped);
    if (newLevel !== s.level) s.level = newLevel;
    setScore(s.score);
    setLevel(s.level);
  }, []);

  const missWord = useCallback((word) => {
    const s = stateRef.current;
    s.words = s.words.filter((w) => w.id !== word.id);
    s.streak = 0;
    s.lives -= 1;
    if (s.lockedId === word.id) {
      s.lockedId = null;
      setTypedValue("");
      if (inputRef.current) inputRef.current.value = "";
    }
    setLives(s.lives);
    if (s.lives <= 0) {
      s.running = false;
      s.gameOver = true;
      setGameOver(true);
    }
  }, []);

  const processInput = useCallback(
    (rawValue) => {
      const s = stateRef.current;
      if (!s.running || s.gameOver) return;
      const value = rawValue.toLowerCase();

      // Backspacing all the way out drops the lock so the next keystroke can
      // retarget freely, instead of staying stuck on one word.
      if (!value) {
        s.lockedId = null;
        return;
      }

      let locked = s.words.find((w) => w.id === s.lockedId);

      // Once locked, a typo no longer wipes the buffer — it's left in place
      // (rendered as an error run in draw()) until the player backspaces it
      // out themselves, same as Monkeytype. Completion only ever fires on an
      // exact match, so a mistyped word just can't finish until fixed.
      //
      // Before locking, though, there's no target on screen to show what
      // went wrong, so the player can't tell how much to backspace — a
      // mismatch here just self-clears the buffer back to empty instead.
      if (!locked) {
        const candidates = s.words.filter((w) => w.text.startsWith(value));
        if (candidates.length > 0) {
          // Lock onto whichever candidate is closest to the danger line.
          candidates.sort((a, b) => b.y - a.y);
          locked = candidates[0];
          s.lockedId = locked.id;
        } else {
          setTypedValue("");
          if (inputRef.current) inputRef.current.value = "";
          return;
        }
      }

      if (locked && value === locked.text) {
        completeWord(locked);
        s.lockedId = null;
        setTypedValue("");
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [completeWord]
  );

  // Tab: bail on the currently-locked word and jump to whichever other word
  // is next most urgent. It's a grace switch, not a fresh start — if what's
  // typed so far is still a valid prefix of the new target (e.g. "ca" is
  // fine for both "car" and "cat"), it carries over; otherwise (e.g. "lap"
  // onto "dog") there's nothing worth salvaging, so the buffer clears. No-op
  // if nothing is locked or there's nothing else to jump to.
  const retarget = useCallback(() => {
    const s = stateRef.current;
    if (!s.running || s.gameOver || !s.lockedId) return;
    const others = s.words.filter((w) => w.id !== s.lockedId);
    if (others.length === 0) return;
    others.sort((a, b) => b.y - a.y);
    const next = others[0];
    s.lockedId = next.id;

    const buffer = (inputRef.current?.value ?? "").toLowerCase();
    if (buffer && !next.text.startsWith(buffer)) {
      setTypedValue("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }, []);

  const handleInputChange = useCallback(
    (e) => {
      const clean = e.target.value.toLowerCase().replace(/[^a-z]/g, "");
      e.target.value = clean;
      setTypedValue(clean);
      processInput(clean);
    },
    [processInput]
  );

  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (!s.started || s.gameOver) return;
    setPaused((prev) => {
      const next = !prev;
      s.running = !next;
      if (!next) inputRef.current?.focus();
      return next;
    });
  }, []);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    Object.assign(s, createInitialState());
    s.running = true;
    s.started = true;
    s.startTime = performance.now();
    setScore(0);
    setLevel(START_LEVEL);
    setLives(INITIAL_LIVES);
    setWpm(0);
    setGameOver(false);
    setPaused(false);
    setStarted(true);
    setTypedValue("");
    setSubmitState("idle");
    setSubmitError("");
    if (inputRef.current) inputRef.current.value = "";

    sessionTokenRef.current = null;
    fetch("/api/games/typewriter/session", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        sessionTokenRef.current = data.token ?? null;
      })
      .catch(() => {});

    spawnWord();
    draw();
    inputRef.current?.focus();
  }, [spawnWord, draw]);

  // Animation loop: advances falling words, spawns new ones, checks for
  // misses, and periodically recomputes WPM.
  useEffect(() => {
    let frameId;
    let wpmAccum = 0;
    const loop = (time) => {
      const s = stateRef.current;
      if (s.running) {
        const delta = time - (s.lastTime || time);
        s.lastTime = time;

        const speed = fallSpeedForLevel(s.level);
        const dy = (speed * delta) / 1000;
        for (const w of s.words) w.y += dy;

        const missed = s.words.filter((w) => w.y >= DANGER_Y);
        for (const w of missed) missWord(w);

        s.spawnAccum += delta;
        const interval = spawnIntervalForLevel(s.level);
        if (s.spawnAccum > interval) {
          s.spawnAccum = 0;
          spawnWord();
        }

        wpmAccum += delta;
        if (wpmAccum > 500) {
          wpmAccum = 0;
          setWpm(wpmFromChars(s.correctChars, time - s.startTime));
        }

        draw();
      } else {
        s.lastTime = time;
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [draw, missWord, spawnWord]);

  // Initial paint.
  useEffect(() => {
    draw();
  }, [draw]);

  // Pause/retarget shortcuts — deliberately Escape and Tab, not letter keys,
  // since letters are consumed by the typing input.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        togglePause();
      } else if (e.key === "Tab") {
        // Default Tab behavior would blur the hidden input onto the next
        // focusable element instead of retargeting.
        e.preventDefault();
        retarget();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePause, retarget]);

  const focusInput = useCallback(() => {
    if (started && !gameOver && !paused) inputRef.current?.focus();
  }, [started, gameOver, paused]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full flex-row flex-wrap items-start justify-center gap-4">
        <div className="flex flex-col items-center gap-3">
          <div className="relative" style={{ width: BOARD_W, maxWidth: "100%" }}>
            <canvas
              ref={canvasRef}
              width={BOARD_W}
              height={BOARD_H}
              onClick={focusInput}
              className="w-full rounded-lg bg-black/40 ring-1 ring-white/10"
              style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}` }}
            />
            {/* Real (but invisible) text input — captures both physical and
                mobile virtual keyboards, unlike a raw keydown listener. */}
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={handleInputChange}
              aria-label="Type the falling words"
              className="absolute inset-0 h-full w-full cursor-text opacity-0"
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

                    <button
                      onClick={startGame}
                      className="pointer-events-auto rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
                    >
                      Restart
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startGame}
                    className="pointer-events-auto rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
                  >
                    Start
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-white/40">
            Type the falling words before they cross the line. Backspace
            fixes typos. Tab bails on the current word. Esc to pause.
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
              Level
            </div>
            <div className="font-heading text-xl text-white">{level}</div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">
              WPM
            </div>
            <div className="font-heading text-xl text-white">{wpm}</div>
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
              href="/games/leaderboard?game=typewriter"
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
