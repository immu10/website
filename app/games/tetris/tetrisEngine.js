// Pure game-logic helpers for Tetris — no rendering, no React.
// Kept separate from TetrisGame.js so the rules can be unit-tested/reused
// independently of the canvas drawing code.

export const COLS = 10;
export const ROWS = 20;

// Each shape is given in its "spawn" rotation; rotate() derives the rest.
export const SHAPES = {
  I: {
    color: "#4dd8f7",
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  O: {
    color: "#f7d64d",
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    color: "#c084fc",
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  S: {
    color: "#4ade80",
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  Z: {
    color: "#f87171",
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
  J: {
    color: "#60a5fa",
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  L: {
    color: "#fb923c",
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
};

export const PIECE_TYPES = Object.keys(SHAPES);

export function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

// 7-bag randomizer: shuffles one of each piece per bag so droughts of a
// given piece can't happen, matching standard modern Tetris behaviour.
export function makeBag() {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function rotateMatrix(matrix) {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]).reverse());
}

export function spawnPosition(matrix) {
  return { x: Math.floor((COLS - matrix[0].length) / 2), y: 0 };
}

export function collides(board, matrix, pos) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const boardX = pos.x + x;
      const boardY = pos.y + y;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

export function merge(board, matrix, pos, color) {
  const next = board.map((row) => row.slice());
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const boardY = pos.y + y;
      const boardX = pos.x + x;
      if (boardY >= 0) next[boardY][boardX] = color;
    }
  }
  return next;
}

export function clearLines(board) {
  const kept = board.filter((row) => row.some((cell) => !cell));
  const cleared = ROWS - kept.length;
  const empty = Array.from({ length: cleared }, () => Array(COLS).fill(null));
  return { board: [...empty, ...kept], cleared };
}

const LINE_SCORES = [0, 100, 300, 500, 800];

export function scoreForLines(cleared, level) {
  return (LINE_SCORES[cleared] || 0) * level;
}

export function dropIntervalForLevel(level) {
  // Gentle curve: starts at ~800ms, speeds up each level, floors at 100ms.
  return Math.max(100, 800 - (level - 1) * 60);
}
