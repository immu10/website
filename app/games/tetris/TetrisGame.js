"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  COLS,
  ROWS,
  SHAPES,
  createEmptyBoard,
  makeBag,
  rotateMatrix,
  rotateMatrixCCW,
  spawnPosition,
  collides,
  merge,
  clearLines,
  scoreForLines,
  dropIntervalForLevel,
} from "./tetrisEngine";
import { useAuth } from "../AuthContext";
import GuestIcon from "../GuestIcon";

const MIN_CELL = 14;
const MAX_CELL = 40;
const DEFAULT_CELL = 24;
// Roughly how much horizontal/vertical chrome (heading, side panel, page
// padding, controls hint, D-pad on phones) surrounds the board — used to
// fit it to the viewport. Approximate on purpose; the slider covers the rest.
const CHROME_W = 240;
const CHROME_H = { desktop: 260, mobile: 480 };

function drawCell(ctx, x, y, color, cell) {
  ctx.fillStyle = color;
  ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
}

function createInitialState() {
  return {
    board: createEmptyBoard(),
    bag: [],
    current: null,
    pos: { x: 0, y: 0 },
    matrix: null,
    color: null,
    next: null,
    dropCounter: 0,
    dropInterval: dropIntervalForLevel(1),
    lastTime: 0,
    running: false,
    started: false,
    gameOver: false,
    score: 0,
    lines: 0,
    level: 1,
  };
}

