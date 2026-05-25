/**
 * Playful local adaptive difficulty engine for CurioKids AI.
 * Dynamically adjusts shape Pools, color Pools, and vocal guide timers 
 * based on child accuracy and game session telemetry.
 */

export function getAdaptiveParameters(accuracy, historyCount = 0) {
  // If zero past history is recorded, return standard kid parameters
  if (historyCount === 0) {
    return {
      difficulty: 'STANDARD',
      colorsPool: ['red', 'green', 'blue', 'yellow', 'orange', 'purple'],
      shapesPool: ['circle', 'triangle', 'square'],
      vocalHintInterval: 6000
    };
  }

  // 1. High Performance Challenge: Accuracy > 90% (Unlock Expert exotic shades)
  if (accuracy >= 0.90) {
    return {
      difficulty: 'EXPERT',
      colorsPool: ['crimson', 'turquoise', 'lime', 'coral', 'fuchsia', 'lavender'],
      shapesPool: ['circle', 'triangle', 'square'],
      vocalHintInterval: 8000 // Give expert children space to explore before prompting hints
    };
  } 
  
  // 2. Supportive Assistance: Accuracy < 60% (Provide simplified basics & fast hints)
  else if (accuracy <= 0.60) {
    return {
      difficulty: 'BEGINNER',
      colorsPool: ['red', 'green', 'blue', 'yellow'], // Only bold elementary colors
      shapesPool: ['circle'], // Focus on circle (simplest shape) to build confidence
      vocalHintInterval: 3000 // Prompt supportive hints quickly (3 seconds) to guide struggling children
    };
  } 
  
  // 3. Normal Pacing: Standard settings for intermediate kids
  else {
    return {
      difficulty: 'STANDARD',
      colorsPool: ['red', 'green', 'blue', 'yellow', 'orange', 'purple'],
      shapesPool: ['circle', 'triangle', 'square'],
      vocalHintInterval: 5000
    };
  }
}
