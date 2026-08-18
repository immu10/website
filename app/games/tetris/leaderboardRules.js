// Shared between the client (TetrisGame.js, for instant UX feedback) and
// the score API route (the authoritative check). No React/Next imports here
// so it's safe to pull into either.

// A session token (see /api/games/tetris/session) is valid for this long.
// Generous on purpose: someone can leave the tab open and pause for hours
// without their eventual legit submission getting rejected as "expired."
// This is a temporary, single-session-only anti-cheat measure — real
// multi-day pausing is meant to wait for an actual login system.
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

// Reject anything submitted faster than this — no real game ends this fast.
export const MIN_ELAPSED_SECONDS = 5;

// Generous upper bound on "how many points could a human possibly have
// scored in this many seconds," used to catch obviously fabricated scores
// (e.g. a huge number seconds after starting). Not meant to be tight or
// precise — line-clear scoring and drop speed both plateau in this game, so
// the bound flattens out at MAX_SCORE_CEILING after ~35 minutes regardless
// of how much more time passes, which is intentional (see the Tetris
// leaderboard planning discussion): it means a long-paused/idle session
// isn't penalized, since the ceiling is already maxed out either way.
const POINTS_PER_SECOND_CEILING = 250;
const BASE_ALLOWANCE = 500;
const MAX_SCORE_CEILING = 500_000;

export function maxPlausibleScore(elapsedSeconds) {
  return Math.min(
    MAX_SCORE_CEILING,
    BASE_ALLOWANCE + POINTS_PER_SECOND_CEILING * Math.max(0, elapsedSeconds)
  );
}
