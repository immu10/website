// Shared between the client (TypewriterGame.js, for instant UX feedback) and
// the score API route (the authoritative check). No React/Next imports here
// so it's safe to pull into either. Mirrors app/games/tetris/leaderboardRules.js
// — same anti-cheat shape, recalibrated for this game's scoring.

// A session token (see /api/games/typewriter/session) is valid for this
// long. Generous on purpose: someone can leave the tab open and pause for
// hours without their eventual legit submission getting rejected as
// "expired." This is a temporary, single-session-only anti-cheat measure —
// real multi-day pausing is meant to wait for an actual login system.
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

// Reject anything submitted faster than this — no real game ends this fast.
export const MIN_ELAPSED_SECONDS = 5;

// One completed word tops out around length*10 + 50 (max streak bonus) —
// even a long tier-3 word (~11 letters) with a maxed streak is only ~160
// points. A generous ceiling assumes sustained play far faster than most
// humans could realistically keep up (see the WPM-vs-level discussion this
// was tuned against): roughly 2 words/sec sustained, worth ~300 points/sec.
// Flattens out after ~25 minutes so a long-paused/idle session isn't
// penalized once the ceiling's already maxed out either way.
const POINTS_PER_SECOND_CEILING = 300;
const BASE_ALLOWANCE = 300;
const MAX_SCORE_CEILING = 450_000;

export function maxPlausibleScore(elapsedSeconds) {
  return Math.min(
    MAX_SCORE_CEILING,
    BASE_ALLOWANCE + POINTS_PER_SECOND_CEILING * Math.max(0, elapsedSeconds)
  );
}
