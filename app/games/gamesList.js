// Shared game registry — used by the /games tile list and the
// /games/leaderboard game-picker dropdown, so adding a new game only means
// adding one entry here (plus its own folder + leaderboard-writing route).

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
];
