import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Star, AlertCircle, HelpCircle, Eye, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useCamera } from '../hooks/useCamera';
import { detectShape } from '../utils/shapeDetector';
import AIBuddy from '../components/AIBuddy';
import { doc, collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';

export default function ShapeDetective({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission } = useAuth();
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const lastDetectedTimeRef = useRef(Date.now());
  const lastDetectionTime = useRef(0); // Tracks when the last shape correct announcement was made
  const consecutiveFramesRef = useRef(0);
  const lastDetectedShapeNameRef = useRef('');

  const { startCamera, stopCamera, stream, error: cameraError, hasPermission } = useCamera();

  const [loadingGame, setLoadingGame] = useState(true);
  const [targetShape, setTargetShape] = useState('');
  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);
  const [detectedShapeInfo, setDetectedShapeInfo] = useState(null);
  const [matchingActive, setMatchingActive] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);

  // Dynamic edge sensitivity threshold (lower is more sensitive for hand-drawn pencil shapes)
  const [sensitivity, setSensitivity] = useState(80);

  const shapesPool = ['circle', 'triangle', 'square'];

  useEffect(() => {
    pickNewTargetShape();
    setLoadingGame(false);

    return () => {
      stopCamera();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!loadingGame && videoRef.current && !sandboxMode) {
      startCamera(videoRef.current);
    }
  }, [loadingGame, videoRef.current, startCamera, sandboxMode]);

  // 3-Second Buddy Idle Hint Trigger (Triggers only when no shape at all has been detected)
  useEffect(() => {
    if (!matchingActive || sandboxMode) return;

    const interval = setInterval(() => {
      const timeSinceLastDetection = Date.now() - lastDetectedTimeRef.current;

      if (timeSinceLastDetection >= 3000) {
        const secondsOffline = Math.floor(timeSinceLastDetection / 1000);
        
        if (secondsOffline === 3) {
          setBuddyState('listening');
          setBuddyText("💡 Try holding your drawing a bit closer to the camera inside the target guide box!");
        } else if (secondsOffline === 6) {
          setBuddyState('listening');
          setBuddyText("💡 Make sure there is plenty of light! Or try sliding the sensitivity slider below.");
        } else if (secondsOffline === 9) {
          setBuddyState('listening');
          setBuddyText("💡 Try drawing your shape with a dark thick marker or crayon on plain white paper!");
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [matchingActive, sandboxMode]);

  const pickNewTargetShape = () => {
    const nextShape = shapesPool[Math.floor(Math.random() * shapesPool.length)];
    setTargetShape(nextShape);
    setBuddyText(`Can you draw or find a ${nextShape} and hold it up? 📐`);
    setBuddyState('idle');
    setDetectedShapeInfo(null);
    lastDetectedTimeRef.current = Date.now();
    consecutiveFramesRef.current = 0;
    lastDetectedShapeNameRef.current = '';
    setMatchingActive(true);
  };

  const logInteractionTelemetry = async (success, detected) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'shape-detective',
      success,
      target: targetShape,
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
      print("📝 Offline Telemetry Logged:", logData);
    }
  };

  // Computer Vision contour tracing loop with overlay visualizer
  useEffect(() => {
    if (loadingGame || !stream || !videoRef.current || sandboxMode) return;

    let isScanning = false;

    const scanLoop = () => {
      if (!stream || !videoRef.current || !canvasRef.current) {
        if (stream) {
          requestRef.current = requestAnimationFrame(scanLoop);
        }
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Video must be active
      if (video.readyState === 4 && !isScanning) {
        const minDim = Math.min(video.videoWidth, video.videoHeight);
        const targetSize = Math.round(minDim * 0.42);
        const sw = targetSize;
        const sh = targetSize;
        const sx = Math.round((video.videoWidth - sw) / 2);
        const sy = Math.round((video.videoHeight - sh) / 2);

        // 1. ADD DETECTION COOLDOWN: If Date.now() - lastDetectionTime.current < 5000, skip all detection logic for this frame
        if (Date.now() - lastDetectionTime.current < 5000) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw a beautiful green target guide showing celebration cooldown status
            ctx.strokeStyle = '#10B981';
            ctx.lineWidth = 4;
            ctx.strokeRect(sx, sy, sw, sh);
            
            ctx.fillStyle = '#10B981';
            ctx.fillRect(sx, sy - 30, sw, 30);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 13px "Lexend", sans-serif';
            ctx.fillText("🌟 GREAT JOB! NEXT SHAPE SOON... 🌟", sx + 10, sy - 10);
          }
          requestRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        isScanning = true;
        
        try {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Wrap mathematical contour analysis safely in an inner try-catch
            let result = null;
            try {
              result = detectShape(video, null, sensitivity);
            } catch (err) {
              console.warn("Contour computation skipped gracefully:", err);
            }
            
            if (result && result.bbox) {
              setDetectedShapeInfo(result);

              const box = result.bbox;
              
              if (box.x !== undefined && box.y !== undefined && box.width !== undefined && box.height !== undefined) {
                // Update last detected timestamp if any actual shape is seen
                if (result.shapeName !== 'scanning') {
                  lastDetectedTimeRef.current = Date.now();
                }

                // 2. ADD CONFIDENCE THRESHOLD: Determine if the detection is valid (confidence >= 70)
                const isValid = result.shapeName !== 'scanning' && result.confidence >= 70;
                
                // 5. Draw the detected contours in green (for valid detections) and red (for rejected ones)
                const outlineColor = isValid ? '#10B981' : '#EF4444';

                // 1. Draw permanent targeting guide box (dotted white outline in center)
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 6]);
                ctx.strokeRect(box.x, box.y, box.width, box.height);
                ctx.setLineDash([]); // Reset line dash

                // 5. Draw raw traced edge points in green/red
                if (result.contourPoints && result.contourPoints.length > 0) {
                  ctx.fillStyle = isValid ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'; // green/red translucent dots
                  result.contourPoints.forEach(pt => {
                    const rx = box.x + (pt.x / 120) * box.width;
                    const ry = box.y + (pt.y / 120) * box.height;
                    ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3); // draw raw contour dots
                  });
                }

                // 5. Draw simplified polygon lines in green/red
                if (result.simplifiedPoints && result.simplifiedPoints.length > 0) {
                  ctx.strokeStyle = outlineColor; // green/red connector
                  ctx.lineWidth = 3;
                  ctx.beginPath();
                  result.simplifiedPoints.forEach((pt, i) => {
                    const rx = box.x + (pt.x / 120) * box.width;
                    const ry = box.y + (pt.y / 120) * box.height;
                    if (i === 0) ctx.moveTo(rx, ry);
                    else ctx.lineTo(rx, ry);
                  });
                  ctx.closePath();
                  ctx.stroke();

                  // Draw circles on simplified corners/vertices in green/red
                  ctx.fillStyle = outlineColor; // green/red vertex circles
                  result.simplifiedPoints.forEach(pt => {
                    const rx = box.x + (pt.x / 120) * box.width;
                    const ry = box.y + (pt.y / 120) * box.height;
                    ctx.beginPath();
                    ctx.arc(rx, ry, 5, 0, 2 * Math.PI);
                    ctx.fill();
                  });
                }

                // 1, 2 & 5. Draw shape-level bounding box and display confidence % as text
                if (result.shapeName !== 'scanning' && result.shapeBbox) {
                  const sbox = result.shapeBbox;
                  const isMatching = result.shapeName === targetShape;
                  
                  // 3. Shape Stability counter check
                  if (result.confidence >= 70) {
                    if (result.shapeName === lastDetectedShapeNameRef.current) {
                      consecutiveFramesRef.current += 1;
                    } else {
                      lastDetectedShapeNameRef.current = result.shapeName;
                      consecutiveFramesRef.current = 1;
                    }
                  } else {
                    consecutiveFramesRef.current = 0;
                    lastDetectedShapeNameRef.current = '';
                  }

                  const isStable = consecutiveFramesRef.current >= 10;
                  
                  // Bounding Box outline color
                  ctx.strokeStyle = outlineColor;
                  ctx.lineWidth = 4;
                  ctx.strokeRect(sbox.x, sbox.y, sbox.width, sbox.height);

                  // Adaptive label coordinates to prevent off-screen clip-off
                  const rectY = sbox.y - 30 < 5 ? sbox.y + sbox.height : sbox.y - 30;
                  const labelY = sbox.y - 30 < 5 ? sbox.y + sbox.height + 20 : sbox.y - 10;

                  ctx.fillStyle = outlineColor;
                  ctx.fillRect(sbox.x, rectY, Math.min(sbox.width, 240), 30);
                  
                  ctx.fillStyle = '#FFFFFF';
                  ctx.font = 'bold 13px "Lexend", sans-serif';
                  
                  // Display shape status, confidence %, and stability count on canvas
                  const stableText = isStable ? "READY" : `${consecutiveFramesRef.current}/10`;
                  const displayText = `${result.shapeName.toUpperCase()} (${result.confidence}%) [${stableText}]`;
                  ctx.fillText(displayText, sbox.x + 10, labelY);

                  // 2 & 3. Announce shape only if confidence is >= 70% and consecutive stability frames count is >= 10
                  if (matchingActive && isMatching && isValid && isStable) {
                    lastDetectionTime.current = Date.now(); // update last announcement timestamp
                    handleCorrectAnswer(result.shapeName);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn("Shape detector sweep exception:", e);
        } finally {
          isScanning = false;
        }
      }
      
      if (stream) {
        requestRef.current = requestAnimationFrame(scanLoop);
      }
    };

    requestRef.current = requestAnimationFrame(scanLoop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [loadingGame, stream, targetShape, matchingActive, sandboxMode, sensitivity]);


  const handleCorrectAnswer = async (shapeDetected) => {
    setMatchingActive(false);
    setBuddyState('happy');
    setBuddyText(`Splendid! I recognized a beautiful ${shapeDetected}! Great eyes! 🎉`);
    setScore(prev => prev + 1);

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    await awardStars(5);
    await incrementMission(1);

    await logInteractionTelemetry(true, shapeDetected);

    setTimeout(() => {
      pickNewTargetShape();
    }, 4500);
  };

  const handleSandboxClick = (shape) => {
    if (!matchingActive) return;

    if (shape === targetShape) {
      lastDetectionTime.current = Date.now(); // update last announcement timestamp
      handleCorrectAnswer(shape);
    } else {
      setBuddyState('sad');
      setBuddyText(`Hmm, that looks like a ${shape}, but we are hunting for a ${targetShape}! Try again! 📐`);
      logInteractionTelemetry(false, shape);
      setTimeout(() => {
        setBuddyState('idle');
        setBuddyText(`Can you find or draw a ${targetShape}?`);
      }, 3000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Game Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-4 border-curio-slate shadow-playful">
        <div className="flex items-center gap-2">
          <span className="text-3xl">📐</span>
          <div>
            <h3 className="text-xl font-black text-curio-slate">Shape Detective</h3>
            <p className="text-xs font-semibold text-slate-400">Trace outlines, vertices, and corners!</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-curio-blue text-white px-3 py-1 rounded-full text-sm font-bold border-2 border-curio-slate flex items-center gap-1 shadow-playful">
            <Star className="w-4 h-4 fill-white" />
            <span>Shapes: {score}</span>
          </div>

          <button 
            onClick={onBack}
            className="bg-slate-100 hover:bg-slate-200 border-2 border-curio-slate text-curio-slate font-extrabold px-3 py-1.5 rounded-2xl text-xs uppercase cursor-pointer"
          >
            ◀ Lobby
          </button>
        </div>
      </div>

      <AIBuddy 
        skin={childProfile?.companion || 'sparky'} 
        state={buddyState} 
        text={buddyText} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Video feed / Sandbox */}
        <div className="lg:col-span-2 bg-white p-4 rounded-4xl border-4 border-curio-slate shadow-playful-blue flex flex-col items-center relative min-h-[350px]">
          
          {sandboxMode ? (
            <div className="flex flex-col items-center justify-center w-full h-full py-8 space-y-6">
              <div className="text-center space-y-1">
                <span className="text-5xl block animate-bounce-slow">📐</span>
                <h4 className="font-extrabold text-curio-slate text-lg uppercase">Shape Sandbox</h4>
                <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">
                  Camera is disabled. Tap the correct geometric shape shown below to help your buddy check!
                </p>
              </div>

              <div className="flex justify-center gap-6 max-w-md w-full px-4">
                {shapesPool.map((shape) => {
                  const shapeEmojis = {
                    circle: '🔵 Circle',
                    triangle: '🔺 Triangle',
                    square: '🟩 Square',
                  };

                  return (
                    <button
                      key={shape}
                      onClick={() => handleSandboxClick(shape)}
                      className="px-6 py-5 bg-white hover:bg-curio-blue-light border-4 border-curio-slate rounded-3xl font-extrabold text-curio-slate text-sm uppercase transition duration-150 transform hover:scale-105 active:scale-95 shadow-playful-blue cursor-pointer"
                    >
                      {shapeEmojis[shape]}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="w-full relative">
              <div className="relative w-full h-full overflow-hidden rounded-3xl border-4 border-curio-slate bg-black flex items-center justify-center">
                
                <video 
                  ref={videoRef}
                  className="w-full h-auto aspect-video object-cover"
                  muted
                  playsInline
                />

                <canvas 
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {/* 1. Detection Guide target zone box overlay (breathing animation) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[40%] aspect-square border-6 border-dashed border-white/60 rounded-4xl flex flex-col items-center justify-between p-2.5 animate-pulse relative bg-white/5 backdrop-blur-[0.5px]">
                    <div className="w-full flex justify-between text-xs text-white/80">
                      <span>📐</span>
                      <span>✏️</span>
                    </div>
                    <span className="text-[10px] font-black text-white bg-curio-slate/60 px-2 py-0.5 rounded-full border border-white/30 tracking-wider">
                      Guide Target Box
                    </span>
                    <div className="w-full flex justify-between text-xs text-white/80">
                      <span>🔵</span>
                      <span>🟩</span>
                    </div>
                  </div>
                </div>

                {/* Camera Offline screen */}
                {(cameraError || !hasPermission) && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center space-y-4 text-white z-20">
                    <AlertCircle className="w-12 h-12 text-curio-orange" />
                    <div className="space-y-1 max-w-xs">
                      <h4 className="font-extrabold text-base">Camera Required</h4>
                      <p className="text-xs text-slate-400 leading-normal">
                        We need camera access for custom edge contour recognition. You can play in button sandbox mode below!
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSandboxMode(true);
                        stopCamera();
                      }}
                      className="bg-curio-yellow text-curio-slate-dark px-4 py-2 rounded-2xl text-xs font-black uppercase border-2 border-curio-slate shadow-playful"
                    >
                      🎮 Play in Sandbox
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Sensitivity slider UI for hand-drawn calibration */}
              {!cameraError && hasPermission && (
                <div className="bg-slate-50 p-4 rounded-3xl border-4 border-curio-slate shadow-playful mt-4 space-y-2">
                  <div className="flex justify-between items-center text-xs font-black text-curio-slate uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Info className="w-4 h-4 text-curio-purple" />
                      Adjust Crayon / Pen Sensitivity
                    </span>
                    <span className="bg-curio-purple text-white px-2.5 py-0.5 rounded-full font-bold">
                      Threshold: {sensitivity}
                    </span>
                  </div>
                  
                  <input 
                    type="range"
                    min="30"
                    max="140"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(parseInt(e.target.value))}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-curio-purple"
                  />

                  <div className="flex justify-between text-[10px] font-black text-slate-400">
                    <span>🔥 Highly Sensitive (Faint Pencil / Thin drawings)</span>
                    <span>❄️ Less Sensitive (Thick bold text / Sharp plastics)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Toggle button */}
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
            className="mt-4 text-xs font-black text-curio-purple hover:underline bg-slate-100 hover:bg-slate-200 border-2 border-curio-slate px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-playful cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{sandboxMode ? "Use Camera Mode" : "Switch to Sandbox Buttons"}</span>
          </button>

        </div>

        {/* Right Info pane */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-4xl border-4 border-curio-slate shadow-playful-purple text-center space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Target Shape</h4>
            
            <div className="flex justify-center">
              <motion.div 
                className="w-28 h-28 rounded-3xl border-4 border-curio-slate shadow-playful bg-curio-blue-light flex items-center justify-center text-5xl"
                animate={{ rotate: targetShape === 'square' ? [0, 90, 90, 0] : 0 }}
                transition={{ repeat: Infinity, duration: 3, repeatDelay: 2 }}
              >
                {targetShape === 'circle' ? '🔵' :
                 targetShape === 'triangle' ? '🔺' : '🟩'}
              </motion.div>
            </div>

            <h5 className="text-2xl font-black uppercase text-curio-slate tracking-wider">
              {targetShape}
            </h5>
          </div>

          {!sandboxMode && (
            <div className="bg-white p-5 rounded-4xl border-4 border-curio-slate shadow-playful space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-curio-blue" />
                Contour Vision Telemetry
              </h4>

              {detectedShapeInfo ? (
                <div className="space-y-3 text-xs font-semibold text-slate-600">
                  <p>🔹 Shape Class: <strong className="text-curio-slate uppercase">{detectedShapeInfo.shapeName}</strong></p>
                  
                  {/* 6. Confidence score bar display */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-[10px]">
                      <span>MATCHING RATING</span>
                      <strong className="text-curio-purple">{detectedShapeInfo.confidence}%</strong>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full border border-slate-200 overflow-hidden">
                      <div 
                        className="h-full bg-bubblegum-gradient"
                        style={{ width: `${detectedShapeInfo.confidence}%` }}
                      ></div>
                    </div>
                  </div>

                  <p>🔹 Corners Found: <strong className="text-curio-slate">{detectedShapeInfo.cornersCount}</strong></p>
                  <p>🔹 Circularity Factor: <strong className="text-curio-slate">{Math.round(detectedShapeInfo.circularity * 100)}%</strong></p>

                  <div className={`p-2 rounded-xl border-2 text-center text-xs font-bold ${
                    detectedShapeInfo.shapeName === targetShape && detectedShapeInfo.confidence >= 55
                      ? 'bg-curio-green/10 border-curio-green text-curio-green animate-pulse'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    {detectedShapeInfo.shapeName === targetShape && detectedShapeInfo.confidence >= 55 
                      ? "🎉 SHAPE MATCHED!" 
                      : "🔍 Move shape inside targeting box"}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-4">
                  Hold a clear hand-drawn outline shape in front of the scanner...
                </p>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
