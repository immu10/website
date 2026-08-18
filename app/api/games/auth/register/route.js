// app/api/games/auth/register/route.js  ->  POST /api/games/auth/register
//
// Self-serve signup — username + password only, no email verification.
// Sets the same session cookie login does, so registering logs you in.

import {
  registerUser,
  validateUsername,
  validatePassword,
  setSessionCookie,
  dbConfigured,
} from "../../../../lib/auth";
import { checkRateLimit } from "../../../../lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!dbConfigured()) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await checkRateLimit("auth-register", ip, 5, "10 m");
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
  if (!usernameCheck.ok) {
    return Response.json({ error: usernameCheck.reason }, { status: 400 });
  }
  const passwordCheck = validatePassword(body?.password);
  if (!passwordCheck.ok) {
    return Response.json({ error: passwordCheck.reason }, { status: 400 });
  }

  const result = await registerUser(
    usernameCheck.username,
    passwordCheck.password
  );
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 409 });
  }

  await setSessionCookie(
    result.userId,
    usernameCheck.username,
    Boolean(body?.rememberMe)
  );
  return Response.json({ ok: true, username: usernameCheck.username });
}
