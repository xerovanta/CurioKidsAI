import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

// Public model weight host with active CORS support
const MODEL_CDN_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

export function useEmotion(videoRef) {
  const [emotion, setEmotion] = useState('neutral');
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const trackingIntervalRef = useRef(null);

  // Load models on hook mount
  useEffect(() => {
    let active = true;

    async function loadModels() {
      if (modelsLoaded) return;
      setLoadingModels(true);
      setError(null);
      try {
        console.log("🧠 Loading on-device face-api.js emotion models from CDN...");
        
        // Load tinyFaceDetector and faceExpressionNet models
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_CDN_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_CDN_URL);
        
        if (active) {
          setModelsLoaded(true);
          console.log("🎉 On-device face-api.js emotion models loaded successfully!");
        }
      } catch (err) {
        console.error("Failed to load face-api.js models from CDN:", err);
        if (active) {
          setError("Failed to load face-api.js emotion models. Using standard visual telemetry fallbacks.");
        }
      } finally {
        if (active) {
          setLoadingModels(false);
        }
      }
    }

    loadModels();

    return () => {
      active = false;
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, [modelsLoaded]);

  const startTracking = useCallback((intervalMs = 1500) => {
    if (!modelsLoaded) {
      console.warn("⚠️ Cannot start emotion tracking: face-api.js models not loaded yet.");
      return;
    }

    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }

    console.log("⏱️ Starting real-time facial expression tracking...");

    trackingIntervalRef.current = setInterval(async () => {
      if (!videoRef || !videoRef.current) return;
      
      const video = videoRef.current;
      if (video.readyState < 2) return; // Video not ready yet

      try {
        // Detect single face and expression
        const result = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (result && result.expressions) {
          const expressions = result.expressions;
          let highestEmotion = 'neutral';
          let highestConfidence = 0;

          // Identify the most confident expression
          Object.keys(expressions).forEach((emo) => {
            if (expressions[emo] > highestConfidence) {
              highestConfidence = expressions[emo];
              highestEmotion = emo;
            }
          });

          // Standardize expressions to playful child names (supports visual mascot matching)
          let normalizedEmotion = 'neutral';
          if (highestEmotion === 'happy' && highestConfidence > 0.4) {
            normalizedEmotion = 'happy';
          } else if (highestEmotion === 'sad' && highestConfidence > 0.4) {
            normalizedEmotion = 'sad';
          } else if (highestEmotion === 'surprised' && highestConfidence > 0.4) {
            normalizedEmotion = 'surprised';
          } else if ((highestEmotion === 'angry' || highestEmotion === 'fearful' || highestEmotion === 'disgusted') && highestConfidence > 0.4) {
            normalizedEmotion = 'sad'; // Map distress signs to supportive buddy reactions
          }

          setEmotion(normalizedEmotion);
          console.log(`🎭 Emotion read: ${normalizedEmotion} (${Math.round(highestConfidence * 100)}%)`);
        }
      } catch (err) {
        // Silent skip to avoid interrupting gameplay loops
        console.warn("Emotion frame scan skipped:", err);
      }
    }, intervalMs);

  }, [modelsLoaded, videoRef]);

  const stopTracking = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
      console.log("🛑 Stopped real-time facial expression tracking.");
    }
  }, []);

  return {
    emotion,
    loadingModels,
    modelsLoaded,
    error,
    startTracking,
    stopTracking
  };
}
