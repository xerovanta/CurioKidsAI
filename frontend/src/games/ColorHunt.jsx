import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, RefreshCw, Star, AlertCircle, HelpCircle, Check, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useCamera } from '../hooks/useCamera';
import { detectColorInRegion } from '../utils/colorDetector';
import { useEmotion } from '../hooks/useEmotion';
import { getAdaptiveParameters } from '../utils/adaptiveDifficulty';
import AIBuddy from '../components/AIBuddy';
import { doc, collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';

// Import TensorFlow.js dynamically to prevent Vite dev dependencies bloating
let tfLoaded = false;
let cocoModel = null;

async function loadAIModels() {
  if (cocoModel) return cocoModel;
  
  // Ensure TensorFlow backend is ready
  const tf = await import('@tensorflow/tfjs');
  await tf.ready();
  
  const cocoSsd = await import('@tensorflow-models/coco-ssd');
  cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  tfLoaded = true;
  return cocoModel;
}

export default function ColorHunt({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission } = useAuth();
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  const { startCamera, stopCamera, stream, error: cameraError, hasPermission } = useCamera();

  const [loadingModel, setLoadingModel] = useState(true);
  const [modelError, setModelError] = useState(false);
  
  // Game states
  const [targetColor, setTargetColor] = useState('');
  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);
  const [detectedColorInfo, setDetectedColorInfo] = useState(null);
  const [colorMatchingActive, setColorMatchingActive] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);

  // Real-time on-device facial expression tracking hook
  const { emotion, modelsLoaded, startTracking, stopTracking } = useEmotion(videoRef);

  // 1. Fetch initial parameters synchronously on first render
  const initialStars = childProfile?.stars || 0;
  const initialAccuracy = initialStars > 120 ? 0.95 : (initialStars < 25 ? 0.50 : 0.75);
  const initialParams = getAdaptiveParameters(initialAccuracy, initialStars > 0 ? 1 : 0);

  const [colorsPool, setColorsPool] = useState(initialParams.colorsPool);
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState(initialParams.difficulty);

  // Dynamic Difficulty Adjustments based on session scores & telemetry
  useEffect(() => {
    if (!childProfile) return;
    const totalStars = childProfile.stars || 0;
    
    // Switch difficulty based on game score or past stars
    const activeAccuracy = score >= 3 ? 0.95 : (score === 0 ? (totalStars > 120 ? 0.95 : (totalStars < 25 ? 0.50 : 0.75)) : 0.75);
    const params = getAdaptiveParameters(activeAccuracy, 1);
    
    setColorsPool(params.colorsPool);
    setAdaptiveDifficulty(params.difficulty);
    console.log(`🧠 Adaptive difficulty updated: [${params.difficulty}] Mode. Pools:`, params.colorsPool);
  }, [score, childProfile]);

  // Load models on mount
  useEffect(() => {
    // Pick first color dynamically
    pickNewTargetColor();

    loadAIModels()
      .then(() => {
        setLoadingModel(false);
      })
      .catch((err) => {
        console.error("Failed to load TensorFlow models locally:", err);
        setLoadingModel(false);
      });

    return () => {
      stopCamera();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [colorsPool]); // Run color pick again if colors pool undergoes shift

  // Start emotion tracking when camera is active & face-api is loaded
  useEffect(() => {
    if (modelsLoaded && stream && !sandboxMode) {
      startTracking(1500); // Track face expressions once every 1.5 seconds (prevents device heating)
    }
    return () => {
      stopTracking();
    };
  }, [modelsLoaded, stream, sandboxMode, startTracking, stopTracking]);

  // Log child's emotional telemetry to Firestore every 10 seconds (focus mapping)
  useEffect(() => {
    if (sandboxMode || !colorMatchingActive || !currentUser) return;

    const interval = setInterval(async () => {
      const logData = {
        timestamp: new Date().toISOString(),
        activityType: 'color-hunt-emotion',
        emotion: emotion,
        targetColor,
        score,
        difficulty: adaptiveDifficulty
      };

      if (isValidConfig && db) {
        try {
          await addDoc(collection(db, 'interactions', currentUser.uid, 'logs'), logData);
          console.log("📊 Emotional Telemetry Logged to Firestore:", emotion);
        } catch (err) {
          console.error("Failed to log emotional telemetry:", err);
        }
      } else {
        console.log("📝 Offline Emotional Telemetry Logged:", logData);
      }
    }, 10000); // 10 seconds log pacing

    return () => clearInterval(interval);
  }, [emotion, targetColor, score, sandboxMode, colorMatchingActive, currentUser, adaptiveDifficulty]);

  // Trigger camera start when model is loaded and sandbox is false
  useEffect(() => {
    if (!loadingModel && videoRef.current && !sandboxMode) {
      startCamera(videoRef.current);
    }
  }, [loadingModel, videoRef.current, startCamera, sandboxMode]);

  // Pick target color
  const pickNewTargetColor = () => {
    const nextColor = colorsPool[Math.floor(Math.random() * colorsPool.length)];
    setTargetColor(nextColor);
    
    // Dynamic buddy welcoming prompts depending on adaptive parameters
    const promptText = adaptiveDifficulty === 'EXPERT' 
      ? `You are in Expert mode! Can you hunt down the exotic shade ${nextColor}? 🌟`
      : `Can you find something ${nextColor} and show it to my camera? 🌟`;
      
    setBuddyText(promptText);
    setBuddyState('idle');
    setDetectedColorInfo(null);
    setColorMatchingActive(true);
  };

  // Log interaction telemetry to Firestore
  const logInteractionTelemetry = async (success, detected) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'color-hunt',
      success,
      target: targetColor,
      detected: detected || 'none',
      emotion: success ? 'happy' : 'neutral'
    };

    if (isValidConfig && db && currentUser) {
      try {
        await addDoc(collection(db, 'interactions', currentUser.uid, 'logs'), logData);
      } catch (err) {
        console.error("Firestore logging failed:", err);
      }
    } else {
      console.log("📝 Offline Telemetry Logged:", logData);
    }
  };

  // Run the detection loop
  useEffect(() => {
    if (loadingModel || !stream || !videoRef.current || sandboxMode) return;

    let isDetecting = false;

    const detectLoop = async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && !isDetecting) {
        isDetecting = true;
        
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          if (canvas) {
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let detectedBbox = null;

            // 1. Run COCO-SSD if loaded
            if (cocoModel) {
              const predictions = await cocoModel.detect(video);
              
              // Find the primary prediction (any visible object)
              const primaryObj = predictions.find(p => p.score > 0.45);
              if (primaryObj) {
                const [x, y, w, h] = primaryObj.bbox;
                detectedBbox = { x, y, width: w, height: h };

                // Draw Object Box
                ctx.strokeStyle = '#6366F1';
                ctx.lineWidth = 4;
                ctx.strokeRect(x, y, w, h);

                // Draw Label Box
                ctx.fillStyle = '#6366F1';
                ctx.fillRect(x, y - 30, Math.min(w, 140), 30);
                
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 14px "Lexend", sans-serif';
                ctx.fillText(primaryObj.class, x + 10, y - 10);
              }
            }

            // 2. Perform Color Detection in that region
            const colorResult = detectColorInRegion(video, detectedBbox);
            
            if (colorResult) {
              setDetectedColorInfo(colorResult);

              // Draw a targeting reticle in the sampled region
              const box = colorResult.bbox;
              ctx.strokeStyle = colorResult.colorName === targetColor ? '#10B981' : '#F59E0B';
              ctx.lineWidth = 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              // Class name
              ctx.fillStyle = colorResult.colorName === targetColor ? '#10B981' : '#F59E0B';
              ctx.fillRect(box.x, box.y + box.height, Math.min(box.width, 180), 28);
              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 12px "Lexend", sans-serif';
              ctx.fillText(`Color: ${colorResult.colorName || 'Scanning...'}`, box.x + 8, box.y + box.height + 18);

              // 3. Match Color Target
              if (colorMatchingActive && colorResult.colorName === targetColor) {
                handleCorrectAnswer(colorResult.colorName);
              }
            }
          }
        } catch (e) {
          console.warn("Detection cycle exception:", e);
        } finally {
          isDetecting = false;
        }
      }
      
      if (stream) {
        requestRef.current = requestAnimationFrame(detectLoop);
      }
    };

    requestRef.current = requestAnimationFrame(detectLoop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [loadingModel, stream, targetColor, colorMatchingActive, sandboxMode]);

  // Handle a correct match!
  const handleCorrectAnswer = async (colorDetected) => {
    setColorMatchingActive(false);
    setBuddyState('happy');
    setBuddyText(`Awesome! I see the color ${colorDetected}! You found it! 🎉`);
    setScore(prev => prev + 1);

    // Confetti explosion
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Award Stars (5 Stars)
    await awardStars(5);
    // Increment daily mission #1 ("Play color hunt")
    await incrementMission(1);
    
    // Log telemetry
    await logInteractionTelemetry(true, colorDetected);

    // Auto-advance after 4 seconds
    setTimeout(() => {
      pickNewTargetColor();
    }, 4500);
  };

  // Sandbox fallback click
  const handleSandboxClick = (color) => {
    if (!colorMatchingActive) return;

    if (color === targetColor) {
      handleCorrectAnswer(color);
    } else {
      setBuddyState('sad');
      setBuddyText(`Oops! That is ${color}, but I am hunting for ${targetColor}! Let's try again! 💪`);
      logInteractionTelemetry(false, color);
      setTimeout(() => {
        setBuddyState('idle');
        setBuddyText(`Can you find something ${targetColor}?`);
      }, 3000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Game Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-4 border-curio-slate shadow-playful">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🎨</span>
          <div>
            <h3 className="text-xl font-black text-curio-slate">Color Hunt Adventure</h3>
            <p className="text-xs font-semibold text-slate-400">Identify colors with your camera buddy!</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Round Score display */}
          <div className="bg-curio-pink text-white px-3 py-1 rounded-full text-sm font-bold border-2 border-curio-slate flex items-center gap-1 shadow-playful">
            <Star className="w-4 h-4 fill-white" />
            <span>Found: {score}</span>
          </div>

          <button 
            onClick={onBack}
            className="bg-slate-100 hover:bg-slate-200 border-2 border-curio-slate text-curio-slate font-extrabold px-3 py-1.5 rounded-2xl text-xs uppercase cursor-pointer"
          >
            ◀ Lobby
          </button>
        </div>
      </div>

      {/* AI Buddy Prompter Section */}
      <AIBuddy 
        skin={childProfile?.companion || 'sparky'} 
        state={buddyState} 
        text={buddyText} 
      />

      {/* Main Game Interface (Camera feed / Sandbox) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle: Camera Viewport */}
        <div className="lg:col-span-2 bg-white p-4 rounded-4xl border-4 border-curio-slate shadow-playful-purple flex flex-col items-center relative min-h-[350px]">
          
          {loadingModel ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-curio-purple rounded-full animate-spin"></div>
              <h4 className="font-extrabold text-curio-slate">Loading AI Brain...</h4>
              <p className="text-xs text-slate-400 font-semibold">TensorFlow is waking up offline on your device.</p>
            </div>
          ) : sandboxMode ? (
            /* Sandbox sandbox mode */
            <div className="flex flex-col items-center justify-center w-full h-full py-8 space-y-6">
              <div className="text-center space-y-1">
                <span className="text-5xl block animate-bounce-slow">🎨</span>
                <h4 className="font-extrabold text-curio-slate text-lg uppercase">Color Hunt Sandbox</h4>
                <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">
                  Camera is turned off. Tap the correct colored bubble to show your buddy what you found!
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-md w-full px-4">
                {colorsPool.map((color) => {
                  const colorClasses = {
                    red: 'bg-red-500 hover:bg-red-600 shadow-red-700',
                    crimson: 'bg-rose-700 hover:bg-rose-800 shadow-rose-900',
                    green: 'bg-green-500 hover:bg-green-600 shadow-green-700',
                    lime: 'bg-lime-400 hover:bg-lime-500 text-slate-800 shadow-lime-600',
                    blue: 'bg-blue-500 hover:bg-blue-600 shadow-blue-700',
                    turquoise: 'bg-cyan-400 hover:bg-cyan-500 text-slate-800 shadow-cyan-600',
                    yellow: 'bg-yellow-400 hover:bg-yellow-500 text-slate-800 shadow-yellow-600',
                    orange: 'bg-orange-500 hover:bg-orange-600 shadow-orange-700',
                    coral: 'bg-orange-400 hover:bg-orange-500 shadow-orange-600',
                    purple: 'bg-purple-500 hover:bg-purple-600 shadow-purple-700',
                    fuchsia: 'bg-fuchsia-500 hover:bg-fuchsia-600 shadow-fuchsia-700',
                    lavender: 'bg-purple-300 hover:bg-purple-400 text-slate-800 shadow-purple-500',
                  };

                  return (
                    <button
                      key={color}
                      onClick={() => handleSandboxClick(color)}
                      className={`py-6 rounded-3xl border-2 border-curio-slate font-extrabold text-white text-sm uppercase transition duration-150 transform hover:scale-105 active:scale-95 shadow-[0_6px_0_0_rgba(0,0,0,1)] ${
                        colorClasses[color]
                      }`}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Active Camera feed */
            <div className="relative w-full h-full overflow-hidden rounded-3xl border-4 border-curio-slate bg-black flex items-center justify-center">
              
              <video 
                ref={videoRef}
                className="w-full h-auto aspect-video object-cover"
                muted
                playsInline
              />

              {/* Bounding box overlay canvas */}
              <canvas 
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {/* Camera Error banner */}
              {(cameraError || !hasPermission) && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center space-y-4 text-white z-20">
                  <AlertCircle className="w-12 h-12 text-curio-orange" />
                  <div className="space-y-1 max-w-xs">
                    <h4 className="font-extrabold text-base">Camera Required</h4>
                    <p className="text-xs text-slate-400 leading-normal">
                      {cameraError || "Please allow camera access. If you don't have a camera, unlock the Sandbox mode below!"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSandboxMode(true);
                      stopCamera();
                    }}
                    className="bg-curio-yellow text-curio-slate-dark px-4 py-2 rounded-2xl text-xs font-black uppercase border-2 border-curio-slate shadow-playful"
                  >
                    🎮 Unlock Sandbox Fallback
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Toggle Sandbox switch */}
          {!loadingModel && (
            <button
              onClick={() => {
                const nextMode = !sandboxMode;
                setSandboxMode(nextMode);
                if (nextMode) {
                  stopCamera();
                } else {
                  if (videoRef.current) startCamera(videoRef.current);
                }
              }}
              className="mt-4 text-xs font-black text-curio-purple hover:underline bg-slate-100 hover:bg-slate-200 border-2 border-curio-slate px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-playful"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{sandboxMode ? "Use Live Camera Mode" : "Switch to Button Sandbox"}</span>
            </button>
          )}

        </div>

        {/* Right Pane: Hunt Details & Calibrated Spectrum */}
        <div className="space-y-6">
          
          {/* Target Color Visualizer Card */}
          <div className="bg-white p-6 rounded-4xl border-4 border-curio-slate shadow-playful-pink text-center space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Target Color</h4>
            
            <div className="flex justify-center">
              <motion.div 
                className={`w-28 h-28 rounded-full border-4 border-curio-slate shadow-playful flex items-center justify-center`}
                style={{
                  backgroundColor: 
                    targetColor === 'red' ? '#EF4444' :
                    targetColor === 'crimson' ? '#DC143C' :
                    targetColor === 'green' ? '#10B981' :
                    targetColor === 'lime' ? '#00FF00' :
                    targetColor === 'blue' ? '#3B82F6' :
                    targetColor === 'turquoise' ? '#40E0D0' :
                    targetColor === 'yellow' ? '#FBBF24' :
                    targetColor === 'orange' ? '#F97316' :
                    targetColor === 'coral' ? '#FF7F50' :
                    targetColor === 'purple' ? '#8B5CF6' :
                    targetColor === 'fuchsia' ? '#FF00FF' :
                    targetColor === 'lavender' ? '#B39DDB' : '#FFF'
                }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
              >
                <span className="text-5xl select-none animate-wiggle inline-block">
                  {targetColor === 'red' ? '🍎' :
                   targetColor === 'crimson' ? '🎈' :
                   targetColor === 'green' ? '🟢' :
                   targetColor === 'lime' ? '🍋' :
                   targetColor === 'blue' ? '🐬' :
                   targetColor === 'turquoise' ? '💎' :
                   targetColor === 'yellow' ? '🍌' :
                   targetColor === 'orange' ? '🍊' :
                   targetColor === 'coral' ? '🪸' :
                   targetColor === 'purple' ? '🍇' :
                   targetColor === 'fuchsia' ? '🌸' :
                   targetColor === 'lavender' ? '🪻' : '🔍'}
                </span>
              </motion.div>
            </div>

            <h5 className="text-2xl font-black uppercase text-curio-slate tracking-wider">
              {targetColor || 'Searching...'}
            </h5>
          </div>

          {/* Calibrated Pixels Data Card */}
          {!sandboxMode && (
            <div className="bg-white p-5 rounded-4xl border-4 border-curio-slate shadow-playful space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-curio-blue" />
                Live Camera Spectrum
              </h4>

              {detectedColorInfo ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {/* Live swatch */}
                    <div 
                      className="w-10 h-10 rounded-xl border-2 border-curio-slate" 
                      style={{ backgroundColor: `rgb(${detectedColorInfo.rgb.r}, ${detectedColorInfo.rgb.g}, ${detectedColorInfo.rgb.b})` }}
                    />
                    <div className="text-xs">
                      <span className="font-extrabold text-curio-slate block">Dominant Color: {detectedColorInfo.colorName || 'neutral/scanning'}</span>
                      <span className="text-slate-400 font-bold block">HSV: {detectedColorInfo.hsv.h}°, {detectedColorInfo.hsv.s}%, {detectedColorInfo.hsv.v}%</span>
                    </div>
                  </div>

                  {/* Calibration Match indicator */}
                  <div className={`p-2 rounded-xl border-2 text-center text-xs font-bold ${
                    detectedColorInfo.colorName === targetColor 
                      ? 'bg-curio-green/10 border-curio-green text-curio-green'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    {detectedColorInfo.colorName === targetColor ? "🎉 MATCH DETECTED!" : "❌ Colors do not match"}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-4">
                  Bring an object in front of the camera to start color analysis...
                </p>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
