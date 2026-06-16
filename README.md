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
- **/projects** — work-in-progress tiles (the next thing to build out).
- **/cv** — a custom PDF viewer for my CV, with download / open-in-tab.

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

AniList (Manhwas) needs no key. See `.env.local.example` for step-by-step notes.
For production, add the same variables in **Vercel → Settings → Environment
Variables**, then redeploy.

## Project structure

```
app/
  api/            route handlers for the integrations
    spotify/  steam/  tmdb/  anilist/
  components/
    showcase/     NowPlaying, TopTracks, SteamGames, ShowsMovies, ManhwaList
    background/   CausticsCanvas, BubbleField, WaterBackground
    DarkToggle.js, CVViewer.js
  lib/            shared helpers (spotify token)
  home/  aboutme/  projects/  cv/   page routes
```

## Deployment

- **`prod`** is the branch Vercel deploys (the live site). It carries one clean
  snapshot per release.
- **`master`** is the working branch (full history).

A pre-commit hook (`.githooks/pre-commit` → `scripts/check-cv.js`) blocks commits
if a phone number is detected in `public/cv.pdf`. Enable hooks on a fresh clone:

```bash
git config core.hooksPath .githooks
```
