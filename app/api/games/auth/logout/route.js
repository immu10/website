// app/api/games/auth/logout/route.js  ->  POST /api/games/auth/logout

import { clearSessionCookie } from "@/app/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
