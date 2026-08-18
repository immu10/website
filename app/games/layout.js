// Wraps every /games/* page in the shared auth + login-modal state (see
// AuthContext.js) — nothing visual here, just makes useAuth() available to
// any page/component under /games, so e.g. Tetris's game-over screen and
// the nav's AuthWidget share one login state and one modal.

import { AuthProvider } from "./AuthContext";

export default function GamesLayout({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