export default function TetrisGame() {
  const canvasRef = useRef(null);
  const nextCanvasRef = useRef(null);

  // Mutable game state lives in a ref, outside React's render cycle, so the
  // animation loop and input handlers can read/write it every frame without
  // triggering re-renders; React state below is only for the bits the UI
  // needs to display. createInitialState() runs on every render but React
  // only keeps the first result — .current is never read during render,
  // only inside effects and event-handler callbacks below.
  const stateRef = useRef(createInitialState());

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showDesktopDpad, setShowDesktopDpad] = useState(false);

  // Leaderboard: sessionTokenRef is minted fresh per game (see startGame)
  // and redeemed once on submit — see /api/games/tetris/score for why.
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
    setPlayerName(localStorage.getItem("tetris-name") ?? "");
  }, []);

  const fetchLeaderboard = useCallback(() => {
    fetch("/api/games/tetris/leaderboard")
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
      const res = await fetch("/api/games/tetris/score", {
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
      localStorage.setItem("tetris-name", playerName);
      setSubmitState("submitted");
      fetchLeaderboard();
    } catch {
      setSubmitState("error");
      setSubmitError("Network error.");
    }
  }, [playerName, fetchLeaderboard]);

  // Board pixel size, in px per cell. Starts auto-fit to the viewport; the
  // slider lets the player override it freely up to MAX_CELL, even past the
  // point where the board + side panel no longer fit side by side — the
  // panel just wraps below the board in that case (see the row wrapper's
  // flex-wrap below). Once overridden, auto-fit stops adjusting it on
  // window resize until "Default" is pressed again.
  const [cellSize, setCellSize] = useState(DEFAULT_CELL);
  const manualSizeRef = useRef(false);

  const computeFit = useCallback(() => {
    const isMobile = window.innerWidth < 640; // matches the sm: breakpoint below
    const widthBudget = window.innerWidth - CHROME_W;
    const heightBudget = window.innerHeight - (isMobile ? CHROME_H.mobile : CHROME_H.desktop);
    const fit = Math.min(Math.floor(widthBudget / COLS), Math.floor(heightBudget / ROWS));
    return Math.max(MIN_CELL, Math.min(MAX_CELL, fit));
  }, []);

  const applyFit = useCallback(() => {
    if (!manualSizeRef.current) setCellSize(computeFit());
  }, [computeFit]);

  useEffect(() => {
    // Initial fit needs window dimensions, unavailable during SSR/first
    // render, so this has to run post-mount rather than as initial state.
    applyFit();
    window.addEventListener("resize", applyFit);
    return () => window.removeEventListener("resize", applyFit);
  }, [applyFit]);

  const boardPxW = COLS * cellSize;
  const boardPxH = ROWS * cellSize;
  const previewCell = Math.max(10, Math.round(cellSize * 0.8));
  const previewPx = previewCell * 4;
  // D-pad buttons scale with the board instead of staying a fixed size —
  // fixed-size buttons have a hard-floor width wide enough to force the side
  // panel to wrap on narrow phones even when the board itself is small.
  const padBtn = Math.max(36, Math.min(60, Math.round(cellSize * 1.5)));
  const padGap = Math.max(6, Math.round(padBtn * 0.15));

  const drawNextPreview = useCallback(() => {
    const canvas = nextCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const type = stateRef.current.next;
    if (!type) return;
    const { matrix, color } = SHAPES[type];
    const size = matrix.length;
    const offset = (canvas.width - size * previewCell) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!matrix[y][x]) continue;
        ctx.fillStyle = color;
        ctx.fillRect(
          offset + x * previewCell + 1,
          offset + y * previewCell + 1,
          previewCell - 2,
          previewCell - 2
        );
      }
    }
  }, [previewCell]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0b0b12";
    ctx.fillRect(0, 0, boardPxW, boardPxH);

    const { board, matrix, pos, color } = stateRef.current;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) drawCell(ctx, x, y, board[y][x], cellSize);
      }
    }

    if (matrix) {
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
          if (!matrix[y][x]) continue;
          const boardY = pos.y + y;
          if (boardY < 0) continue;
          drawCell(ctx, pos.x + x, boardY, color, cellSize);
        }
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, boardPxH);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(boardPxW, y * cellSize);
      ctx.stroke();
    }
  }, [cellSize, boardPxW, boardPxH]);

  const nextFromBag = useCallback(() => {
    const s = stateRef.current;
    if (s.bag.length === 0) s.bag = makeBag();
    return s.bag.shift();
  }, []);

  const spawnPiece = useCallback(
    (type) => {
      const s = stateRef.current;
      const { matrix, color } = SHAPES[type];
      s.current = type;
      s.matrix = matrix;
      s.color = color;
      s.pos = spawnPosition(matrix);
      s.next = nextFromBag();
      drawNextPreview();

      if (collides(s.board, s.matrix, s.pos)) {
        s.running = false;
        s.gameOver = true;
        setGameOver(true);
      }
    },
    [nextFromBag, drawNextPreview]
  );

  const lockPiece = useCallback(() => {
    const s = stateRef.current;
    s.board = merge(s.board, s.matrix, s.pos, s.color);
    const { board, cleared } = clearLines(s.board);
    s.board = board;
    if (cleared > 0) {
      const totalLines = s.lines + cleared;
      const newLevel = Math.floor(totalLines / 10) + 1;
      if (newLevel !== s.level) s.dropInterval = dropIntervalForLevel(newLevel);
      s.score += scoreForLines(cleared, newLevel);
      s.lines = totalLines;
      s.level = newLevel;
      setLines(totalLines);
      setLevel(newLevel);
      setScore(s.score);
    }
    spawnPiece(s.next);
  }, [spawnPiece]);

  const tryMove = useCallback((dx, dy) => {
    const s = stateRef.current;
    if (!s.running || s.gameOver) return false;
    const newPos = { x: s.pos.x + dx, y: s.pos.y + dy };
    if (collides(s.board, s.matrix, newPos)) return false;
    s.pos = newPos;
    draw();
    return true;
  }, [draw]);

  const tryRotate = useCallback((direction = "cw") => {
    const s = stateRef.current;
    if (!s.running || s.gameOver || s.current === "O") return;
    const rotated =
      direction === "ccw" ? rotateMatrixCCW(s.matrix) : rotateMatrix(s.matrix);
    // Simple wall kick: try the raw rotation, then nudge left/right a cell.
    for (const dx of [0, -1, 1, -2, 2]) {
      const newPos = { x: s.pos.x + dx, y: s.pos.y };
      if (!collides(s.board, rotated, newPos)) {
        s.matrix = rotated;
        s.pos = newPos;
        draw();
        return;
      }
    }
  }, [draw]);

  const hardDrop = useCallback(() => {
    const s = stateRef.current;
    if (!s.running || s.gameOver) return;
    let dropped = 0;
    while (!collides(s.board, s.matrix, { x: s.pos.x, y: s.pos.y + 1 })) {
      s.pos = { x: s.pos.x, y: s.pos.y + 1 };
      dropped++;
    }
    if (dropped > 0) {
      s.score += dropped * 2;
      setScore(s.score);
    }
    lockPiece();
    s.dropCounter = 0;
    draw();
  }, [lockPiece, draw]);

  const softDrop = useCallback(() => {
    const s = stateRef.current;
    if (!s.running || s.gameOver) return;
    if (tryMove(0, 1)) {
      s.score += 1;
      setScore(s.score);
      s.dropCounter = 0;
    } else {
      lockPiece();
    }
  }, [tryMove, lockPiece]);

  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (!s.started || s.gameOver) return;
    setPaused((prev) => {
      const next = !prev;
      s.running = !next;
      return next;
    });
  }, []);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.board = createEmptyBoard();
    s.bag = makeBag();
    s.dropCounter = 0;
    s.lastTime = 0;
    s.dropInterval = dropIntervalForLevel(1);
    s.running = true;
    s.started = true;
    s.gameOver = false;
    s.score = 0;
    s.lines = 0;
    s.level = 1;
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
    setStarted(true);
    setSubmitState("idle");
    setSubmitError("");

    sessionTokenRef.current = null;
    fetch("/api/games/tetris/session", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        sessionTokenRef.current = data.token ?? null;
      })
      .catch(() => {});

    const first = (() => {
      if (s.bag.length === 0) s.bag = makeBag();
      return s.bag.shift();
    })();
    spawnPiece(first);
    draw();
  }, [spawnPiece, draw]);

  // Animation loop.
  useEffect(() => {
    let frameId;
    const loop = (time) => {
      const s = stateRef.current;
      if (s.running) {
        const delta = time - (s.lastTime || time);
        s.lastTime = time;
        s.dropCounter += delta;
        if (s.dropCounter > s.dropInterval) {
          s.dropCounter = 0;
          if (!collides(s.board, s.matrix, { x: s.pos.x, y: s.pos.y + 1 })) {
            s.pos = { x: s.pos.x, y: s.pos.y + 1 };
          } else {
            lockPiece();
          }
          draw();
        }
      } else {
        s.lastTime = time;
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [lockPiece, draw]);

  // Resizing a canvas clears it, so redraw immediately whenever the board
  // size changes (not just on the next drop tick).
  useEffect(() => {
    draw();
    drawNextPreview();
  }, [draw, drawNextPreview]);

  // Keyboard controls.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space", " "].includes(
          e.key === " " ? "Space" : e.key
        )
      ) {
        e.preventDefault();
      }
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          tryMove(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          tryMove(1, 0);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          softDrop();
          break;
        case "ArrowUp":
        case "w":
        case "W":
          tryRotate("cw");
          break;
        case "q":
        case "Q":
          tryRotate("ccw");
          break;
        case " ":
          hardDrop();
          break;
        case "p":
        case "P":
          togglePause();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tryMove, softDrop, tryRotate, hardDrop, togglePause]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full flex-row flex-wrap items-start justify-center gap-4">
        <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={boardPxW}
            height={boardPxH}
            className="rounded-lg bg-black/40 ring-1 ring-white/10"
          />
          {(!started || gameOver || paused) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/70 p-3 text-center">
              {paused && !gameOver ? (
                <>
                  <p className="font-heading text-2xl text-white">Paused</p>
                  <button
                    onClick={togglePause}
                    className="rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
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
                    <div className="flex flex-col items-center gap-2">
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
                    className="rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
                  >
                    Restart
                  </button>
                </>
              ) : (
                <button
                  onClick={startGame}
                  className="rounded-full bg-white/10 px-5 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  Start
                </button>
              )}
            </div>
          )}
        </div>

        {/* Touch D-pad — shown on phones/small screens always, and on
            larger screens when the player opts in via the toggle below.
            Kept in the same column as the board so it stays directly under
            it even if the side panel wraps below on narrow/zoomed layouts.
            Sized to its own content (not tied to the board's pixel width)
            so it neither squishes when the board is small nor spreads its
            edges off-screen when the board is huge — `mx-auto` centers it
            under the board independently either way. */}
        <div
          className={`mx-auto flex shrink-0 items-center ${showDesktopDpad ? "" : "sm:hidden"}`}
          style={{ gap: padGap * 2 }}
        >
          <div
            className="grid shrink-0 grid-cols-3 grid-rows-2"
            style={{ gap: padGap }}
          >
            <button
              onClick={() => tryRotate("ccw")}
              aria-label="Rotate counterclockwise"
              style={{ width: padBtn, height: padBtn }}
              className="col-start-1 row-start-1 shrink-0 touch-manipulation rounded-full bg-white/10 text-xl text-white ring-1 ring-white/15 backdrop-blur-sm active:bg-white/25"
            >
              ⟲
            </button>
            <button
              onClick={() => tryRotate("cw")}
              aria-label="Rotate clockwise"
              style={{ width: padBtn, height: padBtn }}
              className="col-start-2 row-start-1 shrink-0 touch-manipulation rounded-full bg-white/10 text-xl text-white ring-1 ring-white/15 backdrop-blur-sm active:bg-white/25"
            >
              ⟳
            </button>
            <button
              onClick={() => tryMove(-1, 0)}
              aria-label="Move left"
              style={{ width: padBtn, height: padBtn }}
              className="col-start-1 row-start-2 shrink-0 touch-manipulation rounded-full bg-white/10 text-xl text-white ring-1 ring-white/15 backdrop-blur-sm active:bg-white/25"
            >
              ◀
            </button>
            <button
              onClick={softDrop}
              aria-label="Soft drop"
              style={{ width: padBtn, height: padBtn }}
              className="col-start-2 row-start-2 shrink-0 touch-manipulation rounded-full bg-white/10 text-xl text-white ring-1 ring-white/15 backdrop-blur-sm active:bg-white/25"
            >
              ▼
            </button>
            <button
              onClick={() => tryMove(1, 0)}
              aria-label="Move right"
              style={{ width: padBtn, height: padBtn }}
              className="col-start-3 row-start-2 shrink-0 touch-manipulation rounded-full bg-white/10 text-xl text-white ring-1 ring-white/15 backdrop-blur-sm active:bg-white/25"
            >
              ▶
            </button>
          </div>

          <button
            onClick={hardDrop}
            aria-label="Hard drop"
            style={{ width: padBtn, height: padBtn }}
            className="shrink-0 touch-manipulation rounded-full bg-[#ff5e9c]/15 text-sm font-medium text-white ring-1 ring-[#ff5e9c]/40 backdrop-blur-sm active:bg-[#ff5e9c]/30"
          >
            Drop
          </button>
        </div>
        </div>

        <div className="flex w-32 flex-col gap-4 font-body text-white/80 sm:w-40">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/40">
            Next
          </div>
          <canvas
            ref={nextCanvasRef}
            width={previewPx}
            height={previewPx}
            className="mt-1 rounded-lg bg-black/40 ring-1 ring-white/10"
          />
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-white/40">
            Score
          </div>
          <div className="font-heading text-xl text-white">{score}</div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-white/40">
            Lines
          </div>
          <div className="font-heading text-xl text-white">{lines}</div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-white/40">
            Level
          </div>
          <div className="font-heading text-xl text-white">{level}</div>
        </div>

        <button
          onClick={togglePause}
          disabled={!started || gameOver}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          {paused ? "Resume" : "Pause"}
        </button>

        <div>
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/40">
            <label htmlFor="tetris-size">Board size</label>
            <button
              onClick={() => {
                manualSizeRef.current = false;
                applyFit();
              }}
              className="normal-case text-white/50 underline underline-offset-2 hover:text-white/80"
            >
              Default
            </button>
          </div>
          <input
            id="tetris-size"
            type="range"
            min={MIN_CELL}
            max={MAX_CELL}
            value={cellSize}
            onChange={(e) => {
              manualSizeRef.current = true;
              setCellSize(Number(e.target.value));
            }}
            className="mt-1 w-full accent-[#ff5e9c]"
          />
        </div>

          <button
            onClick={() => setShowDesktopDpad((prev) => !prev)}
            className="hidden items-center justify-between text-xs uppercase tracking-wide text-white/50 underline underline-offset-2 hover:text-white/80 sm:flex"
          >
            {showDesktopDpad ? "Hide D-pad" : "Show D-pad"}
          </button>

          <p className="hidden text-xs text-white/40 sm:block">
            ← → / A D move · ↓ / S soft drop · ↑ / W rotate CW · Q rotate CCW
            · space hard drop · P pause
          </p>

          <div>
            <Link
              href="/games/leaderboard?game=tetris"
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
