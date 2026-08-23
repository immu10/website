// Pure game-logic helpers for Typewriter — no rendering, no React.
// Kept separate from TypewriterGame.js so the rules can be unit-tested/reused
// independently of the canvas drawing code.

export const BOARD_W = 760;
export const BOARD_H = 460;
export const DANGER_Y = BOARD_H - 34;

export const INITIAL_LIVES = 5;
export const WORDS_PER_LEVEL = 8;

// Tiered word bank — easy/short words dominate early levels, longer words mix
// in as the level climbs (see pickWord below).
const TIER1 = [
  "cat", "dog", "run", "sun", "fox", "key", "map", "pen", "top", "zip",
  "arm", "bat", "cup", "day", "fan", "hat", "ink", "jam", "log", "mud",
  "oak", "rat", "sea", "van", "web", "zoo", "bed", "car", "fish", "frog",
  "goat", "hive", "lime", "moon", "nest", "pear", "quiz", "rock", "star",
  "tree", "vent", "wolf", "yarn", "ant", "bee", "cow", "elk", "gum", "hen",
  "ice", "jet", "kid", "lid", "mix", "nap", "owl", "pig", "rib", "sky",
  "tan", "urn", "vet", "wax", "yak", "zap", "bike", "cake", "desk", "farm",
  "gold", "hill", "iron", "jazz", "kite", "lock", "milk", "node", "oven", 
  "pill", "quit", "ring", "sand", "tent", "unit", "vase", "wind", "yolk",
  "zone", "atom", "book", "corn", "dish", "echo", "flag", "glue", "harp",
  "iris", "jury", "king", "lava", "mint", "note", "palm", "quilt", "road",
  "salt", "tide", "urge", "vine", "wave", "yard", "zest",
];

const TIER2 = [
  "planet", "garden", "yellow", "monkey", "bridge", "castle", "forest",
  "hunter", "jacket", "kitten", "laptop", "magnet", "napkin", "orange",
  "pencil", "rabbit", "sailor", "tunnel", "umpire", "violet", "window",
  "zombie", "basket", "camera", "dragon", "engine", "fabric", "guitar",
  "hazard", "island", "jungle", "kettle", "lizard", "market",
  "animal", "beacon", "canyon", "dolphin", "eleven", "factory", "galaxy",
  "harbor", "impulse", "jester", "kingdom", "ladder", "meadow", "nectar",
  "oyster", "pirate", "quarter", "rocket", "sunset", "temple", "unicorn",
  "velvet", "walnut", "yonder", "zephyr", "autumn", "bakery", "cactus",
  "diamond", "empire", "falcon", "glacier", "helmet", "ignite", "jaguar",
  "keeper", "lumber", "mirror", "novelty", "pepper", "quartz", "raptor",
  "silver", "thunder", "utopia", "vessel", "warrior", "yogurt", "zealot",
];

const TIER3 = [
  "adventure", "butterfly", "chocolate", "dangerous", "education",
  "fantastic", "gathering", "happiness", "important", "knowledge",
  "landscape", "marvelous", "necessary", "operation", "parachute",
  "quicksand", "reference", "strategy", "telephone", "universe",
  "volunteer", "wonderful", "xylophone", "yesterday", "algorithm",
  "beautiful", "celebrate", "discovery", "elephant",
  "chemistry", "direction", "encounter", "framework", "guardian",
  "historian", "illusion", "judgment", "kilometer", "lightning",
  "mountains", "narrative", "obedience", "philosophy", "quotation",
  "radiation", "sanctuary", "telescope", "umbrella", "ventilate",
  "wilderness", "yesteryear", "zoologist", "ambitious", "boundary",
  "curiosity", "discipline", "evacuate", "forgotten", "grateful",
  "harmonica", "inspiration", "journalist",
];

// Weighted tier pool per level — earlier levels lean easy, later ones mix in
// longer words without ever fully dropping the short ones.
function tierWeightsForLevel(level) {
  if (level <= 2) return [[TIER1, 1]];
  if (level <= 4) return [[TIER1, 0.7], [TIER2, 0.3]];
  if (level <= 6) return [[TIER1, 0.4], [TIER2, 0.4], [TIER3, 0.2]];
  return [[TIER1, 0.2], [TIER2, 0.4], [TIER3, 0.4]];
}

function pickTier(level) {
  const weights = tierWeightsForLevel(level);
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [tier, w] of weights) {
    if (roll < w) return tier;
    roll -= w;
  }
  return weights[weights.length - 1][0];
}

// Avoids spawning a word that's already falling on screen (ambiguous/unfair
// duplicate targets) — retries a few times, then just gives up and allows it.
export function pickWord(level, activeTexts = []) {
  for (let i = 0; i < 5; i++) {
    const tier = pickTier(level);
    const word = tier[Math.floor(Math.random() * tier.length)];
    if (!activeTexts.includes(word)) return word;
  }
  const tier = pickTier(level);
  return tier[Math.floor(Math.random() * tier.length)];
}

export function levelForWordsTyped(count) {
  return Math.floor(count / WORDS_PER_LEVEL) + 1;
}

// Logical px/sec the words fall at.
export function fallSpeedForLevel(level) {
  return 38 + (level - 1) * 9;
}

// ms between spawns.
export function spawnIntervalForLevel(level) {
  return Math.max(650, 2400 - (level - 1) * 180);
}

const MAX_STREAK_BONUS = 10;

export function scoreForWord(word, streak) {
  return word.length * 10 + Math.min(streak, MAX_STREAK_BONUS) * 5;
}

export function wpmFromChars(correctChars, elapsedMs) {
  const minutes = elapsedMs / 60000;
  if (minutes <= 0) return 0;
  return Math.round(correctChars / 5 / minutes);
}
