import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, RotateCcw, HelpCircle, Trash2, RefreshCw, Sparkles, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useHandTracking } from '../hooks/useHandTracking';
import { matchShape } from '../utils/shapeMatcher';
import AIBuddy from '../components/AIBuddy';
import { collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';

const SHAPE_LIST = ['circle', 'square', 'triangle', 'star', 'heart'];

export default function AirDraw({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission, incrementStat } = useAuth();

  // Mode settings
  const [sandboxMode, setSandboxMode] = useState(false);
  const [activeShapeIndex, setActiveShapeIndex] = useState(0);
  const targetShape = SHAPE_LIST[activeShapeIndex];

  // Game states
  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [matchingActive, setMatchingActive] = useState(true);
  const [showAdvanceButton, setShowAdvanceButton] = useState(false);

  // Drawing paths: array of strokes, each stroke is an array of {x, y}
  const [strokes, setStrokes] = useState([]);
  const [activeStroke, setActiveStroke] = useState([]);
  const [isMouseDrawing, setIsMouseDrawing] = useState(false);

  // Particle sparkle animation states
  const [particles, setParticles] = useState([]);

  // Custom drawing and skeleton refs
  const drawingCanvasRef = useRef(null);
  const particlesCanvasRef = useRef(null);
  const isPinchingPrevRef = useRef(false);

  // Initialize hand tracking hook
  const {
    indexFingerTip,
    isPinching,
    isHandDetected,
    isLoadingModels,
    videoRef,
    canvasRef: skeletonCanvasRef,
    stopTracking
  } = useHandTracking({ active: !sandboxMode });

  // Guide shape drawer helpers
  const drawStarGuide = (ctx, cx, cy, spikes, outerRadius, innerRadius) => {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.closePath();
  };

  const drawHeartGuide = (ctx, cx, cy, scale) => {
    ctx.moveTo(cx, cy + 3.2 * scale);
    for (let t = 0; t <= 2 * Math.PI; t += 0.05) {
      const x = cx + scale * 16 * Math.pow(Math.sin(t), 3);
      const y = cy - scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  const drawGuideOutline = (ctx) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 79, 163, 0.45)'; // Semi-transparent pink guide
    ctx.lineWidth = 3.5;
    ctx.setLineDash([8, 8]); // faint dotted path

    ctx.beginPath();
    if (targetShape === 'circle') {
      ctx.arc(320, 240, 130, 0, 2 * Math.PI);
    } else if (targetShape === 'square') {
      ctx.strokeRect(200, 120, 240, 240);
    } else if (targetShape === 'triangle') {
      ctx.moveTo(320, 100);
      ctx.lineTo(170, 370);
      ctx.lineTo(470, 370);
      ctx.closePath();
    } else if (targetShape === 'star') {
      drawStarGuide(ctx, 320, 240, 5, 140, 60);
    } else if (targetShape === 'heart') {
      drawHeartGuide(ctx, 320, 220, 12);
    }
    ctx.stroke();
    ctx.restore();
  };

  // Sparkle generator triggers
  const spawnSparkles = (cx, cy) => {
    const freshParticles = [];
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const speed = 1.5 + Math.random() * 3.5;
      freshParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 6,
        alpha: 1.0,
        color: `hsl(${Math.random() * 360}, 100%, 70%)`
      });
    }
    setParticles(prev => [...prev, ...freshParticles]);
  };

  // Particle Physics Animation Loop
  useEffect(() => {
    let animId;
    const canvas = particlesCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const updateParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      setParticles(prev => {
        const remaining = [];
        prev.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.035; // fade out quickly
          
          if (p.alpha > 0) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
            remaining.push(p);
          }
        });
        return remaining;
      });

      animId = requestAnimationFrame(updateParticles);
    };

    animId = requestAnimationFrame(updateParticles);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Sync game buddy text on shape shift
  useEffect(() => {
    setBuddyText(`Can you draw a beautiful ${targetShape.toUpperCase()} in the air? ✨ Tap clear and pinch to draw!`);
    setBuddyState('idle');
    setAttempts(0);
    setStrokes([]);
    setActiveStroke([]);
    setMatchingActive(true);
    setShowAdvanceButton(false);
  }, [activeShapeIndex, targetShape]);

  // Main drawing engine matching path updates
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Draw background guide + all strokes
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGuideOutline(ctx);

    const drawSingleStroke = (path) => {
      if (path.length < 2) return;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < path.length; i++) {
        const p1 = path[i - 1];
        const p2 = path[i];
        
        // Rainbow trails
        const hue = (i * 3) % 360;
        ctx.strokeStyle = `hsl(${hue}, 95%, 60%)`;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    };

    strokes.forEach(stroke => drawSingleStroke(stroke));
    if (activeStroke.length > 0) {
      drawSingleStroke(activeStroke);
    }
  }, [strokes, activeStroke, targetShape]);

  // Hand tracking pinch trigger handler
  useEffect(() => {
    if (sandboxMode || !isHandDetected || isLoadingModels) return;

    if (isPinching) {
      if (!isPinchingPrevRef.current) {
        spawnSparkles(indexFingerTip.x, indexFingerTip.y);
      }
      setActiveStroke(prev => [...prev, indexFingerTip]);
    } else {
      if (isPinchingPrevRef.current && activeStroke.length > 3) {
        setStrokes(prev => [...prev, activeStroke]);
        setActiveStroke([]);
      }
    }

    isPinchingPrevRef.current = isPinching;
  }, [isPinching, indexFingerTip, isHandDetected, isLoadingModels, sandboxMode]);

  // Clean up drawing streams on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Sandbox Mouse / Touch event drawing
  const getCanvasCoords = (e) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const handleDrawStart = (e) => {
    if (!sandboxMode || !matchingActive) return;
    setIsMouseDrawing(true);
    const coords = getCanvasCoords(e);
    setActiveStroke([coords]);
    spawnSparkles(coords.x, coords.y);
  };

  const handleDrawMove = (e) => {
    if (!sandboxMode || !isMouseDrawing || !matchingActive) return;
    const coords = getCanvasCoords(e);
    setActiveStroke(prev => [...prev, coords]);
  };

  const handleDrawEnd = () => {
    if (!sandboxMode || !isMouseDrawing || !matchingActive) return;
    setIsMouseDrawing(false);
    if (activeStroke.length > 3) {
      setStrokes(prev => [...prev, activeStroke]);
    }
    setActiveStroke([]);
  };

  const handleUndo = () => {
    if (!matchingActive) return;
    setStrokes(prev => prev.slice(0, prev.length - 1));
    setActiveStroke([]);
  };

  const handleClear = () => {
    if (!matchingActive) return;
    setStrokes([]);
    setActiveStroke([]);
  };

  const logDrawingTelemetry = async (success, matchConf, drawnClass) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'air-draw',
      success,
      target: targetShape,
      detected: `${drawnClass} (${matchConf}%)`,
      emotion: success ? 'happy' : 'sad',
      difficulty: 'HARD'
    };

    if (isValidConfig && db && currentUser) {
      try {
        await addDoc(collection(db, 'interactions', currentUser.uid, 'logs'), logData);
      } catch (err) {
        console.error("Firestore logging failed:", err);
      }
    } else {
      console.log("📝 Offline Drawing Telemetry Logged:", logData);
    }
  };

  const handleSubmitDrawing = async () => {
    if (!matchingActive) return;

    const combinedPath = strokes.flat();

    if (combinedPath.length < 15) {
      setBuddyState('sad');
      setBuddyText("🧐 That path is too short to scan! Try drawing a larger shape!");
      setTimeout(() => setBuddyState('idle'), 3000);
      return;
    }

    const nextAttempt = attempts + 1;
    setAttempts(nextAttempt);

    const matchResult = matchShape(combinedPath, targetShape);

    if (matchResult.match) {
      setMatchingActive(false);
      setBuddyState('happy');
      setBuddyText(`Amazing! That is a stellar ${targetShape.toUpperCase()}! ${matchResult.feedback}`);

      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 }
      });

      // Score distribution: Attempt 1 = 3 Stars, Attempt 2 = 1 Star, Attempt 3+ = 0 Stars
      let starsAwarded = 0;
      if (nextAttempt === 1) starsAwarded = 3;
      else if (nextAttempt === 2) starsAwarded = 1;

      setScore(prev => prev + starsAwarded);
      if (starsAwarded > 0) {
        await awardStars(starsAwarded, 'air-draw');
      }

      await incrementStat('airDrawShapes', 1);
      await incrementMission(1); // complete daily missions

      await logDrawingTelemetry(true, matchResult.confidence, targetShape);

      setTimeout(() => {
        advanceShape();
      }, 4500);

    } else {
      setBuddyState('sad');
      if (nextAttempt >= 3) {
        setMatchingActive(false);
        setBuddyText(`Good try! That is tricky. Let's move to the next shape together! 🦊`);
        await logDrawingTelemetry(false, matchResult.confidence, targetShape);
        
        setTimeout(() => {
          advanceShape();
        }, 4000);
      } else {
        setBuddyText(`Almost! ${matchResult.feedback} Attempt ${nextAttempt}/3. Try clear and draw again! 💪`);
        await logDrawingTelemetry(false, matchResult.confidence, targetShape);
      }
    }
  };

  const advanceShape = () => {
    if (activeShapeIndex < SHAPE_LIST.length - 1) {
      setActiveShapeIndex(prev => prev + 1);
    } else {
      setBuddyState('happy');
      setBuddyText(`Hooray! You completed all the AirDraw shapes! You are a master shape artist! 🏆`);
      setShowAdvanceButton(true);
    }
  };

  const resetGame = () => {
    setActiveShapeIndex(0);
    setScore(0);
    setStrokes([]);
    setActiveStroke([]);
    setShowAdvanceButton(false);
    setMatchingActive(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Game Header */}
      <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-4 rounded-3xl border-3 border-white/60 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-3xl">✨🎨</span>
          <div>
            <h3 className="text-base font-black text-curio-slate">AirDraw Shape Room</h3>
            <p className="text-[10px] font-bold text-slate-400">Pinch fingers in the air to draw shapes!</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-curio-yellow text-curio-slate-dark px-3.5 py-1 rounded-full text-xs font-black border-2 border-curio-slate flex items-center gap-1 shadow">
            <Star className="w-3.5 h-3.5 fill-curio-yellow text-curio-yellow-dark" />
            <span>Stars: {score}</span>
          </div>

          <button 
            onClick={onBack}
            className="bg-slate-100 hover:bg-slate-200 border-2 border-curio-slate text-curio-slate font-black px-3.5 py-1.5 rounded-2xl text-xs uppercase cursor-pointer transition transform active:scale-95 shadow"
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
        
        {/* Left Screen: Camera / Sandbox Drawing Canvas */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md p-4 rounded-4xl border-3 border-white/60 shadow-lg flex flex-col items-center relative min-h-[350px]">
          
          {showAdvanceButton ? (
            /* Cycle Clear Victory Pane */
            <motion.div
              key="win-pane"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center space-y-6 w-full select-none"
            >
              <div className="text-7xl block animate-bounce-slow">🏆👑</div>
              <h4 className="font-black text-2xl text-curio-slate uppercase tracking-wider">AirDraw Artist!</h4>
              <p className="text-slate-500 font-bold max-w-xs mx-auto text-sm">
                Incredible finger control! You successfully drew all shapes in the air!
              </p>

              <div className="flex gap-4">
                <button
                  onClick={resetGame}
                  className="bg-curio-green hover:bg-curio-green-dark text-white font-black py-3 px-6 rounded-2xl border-3 border-curio-green-dark shadow-playful-green transition active:scale-95 cursor-pointer flex items-center gap-1.5 uppercase text-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Start New Run</span>
                </button>
                <button
                  onClick={onBack}
                  className="bg-slate-100 hover:bg-slate-200 border-2 border-curio-slate text-curio-slate font-black py-3 px-6 rounded-2xl transition active:scale-95 cursor-pointer uppercase text-xs shadow"
                >
                  Return to Lobby ◀
                </button>
              </div>
            </motion.div>
          ) : (
            /* Draw Screen Frame wrapped inside cute toy frame */
            <div 
              className={`relative w-full aspect-video overflow-hidden rounded-3xl border-6 border-curio-slate bg-black flex items-center justify-center ${
                sandboxMode ? 'cursor-crosshair' : ''
              }`}
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={handleDrawEnd}
              onTouchStart={handleDrawStart}
              onTouchMove={handleDrawMove}
              onTouchEnd={handleDrawEnd}
            >
              {/* 1. Camera Feeds (Mirrored) */}
              {!sandboxMode && (
                <video 
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                  muted
                  playsInline
                />
              )}

              {/* Sandbox Background */}
              {sandboxMode && (
                <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none opacity-20">
                  <span className="text-8xl">✍️🎨</span>
                </div>
              )}

              {/* 2. Skeleton Canvas (Mirrored overlay via hook) */}
              {!sandboxMode && (
                <canvas 
                  ref={skeletonCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none z-10"
                  width={640}
                  height={480}
                />
              )}

              {/* 3. Drawing Trails Canvas */}
              <canvas 
                ref={drawingCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-20"
                width={640}
                height={480}
              />

              {/* 4. Particle Sparkles Canvas */}
              <canvas 
                ref={particlesCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-30"
                width={640}
                height={480}
              />

              {/* Loader overlay */}
              {!sandboxMode && isLoadingModels && (
                <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-6 text-center space-y-3 z-40 text-white select-none">
                  <div className="w-10 h-10 border-4 border-slate-700 border-t-curio-pink rounded-full animate-spin" />
                  <h4 className="font-extrabold text-sm">Loading Hand Detector...</h4>
                  <p className="text-[10px] text-slate-400 font-bold max-w-xs leading-normal">
                    AI classifier models are booting up. Please ensure camera access is granted!
                  </p>
                </div>
              )}

              {/* Pinch indicator indicator */}
              {!sandboxMode && isHandDetected && (
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full border-2 text-[9px] font-black uppercase tracking-wider z-50 shadow select-none ${
                  isPinching 
                    ? 'bg-curio-green text-white border-curio-slate animate-pulse' 
                    : 'bg-curio-yellow text-curio-slate border-curio-slate'
                }`}>
                  {isPinching ? "✍️ DRAWING ACTIVE" : "✋ CAMERA SCANNING"}
                </div>
              )}
            </div>
          )}

          {/* Action controllers */}
          {!showAdvanceButton && (
            <div className="w-full flex justify-between items-center mt-4">
              <button
                onClick={() => {
                  const nextMode = !sandboxMode;
                  setSandboxMode(nextMode);
                  handleClear();
                  if (nextMode) {
                    stopTracking();
                  }
                }}
                className="text-xs font-black text-curio-purple hover:underline bg-slate-100/60 hover:bg-slate-200 border-2 border-curio-slate px-3 py-2 rounded-xl flex items-center gap-1 shadow cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{sandboxMode ? "Use Active Hand Camera" : "Switch to Button Sandbox"}</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleUndo}
                  disabled={strokes.length === 0}
                  className="bg-slate-100 border-2 border-curio-slate font-black px-3 py-2 rounded-xl text-xs uppercase cursor-pointer flex items-center gap-1 shadow hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Undo ↩
                </button>
                <button
                  onClick={handleClear}
                  disabled={strokes.length === 0}
                  className="bg-red-50 text-red-600 border-2 border-curio-slate font-black px-3 py-2 rounded-xl text-xs uppercase cursor-pointer flex items-center gap-1 shadow hover:bg-red-100 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear 🧹</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Stats: Challenge Guidelines */}
        <div className="space-y-6 select-none">
          
          {/* Target Card */}
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg text-center space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Draw Target</h4>
            
            <div className="w-20 h-20 rounded-full border-3 border-curio-slate bg-slate-50 mx-auto flex items-center justify-center text-4xl shadow relative">
              {targetShape === 'circle' ? '🔴' :
               targetShape === 'square' ? '🟦' :
               targetShape === 'triangle' ? '🔺' :
               targetShape === 'star' ? '⭐️' :
               targetShape === 'heart' ? '💖' : '✍️'}
            </div>

            <div className="space-y-1">
              <h5 className="text-lg font-black uppercase text-curio-slate tracking-wider font-kids">
                {targetShape}
              </h5>
              <p className="text-[10px] font-bold text-curio-purple uppercase tracking-wider">
                Attempt {attempts}/3
              </p>
            </div>

            <button
              onClick={handleSubmitDrawing}
              disabled={strokes.length === 0 || !matchingActive}
              className="w-full bg-curio-green hover:bg-curio-green-dark text-white font-black py-4 px-6 rounded-2xl border-4 border-curio-slate shadow-playful-green hover:shadow-none hover:translate-y-0.5 active:scale-95 transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none text-xs uppercase tracking-wide"
            >
              Submit My Shape! ✅
            </button>
          </div>

          {/* Guidelines notebook */}
          <div className="bg-white/70 backdrop-blur-md p-5 rounded-4xl border-3 border-white/60 shadow-lg space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-curio-blue" />
              How to Play AirDraw
            </h4>
            
            <ul className="text-[10px] text-slate-500 font-bold space-y-2 leading-relaxed list-disc list-inside">
              <li>Pinch thumb and index finger to <span className="text-curio-pink">start drawing</span>!</li>
              <li>Spread fingers apart to <span className="text-curio-orange">stop drawing</span>.</li>
              <li>Dotted pink outline shows the target guide!</li>
              <li>First try matches award <span className="text-curio-yellow-dark">3 Stars</span>, second try awards <span className="text-curio-yellow-dark">1 Star</span>.</li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
