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
    slug: "musicrunner",
    title: "Beat Runner",
    description: "Free-flight up/down runner, procedurally generated from the track.",
  },
  {
    slug: "beatdash",
    title: "Beat Dash",
    description: "Ground-based jump runner, procedurally generated from the track.",
  },
  {
    slug: "beatviz",
    title: "Beat Viz",
    description: "Not a game yet — live audio-reactive cube, no map generation.",
  },
];
