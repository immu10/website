// Server Component — reads env vars directly, so it never ships anything
// secret to the client. Renders nothing when everything's configured (the
// normal case for real visitors); only appears when a feature is actually
// missing its env vars, same "only show up when something's wrong" idea as
// the stale-data warning on /projects. Deliberately just a flag, not a list
// of specifics — check the server logs/dashboard for which one.

import { getMissingEnvFeatures } from "../lib/envCheck";

export default function EnvWarningBadge() {
  if (getMissingEnvFeatures().length === 0) return null;

  return (
    <div
      className="fixed z-50 flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-4 py-3 font-body text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30 backdrop-blur-sm"
      style={{ top: "4.5rem", right: "1rem" }}
    >
      <span aria-hidden="true">⚠</span> Missing envs
    </div>
  );
}
