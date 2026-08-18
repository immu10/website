"use client";
// Shared auth state + login-modal state for everything under /games. One
// provider (see layout.js) means the nav's AuthWidget and Tetris's
// game-over "log in?" prompt both read/write the exact same state — logging
// in from either place is immediately reflected everywhere, and both can
// open the same modal instead of each having their own private copy.

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

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

  return (
    <AuthContext.Provider
      value={{ loggedIn, username, loading, refresh, modalOpen, setModalOpen }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
