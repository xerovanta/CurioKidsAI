export const LEVELS = {
  memoryMatch: {
    1: { name: "Baby Learner", grid: "2x2", pairs: 2, timeLimit: 0, hints: 3, starsToUnlock: 0 },
    2: { name: "Toddler Thinker", grid: "2x3", pairs: 3, timeLimit: 60, hints: 2, starsToUnlock: 10 },
    3: { name: "Little Genius", grid: "3x4", pairs: 6, timeLimit: 90, hints: 1, starsToUnlock: 25 },
    4: { name: "Memory Master", grid: "4x4", pairs: 8, timeLimit: 120, hints: 0, starsToUnlock: 50 },
    5: { name: "Brain Champion", grid: "4x5", pairs: 10, timeLimit: 150, hints: 0, starsToUnlock: 100 }
  },
  wordRepeat: {
    1: { name: "First Words", wordLength: "3-4 letters", categories: ["animals"], accuracyThreshold: 60, starsToUnlock: 0 },
    2: { name: "Word Builder", wordLength: "4-5 letters", categories: ["animals","fruits"], accuracyThreshold: 70, starsToUnlock: 10 },
    3: { name: "Sentence Starter", wordLength: "5-6 letters", categories: ["animals","fruits","objects"], accuracyThreshold: 80, starsToUnlock: 25 },
    4: { name: "Pronunciation Pro", wordLength: "6+ letters", categories: ["all"], accuracyThreshold: 90, starsToUnlock: 50 },
    5: { name: "Vocabulary Champion", wordLength: "all", categories: ["all"], accuracyThreshold: 95, starsToUnlock: 100 }
  },
  airDraw: {
    1: { name: "Scribbler", shapes: ["circle"], tolerance: 40, timeLimit: 30, starsToUnlock: 0 },
    2: { name: "Shape Explorer", shapes: ["circle","square"], tolerance: 35, timeLimit: 25, starsToUnlock: 15 },
    3: { name: "Line Artist", shapes: ["circle","square","triangle"], tolerance: 30, timeLimit: 20, starsToUnlock: 30 },
    4: { name: "Geometry Pro", shapes: ["circle","square","triangle","star"], tolerance: 25, timeLimit: 15, starsToUnlock: 60 },
    5: { name: "Shape Master", shapes: ["circle","square","triangle","star","heart"], tolerance: 20, timeLimit: 10, starsToUnlock: 120 }
  },
  alphabetGrab: {
    1: { name: "Letter Spotter", questionTypes: ["after"], numOptions: 3, speed: "slow", starsToUnlock: 0 },
    2: { name: "Alphabet Explorer", questionTypes: ["after","before"], numOptions: 4, speed: "slow", starsToUnlock: 10 },
    3: { name: "Letter Hunter", questionTypes: ["after","before","missing"], numOptions: 5, speed: "medium", starsToUnlock: 30 },
    4: { name: "Word Builder", questionTypes: ["after","before","missing","spell"], numOptions: 6, speed: "fast", starsToUnlock: 60 },
    5: { name: "Alphabet Champion", questionTypes: ["all"], numOptions: 6, speed: "very fast", starsToUnlock: 100 }
  }
};

/**
 * Returns the level configuration object for a specific game and level.
 * @param {string} gameType - The game type (e.g., 'memoryMatch')
 * @param {number|string} level - The level number
 * @returns {object|null}
 */
export function getLevelConfig(gameType, level) {
  const gameLevels = LEVELS[gameType];
  if (!gameLevels) return null;
  return gameLevels[level] || null;
}

/**
 * Returns the required stars to unlock the next level.
 * @param {string} gameType - The game type (e.g., 'memoryMatch')
 * @param {number|string} currentLevel - The current level number
 * @returns {number} Required stars, or Infinity if there is no next level
 */
export function getNextLevelStars(gameType, currentLevel) {
  const gameLevels = LEVELS[gameType];
  if (!gameLevels) return Infinity;
  const nextLevel = parseInt(currentLevel, 10) + 1;
  const nextConfig = gameLevels[nextLevel];
  return nextConfig ? nextConfig.starsToUnlock : Infinity;
}
