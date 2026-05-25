import { useEffect, useRef, useState, useCallback } from 'react';
import * as HandsModule from '@mediapipe/hands';
import * as CameraModule from '@mediapipe/camera_utils';

// Connect modules cleanly supporting standard bundler properties
const HandsObj = HandsModule.Hands || window.Hands;
const CameraObj = CameraModule.Camera || window.Camera;

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [0, 17]                               // Palm Base
];

export function useHandTracking({ active = true } = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [handLandmarks, setHandLandmarks] = useState(null);
  const [indexFingerTip, setIndexFingerTip] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinchActive] = useState(false);
  const [isGrabbing, setIsGrabActive] = useState(false);

  const drawSkeleton = useCallback((landmarks, ctx, width, height, grabActive) => {
    ctx.clearRect(0, 0, width, height);

    if (!landmarks) return;

    // 1. Draw connections in custom playful styles
    ctx.strokeStyle = '#818CF8'; // Neon playful purple/indigo
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    HAND_CONNECTIONS.forEach(([start, end]) => {
      const startPt = landmarks[start];
      const endPt = landmarks[end];
      if (startPt && endPt) {
        // Apply mirroring calculation
        const sx = (1 - startPt.x) * width;
        const sy = startPt.y * height;
        const ex = (1 - endPt.x) * width;
        const ey = endPt.y * height;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    });

    // 2. Draw standard nodes / joint points
    landmarks.forEach((pt, index) => {
      const cx = (1 - pt.x) * width;
      const cy = pt.y * height;

      ctx.beginPath();
      // Make the fingertip nodes stand out!
      if (index === 8) {
        // Draw standard finger point indicator, but overlay a cute gesture emoji
        ctx.font = '38px "Lexend", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(grabActive ? '✊' : '✋', cx, cy);
      } else if (index === 4) {
        // Thumb tip: Pink target
        ctx.arc(cx, cy, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#EC4899';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();
      } else {
        // Standard Joint
        ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#312E81'; // dark indigo
        ctx.fill();
      }
    });
  }, []);

  // Cleanup references
  const stopTracking = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    if (handsRef.current) {
      handsRef.current.close();
      handsRef.current = null;
    }
    setIsHandDetected(false);
    setHandLandmarks(null);
    setIsPinchActive(false);
    setIsGrabActive(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stopTracking();
      return;
    }

    let isSubscribed = true;

    async function initHands() {
      if (!HandsObj || !videoRef.current) return;

      try {
        setIsLoadingModels(true);
        console.log("🖐️ Initializing MediaPipe Hand Tracker...");

        const hands = new HandsObj({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5
        });

        hands.onResults((results) => {
          if (!isSubscribed) return;

          setIsLoadingModels(false);

          const canvas = canvasRef.current;
          const video = videoRef.current;
          if (!canvas || !video) return;

          const ctx = canvas.getContext('2d');
          const width = canvas.width;
          const height = canvas.height;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            setIsHandDetected(true);
            setHandLandmarks(landmarks);

            // Extract Index tip (8) and Thumb tip (4)
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];

            let grabActive = false;

            if (thumbTip && indexTip) {
              // Calculate mirrored coordinates
              const cx = (1 - indexTip.x) * width;
              const cy = indexTip.y * height;
              setIndexFingerTip({ x: cx, y: cy });

              // Pinch/Grab calculations
              const dx = thumbTip.x - indexTip.x;
              const dy = thumbTip.y - indexTip.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              const pinchActive = dist < 0.05;
              grabActive = dist < 0.075; // child-friendly slightly larger threshold

              setIsPinchActive(pinchActive);
              setIsGrabActive(grabActive);
            }

            // Draw skeleton overlays
            drawSkeleton(landmarks, ctx, width, height, grabActive);
          } else {
            setIsHandDetected(false);
            setHandLandmarks(null);
            setIsPinchActive(false);
            setIsGrabActive(false);
            ctx.clearRect(0, 0, width, height); // Clear overlay if hand leaves view
          }
        });

        handsRef.current = hands;

        // Initialize camera
        const camera = new CameraObj(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current && isSubscribed) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });

        camera.start()
          .then(() => {
            console.log("📸 Hand-tracking camera stream successfully initiated.");
          })
          .catch(e => {
            console.warn("MediaPipe camera start interrupted:", e);
          });
        cameraRef.current = camera;

      } catch (err) {
        console.error("Failed to initialize MediaPipe Hands tracking solution:", err);
        setIsLoadingModels(false);
      }
    }

    // Delay start slightly to allow page transit animations to finish
    const startTimeout = setTimeout(() => {
      initHands();
    }, 400);

    return () => {
      isSubscribed = false;
      clearTimeout(startTimeout);
      stopTracking();
    };
  }, [active, drawSkeleton, stopTracking]);

  return {
    handLandmarks,
    indexFingerTip,
    isPinching,
    isGrabbing,
    grabPosition: indexFingerTip, // alias indexFingerTip to grabPosition for child friendly nomenclature
    isHandDetected,
    isLoadingModels,
    videoRef,
    canvasRef,
    stopTracking
  };
}
