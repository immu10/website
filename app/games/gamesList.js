// Shared game registry — drives the /games tile list. Adding a new game
// means one entry here (plus its own folder + leaderboard-writing route).

export const GAMES = [
  {
    slug: "tetris",
    title: "Tetris",
    description: "The block game.",
    thumbnail: "/games/tetris-thumb.png",
  },
  {
    slug: "typewriter",
    title: "Typewriter",
    description: "Type the falling words before they escape.",
    thumbnail: "/games/typewriter-thumb.png",
  },
  {
    slug: "asteroids",
    title: "Asteroids",
    description: "Rotate, thrust, and blast rocks before they blast you.",
    thumbnail: "/games/asteroids-thumb.png",
  },
];

// Separate from GAMES: drives the /games/leaderboard picker instead of the
// tile grid. One tile can have more than one leaderboard category — Classic
// and Chase score completely differently (kills vs. distance/bosses), so
// they're kept as two separate boards rather than mixed on one.
export const LEADERBOARDS = [
  { slug: "tetris", title: "Tetris" },
  { slug: "typewriter", title: "Typewriter" },
  { slug: "asteroids-classic", title: "Asteroids — Classic" },
  { slug: "asteroids-chase", title: "Asteroids — Chase" },
];
