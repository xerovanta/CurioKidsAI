import { getLevelConfig } from './levelSystem.js';

/**
 * Calculates the combo multiplier based on the current combo count, capped at 10x.
 * @param {number} currentCombo - The current active combo count
 * @returns {number} The multiplier (1x - 10x)
 */
export function calculateCombo(currentCombo) {
  if (typeof currentCombo !== 'number' || currentCombo <= 0) return 1;
  // Multiplier starts at 1 and increases by 0.5 per combo, capped at 10.
  const multiplier = 1 + (currentCombo * 0.5);
  return Math.min(10, Math.round(multiplier * 10) / 10);
}

/**
 * Generically and specifically calculates stars (0-3) and point breakdown for a game level.
 * @param {string} gameType - The game type (e.g., 'memoryMatch')
 * @param {number|string} level - The level played
 * @param {object} stats - Gameplay stats
 * @param {number} stats.moves - Number of moves or attempts made
 * @param {number} stats.timeTaken - Seconds taken to complete
 * @param {number} stats.accuracy - Accuracy percentage (0-100)
 * @param {number} stats.hintsUsed - Number of hints used
 * @param {number} stats.combo - Peak or ending combo
 * @param {number} stats.streak - Best streak of correct answers
 * @param {boolean} stats.firstTry - Whether it's the first time they completed it
 * @returns {object} { stars, points, breakdown }
 */
export function calculateStars(gameType, level, {
  moves = 0,
  timeTaken = 0,
  accuracy = 100,
  hintsUsed = 0,
  combo = 0,
  streak = 0,
  firstTry = false
} = {}) {
  const config = getLevelConfig(gameType, level) || {};
  let stars = 1; // Base star for completing
  let basePoints = 500;
  let timeBonus = 0;
  let accuracyBonus = 0;
  let streakBonus = 0;
  let firstTryBonus = firstTry ? 200 : 0;

  if (gameType === 'memoryMatch') {
    // Memory Match logic
    const timeLimit = config.timeLimit || 0;
    const underTime = timeLimit === 0 || timeTaken <= timeLimit;
    if (underTime) {
      stars += 1;
      if (timeLimit > 0) {
        timeBonus = Math.max(0, Math.round((timeLimit - timeTaken) * 5));
      } else {
        timeBonus = 100; // Flat speed bonus if no limit
      }
    }

    const pairs = config.pairs || 2;
    const maxEfficientMoves = pairs * 2.5;
    if (hintsUsed <= (config.hints || 0) && moves <= maxEfficientMoves) {
      stars += 1;
      accuracyBonus = Math.max(50, 200 - (moves - pairs) * 10);
    } else {
      accuracyBonus = 50;
    }
  } 
  else if (gameType === 'wordRepeat') {
    // Word Repeat logic
    const threshold = config.accuracyThreshold || 60;
    if (accuracy >= threshold) {
      stars += 1;
      accuracyBonus = Math.round((accuracy - threshold) * 10);
    }
    if (accuracy >= 85) {
      stars += 1;
    }
    timeBonus = Math.max(0, Math.round((300 - timeTaken) * 2));
    streakBonus = streak * 50;
  }
  else if (gameType === 'airDraw') {
    // Air Draw logic
    const tolerance = config.tolerance || 35;
    const minAccuracy = 100 - tolerance;
    if (accuracy >= minAccuracy) {
      stars += 1;
      accuracyBonus = Math.round((accuracy - minAccuracy) * 15);
    }
    const timeLimit = config.timeLimit || 30;
    if (timeTaken <= timeLimit) {
      stars += 1;
      timeBonus = Math.max(0, Math.round((timeLimit - timeTaken) * 10));
    }
  }
  else if (gameType === 'alphabetGrab') {
    // Alphabet Grab logic
    if (accuracy >= 80) {
      stars += 1;
      accuracyBonus = Math.round((accuracy - 80) * 10);
    }
    if (timeTaken <= 60) {
      stars += 1;
      timeBonus = Math.max(0, Math.round((60 - timeTaken) * 5));
    }
    streakBonus = streak * 40;
  }

  // Cap stars at 1-3
  stars = Math.max(1, Math.min(3, stars));

  const comboMultiplier = calculateCombo(combo);
  const points = Math.round(
    basePoints +
    timeBonus +
    accuracyBonus +
    (comboMultiplier * streakBonus) +
    firstTryBonus
  );

  return {
    stars,
    points,
    breakdown: {
      basePoints,
      timeBonus,
      accuracyBonus,
      streakBonus,
      comboMultiplier,
      firstTryBonus
    }
  };
}
