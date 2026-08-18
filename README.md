# immu10.com

My personal site — built with Next.js (App Router) and Tailwind CSS, deployed on
Vercel at [immu10.com](https://immu10.com).

## Features

- Animated WebGL water background + canvas "marine snow" particles, with a
  flash-free **dark mode** (defaults to dark, remembers your choice).
- **/home** — landing page (`/` redirects here).
- **/aboutme** — a centered intro plus a live "showcase" of what I'm into:
  - **Music** — Spotify *now playing* + *top tracks* (live).
  - **Games** — Steam *most played* (live), with a couple of picks pinned.
  - **Shows / Movies** — posters via TMDB (covers anime, kdramas, movies).
  - **Manhwas** — covers via AniList (no key needed).
  - Any section whose data source is unconfigured or failing shows a small
    ⚠ next to its heading, plus one banner if anything's off.
- **/projects** — auto-pulled from GitHub (every public, owned, non-fork repo
  with a README). Falls back to a cached snapshot with a warning banner if
  the live GitHub fetch fails.
- **/cv** — a custom PDF viewer for my CV, with download / open-in-tab.
- **/games** — minigames, listed as tiles:
  - **Tetris** — resizable board (auto-fits the viewport, manually adjustable),
    a touch D-pad on phones, and a **leaderboard**.
  - **/games/leaderboard** — top scores per game (dropdown to switch games),
    backed by Upstash Redis. Submissions go through a server-issued,
    one-time-use session token so the score is checked against how much time
    could plausibly have passed, not just trusted from the client.
  - **Login** (scoped to `/games` only — never affects the rest of the site):
    lightweight username/password accounts (no email) that give a leaderboard
    entry a stable identity — resubmitting updates your one entry instead of
    creating a duplicate, and it only ever moves up (a worse re-submission is
    ignored). Anonymous free-text-name submissions still work side by side;
    guest entries are marked with a small icon on the leaderboard.

## Reliability

- `/projects` fetches live from the GitHub API. If that fails (expired
  token, rate limit, outage), it falls back to the last good snapshot in
  `app/data/projects-snapshot.json` and shows a "showing cached version"
  banner instead of an empty page.
- `.github/workflows/refresh-projects-snapshot.yml` refreshes that
  snapshot daily, only overwriting it when the fetch actually succeeds.
- `.github/workflows/health-check.yml` polls `/api/health` every 6 hours
  (GitHub token auth + each configured live widget) and opens a GitHub
  issue — which emails the repo owner — if something's actually broken.
- Leaderboard reads are cached (`revalidate: 60`) so traffic can't drive
  Redis usage past the free tier — at most one real read per game per minute,
  everyone else gets the cached snapshot.
- `/api/cron/leaderboard-backup` runs daily (see `vercel.json`), snapshotting
  each game's top 100 into a separate dated Redis key with a 30-day TTL — no
  git commits, no redeploys, just self-expiring backups in the same Redis
  instance. Restore with `scripts/restore-leaderboard-backup.js` if ever
  needed (manual, on purpose — see the script's header comment).
- A small badge (top-right, only visible when something's actually missing)
  flags forgotten env vars across every feature — see
  `app/components/EnvWarningBadge.js`.

## Getting started

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Environment variables

The showcase integrations need API keys. Copy the example and fill it in:

```bash
cp .env.local.example .env.local
```

| Variable | Used by | Where to get it |
| --- | --- | --- |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `SPOTIFY_REFRESH_TOKEN` | Music | [Spotify dashboard](https://developer.spotify.com/dashboard); refresh token via `/api/spotify/login` |
| `STEAM_API_KEY` / `STEAM_ID` | Games | [Steam Web API key](https://steamcommunity.com/dev/apikey) + your steamID64 (profile must be public) |
| `TMDB_API_KEY` | Shows / Movies | [TMDB API settings](https://www.themoviedb.org/settings/api) ("API Key v3 auth") |
| `GITHUB_TOKEN` | Projects | [GitHub tokens](https://github.com/settings/tokens) (classic, no scopes needed). Optional — without it you're on the 60 req/hr public limit instead of 5000/hr, and `/api/health` will flag it as unauthenticated. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Games leaderboard | [Upstash](https://upstash.com) free Redis DB (or the Vercel Marketplace "Upstash" add-on) — REST URL + token from the DB's dashboard |
| `DATABASE_URL` | Games login | [Neon](https://neon.tech) free Postgres DB (or the Vercel Marketplace "Neon" add-on) — pooled connection string. Run `db/schema.sql` once against it (Neon console → SQL Editor) before first use. |
| `AUTH_SECRET` | Games login | Any long random string (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) — signs session cookies, not from any dashboard |
| `CRON_SECRET` | Leaderboard backup cron | Any long random string — Vercel sends it automatically as the cron request's `Authorization` header when set, which is how the backup route tells a real scheduled run apart from a random hit on the same path |

AniList (Manhwas) needs no key. See `.env.local.example` for step-by-step notes.
For production, add the same variables in **Vercel → Settings → Environment
Variables**, then redeploy.

## Project structure

```
app/
  api/            route handlers for the integrations
    spotify/  steam/  tmdb/  anilist/
    games/        tetris/{session,score,leaderboard}, auth/{register,login,logout,me}
    cron/         leaderboard-backup (daily snapshot, see vercel.json)
  components/
    showcase/     NowPlaying, TopTracks, SteamGames, ShowsMovies, ManhwaList
    background/   CausticsCanvas, BubbleField, WaterBackground
    DarkToggle.js, CVViewer.js, EnvWarningBadge.js
  games/
    gamesList.js        shared game registry (tile list + leaderboard picker)
    AuthWidget.js, useAuth.js, GuestIcon.js
    tetris/              the game itself + its engine/rules
    leaderboard/          /games/leaderboard page + game picker
  lib/            shared helpers — spotify token, redis, db (Postgres), auth,
                  session cookies, profanity filter, rate limiting, leaderboard
  home/  aboutme/  projects/  cv/  games/   page routes
db/
  schema.sql      run once against Postgres (see Environment variables)
scripts/
  hash-password.js               manual password reset (no email flow exists)
  restore-leaderboard-backup.js  manual restore from a daily Redis backup
```

## Deployment

- **`prod`** is the branch Vercel deploys (the live site). It carries one clean
  snapshot per release.
- **`master`** is the working branch (full history).
- A Vercel Firewall rate-limit rule (dashboard-only, not in code) caps
  `/api/games/*` at 100 requests/min per IP — the outer layer in front of the
  app-level rate limiting in `app/lib/ratelimit.js`.

A pre-commit hook (`.githooks/pre-commit` → `scripts/check-cv.js`) blocks commits
if a phone number is detected in `public/cv.pdf`. Enable hooks on a fresh clone:

```bash
git config core.hooksPath .githooks
```
