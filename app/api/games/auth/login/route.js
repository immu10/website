// app/api/games/auth/login/route.js  ->  POST /api/games/auth/login
//
// Rate-limited on purpose — this is the actual brute-force target in this
// system (register/score endpoints have their own limits for their own
// reasons, but a login endpoint that lets you test unlimited username-
// password guesses is the classic hole).

import {
  verifyCredentials,
  validateUsername,
  setSessionCookie,
  dbConfigured,
} from "../../../../lib/auth";
import { checkRateLimit } from "../../../../lib/ratelimit";
import { getClientIp } from "../../../../lib/ip";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!dbConfigured()) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const ip = getClientIp(request);
  const allowed = await checkRateLimit("auth-login", ip, 10, "1 m");
  if (!allowed) {
    return Response.json(
      { error: "Too many attempts, try again later." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const usernameCheck = validateUsername(body?.username);
  if (!usernameCheck.ok || typeof body?.password !== "string") {
    return Response.json(
      { error: "Invalid username or password." },
      { status: 400 }
    );
  }

  const result = await verifyCredentials(usernameCheck.username, body.password);
  if (!result.ok) {
    // Distinguishing these isn't a meaningful enumeration risk — usernames
    // are already public (the leaderboard display name) — and it powers
    // the "that account doesn't exist, want to create it?" prompt.
    const message =
      result.reason === "no-user"
        ? "No account with that username."
        : "Wrong password.";
    return Response.json(
      { error: message, reason: result.reason },
      { status: 401 }
    );
  }

  await setSessionCookie(
    result.userId,
    usernameCheck.username,
    Boolean(body?.rememberMe)
  );
  return Response.json({ ok: true, username: usernameCheck.username });
}
