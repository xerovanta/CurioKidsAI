const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Serverless HTTPS endpoint to compute adaptive difficulties, focus scores, 
 * and supportive companion visual reactions based on real-time child gameplay logs.
 */
exports.getAdaptiveLesson = functions.https.onRequest((request, response) => {
  // Handle CORS options
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  try {
    const payload = request.body || {};
    
    // Extract logs or fall back to intermediate standard defaults
    const accuracy = typeof payload.accuracy === 'number' ? payload.accuracy : 0.75;
    const speedSeconds = typeof payload.speedSeconds === 'number' ? payload.speedSeconds : 8.0;
    const emotions = Array.isArray(payload.emotions) ? payload.emotions : ['neutral'];

    // 1. Calculate Focus/Engagement Score
    // Ratio of happy + surprised + neutral states divided by total duration samples
    const totalSamples = emotions.length || 1;
    const activeSamples = emotions.filter(emo => 
      emo === 'happy' || emo === 'surprised' || emo === 'neutral'
    ).length;
    
    const focusScore = Math.round((activeSamples / totalSamples) * 100) / 100;

    // 2. Compute Difficulty Level
    let difficulty = 'STANDARD';
    let nextLesson = 'Color Hunt (Standard)';
    let colorsPool = ['red', 'green', 'blue', 'yellow', 'orange', 'purple'];
    let shapesPool = ['circle', 'triangle', 'square'];
    let vocalHintInterval = 5000;

    if (accuracy >= 0.90 && focusScore >= 0.75) {
      difficulty = 'EXPERT';
      nextLesson = 'Color Hunt (Expert)';
      colorsPool = ['crimson', 'turquoise', 'lime', 'coral', 'fuchsia', 'lavender'];
      vocalHintInterval = 8000;
    } else if (accuracy <= 0.60 || focusScore <= 0.50) {
      difficulty = 'BEGINNER';
      nextLesson = 'Shape Detective (Beginner)';
      colorsPool = ['red', 'green', 'blue', 'yellow'];
      shapesPool = ['circle']; // simplified targeting
      vocalHintInterval = 3000;
    }

    // 3. Formulate Companion State Response to dynamically prompt kids
    let suggestedBuddyState = 'idle';
    let companionMotivation = "Let's hunt for colors together! You can do it! 📐";

    if (focusScore < 0.60) {
      suggestedBuddyState = 'listening';
      companionMotivation = "💡 Psst! I'm waving! Try holding it a bit closer to help me see! 🦊";
    } else if (emotions.includes('happy')) {
      suggestedBuddyState = 'happy';
      companionMotivation = "🎉 Look at that big focus smile! We make an outstanding team! 🦖";
    }

    // Send complete adaptive package
    response.status(200).json({
      success: true,
      difficulty,
      focusScore: Math.round(focusScore * 100),
      nextLesson,
      colorsPool,
      shapesPool,
      vocalHintInterval,
      suggestedBuddyState,
      companionMotivation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Adaptive rule calculation failed:", error);
    response.status(500).json({
      success: false,
      error: "Failed to calculate adaptive lesson difficulty rules."
    });
  }
});
