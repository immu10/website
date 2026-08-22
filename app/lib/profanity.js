// Server-side name validation for leaderboard entries. Must run on the
// server (not just the client) since the API route can be hit directly.

import { Filter } from "bad-words";

const filter = new Filter();
// bad-words does whole-word matching against its own list, which misses
// short slur abbreviations that aren't literal entries in that list (e.g.
// "nig" — the full "nigger"/"nigga" spellings and l33t variants ARE
// covered, this shorthand wasn't). Extend it here as gaps are found; a
// word-list filter is inherently whack-a-mole, not a complete solution.
filter.addWords("nig", "smegmanuel");

const NAME_PATTERN = /^[A-Za-z0-9 _-]{1,16}$/;

// Shared with validateUsername in auth.js — an account's username is used
// as its leaderboard display name (see the score route), so it needs the
// same profanity check as free-text guest names or it bypasses the filter.
export function isProfane(text) {
  return filter.isProfane(text);
}

// Returns { ok: true, name } or { ok: false, reason }.
export function validateName(raw) {
  const name = typeof raw === "string" ? raw.trim() : "";

  if (name.length < 1 || name.length > 16) {
    return { ok: false, reason: "Name must be 1-16 characters." };
  }
  if (!NAME_PATTERN.test(name)) {
    return { ok: false, reason: "Letters, numbers, spaces, - and _ only." };
  }
  if (isProfane(name)) {
    return { ok: false, reason: "Cmon this is on my portfolio." };
  }

  return { ok: true, name };
}
