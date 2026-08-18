// app/api/games/tetris/leaderboard/route.js  ->  GET /api/games/tetris/leaderboard
//
// Public top-10 read. Only ever returns name + score — the IP recorded per
// entry (see the score route) never leaves Redis through this or any other
// response. The underlying Redis read is cached (see lib/leaderboard.js) so
// this route can be hit freely without each request costing a Redis call.

import { getLeaderboard } from "../../../../lib/leaderboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getLeaderboard("tetris", 10);
  return Response.json(data);
}
