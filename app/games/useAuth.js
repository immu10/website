"use client";
// Shared login-state hook for anything under /games — checks the session
// cookie via /api/games/auth/me (no DB hit server-side, just a signature
// check) and exposes a refresh() to call after login/register/logout.

import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/games/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setLoggedIn(Boolean(data.loggedIn));
        setUsername(data.username ?? null);
      })
      .catch(() => {
        setLoggedIn(false);
        setUsername(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Checking login state needs a network round-trip, so this has to run
    // post-mount rather than as initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { loggedIn, username, loading, refresh };
}
