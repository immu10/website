// Shared between the client (AsteroidsGame.js, for instant UX feedback) and
// the score API route (the authoritative check). No React/Next imports here
// so it's safe to pull into either. Mirrors
// app/games/typewriter/leaderboardRules.js — same anti-cheat shape,
// recalibrated for this game's scoring.

// A session token (see /api/games/asteroids/session) is valid for this
// long — see typewriter's version of this file for the full reasoning
// (generous on purpose, temporary single-session-only anti-cheat measure).
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

// Reject anything submitted faster than this — no real game ends this fast.
export const MIN_ELAPSED_SECONDS = 5;

// Destroying a small asteroid (100 pts) is the fastest points come in, and
// even a very good player can't chain more than a few kills per second
// (asteroids spawn from wave clears, not on demand, and splitting a large
// one down to smalls takes multiple hits). Chase mode adds a modest
// distance-based trickle on top (CHASE_DISTANCE_SCORE_PER_PX); the scroll
// speed it's keyed to is uncapped, but the asteroid density ramps with it
// too, so no realistic run survives long enough to push that trickle past
// where kills already dominate. ~450 pts/sec sustained is already far
// beyond realistic human play in either mode; the ceiling flattens out
// after a while so a long-paused/idle session isn't penalized once it's
// already maxed out. Endless chase runs can go long, so the overall
// ceiling is higher than a single wave-clear session would ever need.
const POINTS_PER_SECOND_CEILING = 450;
const BASE_ALLOWANCE = 300;
const MAX_SCORE_CEILING = 750_000;

export function maxPlausibleScore(elapsedSeconds) {
  return Math.min(
    MAX_SCORE_CEILING,
    BASE_ALLOWANCE + POINTS_PER_SECOND_CEILING * Math.max(0, elapsedSeconds)
  );
}
