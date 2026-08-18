// Account logic for the games-scoped login system: register, verify
// credentials, and read the current session. Deliberately minimal — one
// credentials-only account type, no OAuth, no email verification. See
// db/schema.sql for the table and session.js for the cookie mechanism.

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb, dbConfigured } from "./db";
import {
  SESSION_COOKIE,
  createSessionValue,
  verifySessionValue,
  REMEMBER_ME_SECONDS,
  DEFAULT_SESSION_SECONDS,
} from "./session";

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;
const MAX_PASSWORD_LENGTH = 72; // bcrypt silently truncates past this

export function validateUsername(raw) {
  const username = typeof raw === "string" ? raw.trim() : "";
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      reason: "3-20 characters: letters, numbers, - and _ only.",
    };
  }
  return { ok: true, username };
}

export function validatePassword(raw) {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, reason: "Password can't be empty." };
  }
  if (raw.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: "Password is too long." };
  }
  return { ok: true, password: raw };
}

export async function registerUser(username, password) {
  const sql = getDb();
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const rows = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username}, ${passwordHash})
      RETURNING id
    `;
    return { ok: true, userId: rows[0].id };
  } catch (e) {
    // Postgres unique_violation
    if (e.code === "23505") {
      return { ok: false, reason: "That username is taken." };
    }
    throw e;
  }
}

// Returns { ok: true, userId } | { ok: false, reason: "no-user" | "bad-password" }.
// Distinguishing the two isn't a meaningful enumeration risk here — usernames
// are already public (they're the leaderboard display name), so there's no
// secret being protected by a generic error message.
export async function verifyCredentials(username, password) {
  const sql = getDb();
  const rows = await sql`
    SELECT id, password_hash FROM users WHERE username = ${username}
  `;
  if (rows.length === 0) return { ok: false, reason: "no-user" };

  const match = await bcrypt.compare(password, rows[0].password_hash);
  if (!match) return { ok: false, reason: "bad-password" };

  await sql`UPDATE users SET last_login = now() WHERE id = ${rows[0].id}`;
  return { ok: true, userId: rows[0].id };
}

export async function setSessionCookie(userId, username, rememberMe) {
  const maxAge = rememberMe ? REMEMBER_ME_SECONDS : DEFAULT_SESSION_SECONDS;
  const value = createSessionValue(userId, username, maxAge);
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/games",
    maxAge,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/games" });
}

// Returns { userId, username } or null. dbConfigured() isn't checked here —
// verifying a signed cookie needs no DB access at all.
export async function getSession() {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionValue(value);
}

export { dbConfigured };
