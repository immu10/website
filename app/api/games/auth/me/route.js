// app/api/games/auth/me/route.js  ->  GET /api/games/auth/me
// Lets the client check login state on page load. No DB hit — verifying
// the session cookie is just a signature + expiry check.

import { getSession } from "@/app/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  return Response.json({
    loggedIn: Boolean(session),
    username: session?.username ?? null,
  });
}
