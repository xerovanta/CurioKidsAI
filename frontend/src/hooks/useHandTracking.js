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

export function useHandTracking({ active = true, fitMode = 'contain' } = {}) {
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
  const [handScale, setHandScale] = useState(0.25);
  const [isHandConfident, setIsHandConfident] = useState(false);
  
  // Calibration Offset
  const [calibrationOffset, setCalibrationOffsetState] = useState({ x: 0, y: 0 });
  const calibrationOffsetRef = useRef({ x: 0, y: 0 });

  // Smoothing Configurations
  const smoothingAmountRef = useRef(0.6); // default EMA coefficient
  const [smoothingAmount, setSmoothingAmountState] = useState(0.6);
  const landmarkBufferRef = useRef([]); // history buffer for moving average
  const smoothedLandmarksRef = useRef(null); // cache for EMA

  // Pinch Debounce states
  const pinchStableFramesRef = useRef(0);
  const pinchStableStateRef = useRef(false);

  const setSmoothing = useCallback((amount) => {
    const clamped = Math.max(0.01, Math.min(1, amount));
    smoothingAmountRef.current = clamped;
    setSmoothingAmountState(clamped);
  }, []);

  const setCalibrationOffset = useCallback(({ x, y }) => {
    calibrationOffsetRef.current = { x, y };
    setCalibrationOffsetState({ x, y });
  }, []);

  // Standard mirroring coordinates mapping aligned to Aspect Ratio and fit-mode
  const mapCoordinates = useCallback((pt, canvasW, canvasH, videoW, videoH) => {
    const mirroredX = 1 - pt.x; // Mirror X since webcam preview is mirrored
    let mappedX = mirroredX * canvasW;
    let mappedY = pt.y * canvasH;

    if (videoW > 0 && videoH > 0) {
      const videoAspect = videoW / videoH;
      const canvasAspect = canvasW / canvasH;

      if (fitMode === 'contain') {
        if (canvasAspect > videoAspect) {
          // Canvas is wider than video (letterbox on sides)
          const scale = canvasH / videoH;
          const xOffset = (canvasW - videoW * scale) / 2;
          mappedX = mirroredX * (videoW * scale) + xOffset;
          mappedY = pt.y * canvasH;
        } else {
          // Canvas is taller than video (letterbox on top/bottom)
          const scale = canvasW / videoW;
          const yOffset = (canvasH - videoH * scale) / 2;
          mappedX = mirroredX * canvasW;
          mappedY = pt.y * (videoH * scale) + yOffset;
        }
      } else if (fitMode === 'cover') {
        if (canvasAspect > videoAspect) {
          // Canvas is wider: clip top/bottom of video
          const scale = canvasW / videoW;
          const yOffset = (videoH * scale - canvasH) / 2;
          mappedX = mirroredX * canvasW;
          mappedY = pt.y * (videoH * scale) - yOffset;
        } else {
          // Canvas is taller: clip sides of video
          const scale = canvasH / videoH;
          const xOffset = (videoW * scale - canvasW) / 2;
          mappedX = mirroredX * (videoW * scale) - xOffset;
          mappedY = pt.y * canvasH;
        }
      }
    }

    // Apply calibration offset
    const offset = calibrationOffsetRef.current;
    return {
      x: mappedX + offset.x,
      y: mappedY + offset.y
    };
  }, [fitMode]);

  const drawSkeleton = useCallback((landmarks, ctx, width, height, grabActive) => {
    ctx.clearRect(0, 0, width, height);

    if (!landmarks) return;

    // 1. Draw connections in playful style
    ctx.strokeStyle = '#818CF8'; // Playful neon purple
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    HAND_CONNECTIONS.forEach(([start, end]) => {
      const startPt = landmarks[start];
      const endPt = landmarks[end];
      if (startPt && endPt) {
        // Map points with current aspect-ratio and offsets
        const sMapped = mapCoordinates(startPt, width, height, 640, 480);
        const eMapped = mapCoordinates(endPt, width, height, 640, 480);

        ctx.beginPath();
        ctx.moveTo(sMapped.x, sMapped.y);
        ctx.lineTo(eMapped.x, eMapped.y);
        ctx.stroke();
      }
    });

    // 2. Draw standard nodes / joint points
    landmarks.forEach((pt, index) => {
      const mapped = mapCoordinates(pt, width, height, 640, 480);

      ctx.beginPath();
      // Make fingertip stand out with cute emojis
      if (index === 8) {
        ctx.font = '38px "Lexend", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(grabActive ? '✊' : '✋', mapped.x, mapped.y);
      } else if (index === 4) {
        // Thumb tip: Pink target circle
        ctx.arc(mapped.x, mapped.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#EC4899';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();
      } else {
        // Standard Joint
        ctx.arc(mapped.x, mapped.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#312E81'; // Dark indigo
        ctx.fill();
      }
    });
  }, [mapCoordinates]);

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
    setIsHandConfident(false);
    landmarkBufferRef.current = [];
    smoothedLandmarksRef.current = null;
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
        console.log("🖐️ Initializing High-Accuracy MediaPipe Hand Tracker...");

        const hands = new HandsObj({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.75, // Elevated for higher confidence filter
          minTrackingConfidence: 0.6
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

          // Read real raw video width & height
          const videoW = video.videoWidth || 640;
          const videoH = video.videoHeight || 480;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const rawLandmarks = results.multiHandLandmarks[0];
            
            // Confidence filter: Check if key landmarks are present and stable
            const keyPointsValid = rawLandmarks[0] && rawLandmarks[4] && rawLandmarks[8] && rawLandmarks[12];
            if (!keyPointsValid) {
              setIsHandConfident(false);
              return;
            }
            
            setIsHandConfident(true);
            setIsHandDetected(true);

            // 1. Dual-Stage Landmark Smoothing (Moving Average + EMA)
            // A. Moving Average (Size 5 window)
            landmarkBufferRef.current.push(rawLandmarks);
            if (landmarkBufferRef.current.length > 5) {
              landmarkBufferRef.current.shift();
            }
            const buffer = landmarkBufferRef.current;
            const movingAverage = rawLandmarks.map((pt, i) => {
              let sumX = 0, sumY = 0, sumZ = 0;
              buffer.forEach(frame => {
                const fPt = frame[i] || pt;
                sumX += fPt.x;
                sumY += fPt.y;
                sumZ += fPt.z;
              });
              return {
                x: sumX / buffer.length,
                y: sumY / buffer.length,
                z: sumZ / buffer.length
              };
            });

            // B. Exponential Moving Average (EMA)
            let smoothed = [];
            const emaAmount = smoothingAmountRef.current;
            if (!smoothedLandmarksRef.current) {
              smoothed = movingAverage;
            } else {
              smoothed = movingAverage.map((pt, i) => {
                const prev = smoothedLandmarksRef.current[i] || pt;
                return {
                  x: prev.x * (1 - emaAmount) + pt.x * emaAmount,
                  y: prev.y * (1 - emaAmount) + pt.y * emaAmount,
                  z: prev.z * (1 - emaAmount) + pt.z * emaAmount
                };
              });
            }
            smoothedLandmarksRef.current = smoothed;
            setHandLandmarks(smoothed);

            // Extract Index tip (8) and Thumb tip (4) and Wrist (0) / Middle Tip (12)
            const wrist = smoothed[0];
            const thumbTip = smoothed[4];
            const indexTip = smoothed[8];
            const middleTip = smoothed[12];

            let grabActive = false;

            if (thumbTip && indexTip) {
              // Dynamic mapping of Index Tip coordinate using aspect ratio
              const mappedIndex = mapCoordinates(indexTip, width, height, videoW, videoH);
              setIndexFingerTip(mappedIndex);

              // 2. Dynamic Scale Calculation (Wrist to Middle finger distance)
              let scale = 0.25;
              if (wrist && middleTip) {
                const scaleDx = wrist.x - middleTip.x;
                const scaleDy = wrist.y - middleTip.y;
                const scaleDz = wrist.z - middleTip.z;
                scale = Math.sqrt(scaleDx * scaleDx + scaleDy * scaleDy + scaleDz * scaleDz);
              }
              setHandScale(scale);

              // 3. Proportional Pinch Threshold
              // Child scale dynamic range: thumb tip (4) to index tip (8) distance
              const dx = thumbTip.x - indexTip.x;
              const dy = thumbTip.y - indexTip.y;
              const dz = thumbTip.z - indexTip.z;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
              
              const pinchThreshold = scale * 0.24; // Scaled threshold

              // A second condition: the angle between thumb-index and index-middle vectors
              let anglePass = true;
              if (middleTip) {
                const v1 = { x: indexTip.x - thumbTip.x, y: indexTip.y - thumbTip.y };
                const v2 = { x: middleTip.x - indexTip.x, y: middleTip.y - indexTip.y };
                const dotProduct = v1.x * v2.x + v1.y * v2.y;
                const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 0.001;
                const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 0.001;
                const cosTheta = dotProduct / (mag1 * mag2);
                
                // If fingers are extremely close, bypass angle checks. 
                // Otherwise, verify thumb-index angle points in dynamic pinching directions
                if (dist > 0.035) {
                  anglePass = Math.abs(cosTheta) < 0.85; 
                }
              }

              // 4. Stable 3-Frame Debouncing
              const rawPinch = (dist < pinchThreshold) && anglePass;
              if (rawPinch === pinchStableStateRef.current) {
                pinchStableFramesRef.current = 0;
              } else {
                pinchStableFramesRef.current += 1;
                if (pinchStableFramesRef.current >= 3) {
                  pinchStableStateRef.current = rawPinch;
                  pinchStableFramesRef.current = 0;
                }
              }

              const pinchActive = pinchStableStateRef.current;
              grabActive = dist < (scale * 0.32); // Slightly larger threshold for child grab

              setIsPinchActive(pinchActive);
              setIsGrabActive(grabActive);
            }

            // Draw smoothed skeleton overlay
            drawSkeleton(smoothed, ctx, width, height, grabActive);
          } else {
            setIsHandConfident(false);
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
  }, [active, drawSkeleton, stopTracking, mapCoordinates]);

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
    stopTracking,
    
    // Phase 1 Additional exports
    handScale,
    isHandConfident,
    smoothingAmount,
    setSmoothing,
    calibrationOffset,
    setCalibrationOffset
  };
}
