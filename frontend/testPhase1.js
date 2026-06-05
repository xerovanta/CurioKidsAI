import { getLevelConfig, getNextLevelStars } from './src/utils/levelSystem.js';
import { calculateStars, calculateCombo } from './src/utils/scoringEngine.js';

console.log("--- Level System Config Test ---");
const mmConfig = getLevelConfig('memoryMatch', 1);
console.log("getLevelConfig('memoryMatch', 1) =", JSON.stringify(mmConfig, null, 2));

const mmNextStars = getNextLevelStars('memoryMatch', 1);
console.log("getNextLevelStars('memoryMatch', 1) =", mmNextStars);

console.log("\n--- Scoring Engine Test ---");
const scoreResult = calculateStars('memoryMatch', 2, {
  moves: 5,
  timeTaken: 45,
  accuracy: 100,
  hintsUsed: 0,
  combo: 3,
  streak: 0,
  firstTry: true
});
console.log("calculateStars('memoryMatch', 2, ...) =", JSON.stringify(scoreResult, null, 2));
