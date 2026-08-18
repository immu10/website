// Server-only: which env-var-gated features are missing their config right
// now. Purely diagnostic, used by <EnvWarningBadge> — not a security check,
// just a "did I forget to set something" reminder for the site owner.

const FEATURES = [
  {
    label: "Spotify",
    vars: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN"],
  },
  { label: "Steam", vars: ["STEAM_API_KEY", "STEAM_ID"] },
  { label: "TMDB", vars: ["TMDB_API_KEY"] },
  {
    label: "Redis (leaderboard)",
    vars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  },
  { label: "Postgres (login)", vars: ["DATABASE_URL"] },
  { label: "Session signing", vars: ["AUTH_SECRET"] },
  { label: "Backup cron", vars: ["CRON_SECRET"] },
];

// Returns [] when everything needed is set — the common case.
export function getMissingEnvFeatures() {
  return FEATURES.filter((f) => f.vars.some((v) => !process.env[v])).map(
    (f) => ({
      label: f.label,
      missing: f.vars.filter((v) => !process.env[v]),
    })
  );
}
