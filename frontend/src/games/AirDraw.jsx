import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, RotateCcw, HelpCircle, Trash2, RefreshCw, Sparkles, Check, Palette, Eye, ArrowRight, Save } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useHandTracking } from '../hooks/useHandTracking';
import { matchShape } from '../utils/shapeMatcher';
import AIBuddy from '../components/AIBuddy';
import { collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';
import { getLevelConfig, getNextLevelStars } from '../utils/levelSystem.js';
import { calculateStars } from '../utils/scoringEngine.js';
import GameHeader from '../components/game/GameHeader.jsx';
import GameComplete from '../components/game/GameComplete.jsx';
import LevelSelect from '../components/game/LevelSelect.jsx';

import { useSound } from '../hooks/useSound.js';

export default function AirDraw({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission, incrementStat } = useAuth();
  const { playClick, playCorrect, playWrong, playWin } = useSound();

  // Mode settings
  const [sandboxMode, setSandboxMode] = useState(false);
  const [freeDrawMode, setFreeDrawMode] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gamePhase, setGamePhase] = useState('menu'); // 'menu' | 'playing' | 'complete'

  // Shape Lists
  const [shapesList, setShapesList] = useState(['circle']);
  const [activeShapeIndex, setActiveShapeIndex] = useState(0);
  const targetShape = freeDrawMode ? 'free' : (shapesList[activeShapeIndex] || 'circle');

  // Drawing Tools state
  const [brushColor, setBrushColor] = useState('rainbow');
  const [brushSize, setBrushSize] = useState(10);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryDrawings, setGalleryDrawings] = useState([]);

  // Game states
  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [attempts, setAttempts] = useState(0);
  const [matchingActive, setMatchingActive] = useState(true);

  // Timing
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);

  // Drawing paths
  const [strokes, setStrokes] = useState([]);
  const [activeStroke, setActiveStroke] = useState([]);
  const [isMouseDrawing, setIsMouseDrawing] = useState(false);

  // Sparkles
  const [particles, setParticles] = useState([]);

  // Stars tracking
  const [earnedStars, setEarnedStars] = useState(0);
  const [calculatedPoints, setCalculatedPoints] = useState(0);
  const [gameStars, setGameStars] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  // Custom drawing and skeleton refs
  const drawingCanvasRef = useRef(null);
  const particlesCanvasRef = useRef(null);
  const isPinchingPrevRef = useRef(false);

  // Initialize hand tracking hook with enhanced calibrations and smoothing
  const {
    indexFingerTip,
    isPinching, // Debounced and stable pinch drawing
    isHandDetected,
    isLoadingModels,
    videoRef,
    canvasRef: skeletonCanvasRef,
    stopTracking,
    setCalibrationOffset,
    calibrationOffset
  } = useHandTracking({ active: !sandboxMode && gamePhase === 'playing' });

  const config = getLevelConfig('airDraw', currentLevel) || {};

  // Load level stars & gallery from localStorage on mount
  useEffect(() => {
    if (childProfile) {
      const storageKey = `curiokids_stars_airDraw_${childProfile.uid || 'guest'}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setGameStars(JSON.parse(saved));
      }

      const drawingsKey = `curiokids_drawings_${childProfile.uid || 'guest'}`;
      const savedDrawings = localStorage.getItem(drawingsKey);
      if (savedDrawings) {
        setGalleryDrawings(JSON.parse(savedDrawings));
      }
    }
  }, [childProfile]);

  // Sync game buddy text on shape shift
  useEffect(() => {
    if (gamePhase !== 'playing') return;

    if (freeDrawMode) {
      setBuddyText("You're in Free Draw! 🎨 Draw anything you want with your finger! Tap save when done!");
      setBuddyState('idle');
      setStrokes([]);
      setActiveStroke([]);
    } else {
      setBuddyText(`Can you draw a beautiful ${targetShape.toUpperCase()} in the air? ✨ Pinch and hold to draw!`);
      setBuddyState('idle');
      setAttempts(0);
      setStrokes([]);
      setActiveStroke([]);
      setMatchingActive(true);
      setTimeTaken(0);
      setTimerSeconds(config.timeLimit || 30);
    }
  }, [activeShapeIndex, targetShape, freeDrawMode, gamePhase]);

  // Live Timer Effect for Target Mode
  useEffect(() => {
    if (gamePhase !== 'playing' || freeDrawMode) return;

    const startTime = Date.now();
    const limit = config.timeLimit || 30;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeTaken(elapsed);

      const remaining = Math.max(0, limit - elapsed);
      setTimerSeconds(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        handleGameLoss();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase, targetShape, freeDrawMode]);

  // Guide outline drawer helpers
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
    if (freeDrawMode) return; // No guides in Free Draw

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
    playClick(); // Play drawing active/pinch audio cue
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

  // Main drawing engine matching path updates
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Draw background guide + all strokes
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGuideOutline(ctx);

    const drawSingleStroke = (stroke) => {
      const path = stroke.path || stroke;
      if (path.length < 2) return;
      ctx.lineWidth = stroke.size || 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const strokeColor = stroke.color || 'rainbow';

      if (strokeColor === 'rainbow') {
        for (let i = 1; i < path.length; i++) {
          const p1 = path[i - 1];
          const p2 = path[i];
          const hue = (i * 3) % 360;
          ctx.strokeStyle = `hsl(${hue}, 95%, 60%)`;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
      }
    };

    strokes.forEach(stroke => drawSingleStroke(stroke));
    if (activeStroke.length > 0) {
      drawSingleStroke({ path: activeStroke, color: brushColor, size: brushSize });
    }
  }, [strokes, activeStroke, targetShape, freeDrawMode, brushColor, brushSize]);

  // Hand tracking pinch trigger handler
  useEffect(() => {
    if (sandboxMode || !isHandDetected || isLoadingModels || gamePhase !== 'playing') return;

    if (isPinching) {
      if (!isPinchingPrevRef.current) {
        spawnSparkles(indexFingerTip.x, indexFingerTip.y);
      }
      setActiveStroke(prev => [...prev, indexFingerTip]);
    } else {
      if (isPinchingPrevRef.current && activeStroke.length > 3) {
        setStrokes(prev => [...prev, { path: activeStroke, color: brushColor, size: brushSize }]);
        setActiveStroke([]);
      }
    }

    isPinchingPrevRef.current = isPinching;
  }, [isPinching, indexFingerTip, isHandDetected, isLoadingModels, sandboxMode, gamePhase, brushColor, brushSize]);

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
    if (!sandboxMode || !matchingActive || gamePhase !== 'playing') return;
    setIsMouseDrawing(true);
    const coords = getCanvasCoords(e);
    setActiveStroke([coords]);
    spawnSparkles(coords.x, coords.y);
  };

  const handleDrawMove = (e) => {
    if (!sandboxMode || !isMouseDrawing || !matchingActive || gamePhase !== 'playing') return;
    const coords = getCanvasCoords(e);
    setActiveStroke(prev => [...prev, coords]);
  };

  const handleDrawEnd = () => {
    if (!sandboxMode || !isMouseDrawing || !matchingActive || gamePhase !== 'playing') return;
    setIsMouseDrawing(false);
    if (activeStroke.length > 3) {
      setStrokes(prev => [...prev, { path: activeStroke, color: brushColor, size: brushSize }]);
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

  const handleGameLoss = () => {
    setBuddyState('sad');
    setBuddyText("Oh no! The time ran out on this drawing! Let's start again! ⏰");
    setEarnedStars(0);
    setCalculatedPoints(0);
    setGamePhase('complete');
  };

  const handleCalibrate = () => {
    if (!isHandDetected || !indexFingerTip) {
      setBuddyText("🧐 Keep your hand in view to calibrate!");
      setBuddyState('sad');
      setTimeout(() => setBuddyState('idle'), 2500);
      return;
    }
    
    // Map current hand tracking index finger mapped coordinates back to canvas center (320, 240)
    const currentOffset = calibrationOffset || { x: 0, y: 0 };
    const rawX = indexFingerTip.x - currentOffset.x;
    const rawY = indexFingerTip.y - currentOffset.y;

    const newOffsetX = 320 - rawX;
    const newOffsetY = 240 - rawY;

    setCalibrationOffset({ x: newOffsetX, y: newOffsetY });

    playClick(); // Sound click
    spawnSparkles(320, 240); // Flash center point sparkles
    setBuddyText("🎯 Hand tracking calibrated perfectly to the center! Draw away! ✨");
    setBuddyState('happy');
    setTimeout(() => setBuddyState('idle'), 3000);
  };

  const logDrawingTelemetry = async (success, matchConf, drawnClass) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'air-draw',
      success,
      target: targetShape,
      detected: `${drawnClass} (${matchConf}%)`,
      emotion: success ? 'happy' : 'sad'
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

  const handleSaveDrawing = async () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas || strokes.length === 0) return;

    // Custom secondary canvas to composite background colors (so drawing is not transparent in saved list)
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = canvas.width;
    compositeCanvas.height = canvas.height;
    const compCtx = compositeCanvas.getContext('2d');

    // Fill background with slate dark color
    compCtx.fillStyle = '#0f172a';
    compCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw lines
    const drawSingleStrokeComp = (stroke) => {
      const path = stroke.path || stroke;
      if (path.length < 2) return;
      compCtx.lineWidth = stroke.size || 10;
      compCtx.lineCap = 'round';
      compCtx.lineJoin = 'round';
      const strokeColor = stroke.color || 'rainbow';

      if (strokeColor === 'rainbow') {
        for (let i = 1; i < path.length; i++) {
          const p1 = path[i - 1];
          const p2 = path[i];
          const hue = (i * 3) % 360;
          compCtx.strokeStyle = `hsl(${hue}, 95%, 60%)`;
          compCtx.beginPath();
          compCtx.moveTo(p1.x, p1.y);
          compCtx.lineTo(p2.x, p2.y);
          compCtx.stroke();
        }
      } else {
        compCtx.strokeStyle = strokeColor;
        compCtx.beginPath();
        compCtx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          compCtx.lineTo(path[i].x, path[i].y);
        }
        compCtx.stroke();
      }
    };

    strokes.forEach(stroke => drawSingleStrokeComp(stroke));

    const imgData = compositeCanvas.toDataURL("image/png");
    const uid = currentUser?.uid || 'guest';

    const drawingRecord = {
      image: imgData,
      timestamp: new Date().toISOString(),
      level: currentLevel,
      freeDraw: freeDrawMode
    };

    // Save to Firestore drawings collection
    if (isValidConfig && db && currentUser) {
      try {
        await addDoc(collection(db, 'children', uid, 'drawings'), drawingRecord);
      } catch (err) {
        console.error("Firestore drawings save failed:", err);
      }
    }

    // Save locally
    const drawingsKey = `curiokids_drawings_${uid}`;
    const updatedGallery = [drawingRecord, ...galleryDrawings].slice(0, 15);
    setGalleryDrawings(updatedGallery);
    localStorage.setItem(drawingsKey, JSON.stringify(updatedGallery));

    setBuddyState('happy');
    setBuddyText("Yay! Your master sketch was saved to your private notebook gallery! 📔🎨");
    setTimeout(() => setBuddyState('idle'), 2500);
  };

  const handleSubmitDrawing = async () => {
    if (!matchingActive || freeDrawMode) return;

    const flatStrokes = strokes.map(s => s.path || s).flat();

    if (flatStrokes.length < 15) {
      setBuddyState('sad');
      setBuddyText("🧐 That is too short! Draw a complete path of the shape!");
      setTimeout(() => setBuddyState('idle'), 3000);
      return;
    }

    const nextAttempt = attempts + 1;
    setAttempts(nextAttempt);

    // Get level tolerance (lower is stricter)
    const tolerance = config.tolerance || 35;
    const matchResult = matchShape(flatStrokes, targetShape);

    // Calculate match confidence (shape Matcher checks accuracy score)
    const shapeAccuracy = matchResult.confidence;
    const minAccuracy = 100 - tolerance;

    if (shapeAccuracy >= minAccuracy) {
      // Play correct match sound
      playCorrect();
      setMatchingActive(false);
      setBuddyState('happy');
      setBuddyText(`Splendid! That is a super clean ${targetShape.toUpperCase()}! Confidence is ${shapeAccuracy}%!`);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      await logDrawingTelemetry(true, shapeAccuracy, targetShape);

      setTimeout(() => {
        advanceShape();
      }, 3500);

    } else {
      // Play incorrect match sound
      playWrong();
      setBuddyState('sad');
      if (nextAttempt >= 3) {
        setMatchingActive(false);
        setBuddyText(`Nice try! Shapes are tricky. Let's move on to the next one! 🦊`);
        await logDrawingTelemetry(false, shapeAccuracy, targetShape);
        
        setTimeout(() => {
          advanceShape();
        }, 3500);
      } else {
        setBuddyText(`Almost! Confidence was ${shapeAccuracy}%. Attempt ${nextAttempt}/3. Clear & Try again! 💪`);
        await logDrawingTelemetry(false, shapeAccuracy, targetShape);
      }
    }
  };

  const advanceShape = () => {
    if (activeShapeIndex < shapesList.length - 1) {
      setActiveShapeIndex(prev => prev + 1);
      setMatchingActive(true);
    } else {
      handleLevelWin();
    }
  };

  const handleLevelWin = async () => {
    // Play win fanfare!
    playWin();
    setBuddyState('happy');
    setBuddyText(`Wonderful! You successfully completed Level ${currentLevel} of AirDraw! 🏆`);

    // Average accuracy estimation based on attempts (e.g. 1st try = 95%, 2nd = 75%, 3rd = 55%)
    const estimatedAccuracy = attempts > 0 ? Math.round(Math.max(50, 100 - (attempts - 1) * 20)) : 95;

    // Calculate Stars
    const { stars, points } = calculateStars('airDraw', currentLevel, {
      accuracy: estimatedAccuracy,
      timeTaken: timeTaken,
      firstTry: (gameStars[currentLevel] || 0) === 0
    });

    setEarnedStars(stars);
    setCalculatedPoints(points);

    // Save level stars locally
    const storageKey = `curiokids_stars_airDraw_${childProfile?.uid || 'guest'}`;
    const updatedStars = { ...gameStars, [currentLevel]: Math.max(gameStars[currentLevel] || 0, stars) };
    setGameStars(updatedStars);
    localStorage.setItem(storageKey, JSON.stringify(updatedStars));

    // Award overall stars to profile
    const previousStars = gameStars[currentLevel] || 0;
    const newStarsGained = Math.max(0, stars - previousStars);
    if (newStarsGained > 0) {
      await awardStars(newStarsGained, 'air-draw');
    }

    // Standard achievements tracking
    await incrementStat('airDrawShapes', shapesList.length);
    await incrementMission(1);

    // Write session log
    const uid = currentUser?.uid || 'guest';
    const sessionData = {
      gameType: 'airDraw',
      level: currentLevel,
      starsEarned: stars,
      pointsEarned: points,
      accuracy: estimatedAccuracy,
      timeTaken: timeTaken,
      timestamp: new Date().toISOString()
    };

    if (isValidConfig && db && currentUser) {
      try {
        await addDoc(collection(db, 'children', uid, 'sessions'), sessionData);
      } catch (err) {
        console.error("Firestore session logging failed:", err);
      }
    } else {
      const sessionKey = `curiokids_sessions_${uid}`;
      const existing = localStorage.getItem(sessionKey);
      const sessions = existing ? JSON.parse(existing) : [];
      sessions.push(sessionData);
      localStorage.setItem(sessionKey, JSON.stringify(sessions));
    }

    setGamePhase('complete');
  };

  const startNewGame = (levelNum = currentLevel) => {
    const activeLevel = levelNum || currentLevel;
    const activeConfig = getLevelConfig('airDraw', activeLevel);
    if (!activeConfig) return;

    setShapesList(activeConfig.shapes || ['circle']);
    setActiveShapeIndex(0);
    setAttempts(0);
    setStrokes([]);
    setActiveStroke([]);
    setMatchingActive(true);
    setTimeTaken(0);
    setTimerSeconds(activeConfig.timeLimit || 30);
    setFreeDrawMode(false);

    setGamePhase('playing');
  };

  const handleNextLevel = () => {
    const nextLevel = currentLevel + 1;
    if (nextLevel <= 5) {
      setCurrentLevel(nextLevel);
      setGamePhase('playing');
      startNewGame(nextLevel);
    } else {
      setGamePhase('menu');
    }
  };

  const paletteColors = [
    { name: 'Rainbow', value: 'rainbow', style: 'bg-gradient-to-r from-red-400 via-green-400 to-blue-400' },
    { name: 'Sky Blue', value: '#3b82f6', style: 'bg-blue-500' },
    { name: 'Violet', value: '#a855f7', style: 'bg-purple-500' },
    { name: 'Emerald', value: '#10b981', style: 'bg-emerald-500' },
    { name: 'Rose', value: '#f43f5e', style: 'bg-rose-500' },
    { name: 'Amber', value: '#f59e0b', style: 'bg-amber-500' }
  ];

  return (
    <div className="space-y-6">
      {gamePhase === 'menu' && (
        <LevelSelect
          gameType="airDraw"
          currentLevel={currentLevel}
          onSelectLevel={(levelNum) => {
            setCurrentLevel(levelNum);
            startNewGame(levelNum);
          }}
          gameStars={gameStars}
        />
      )}

      {gamePhase === 'playing' && (
        <>
          <GameHeader
            gameName="airDraw"
            level={currentLevel}
            levelName={freeDrawMode ? 'Free Drawing' : config.name}
            stars={gameStars[currentLevel] || 0}
            totalStars={Object.values(gameStars).reduce((s, a) => s + a, 0)}
            timer={(!freeDrawMode && config.timeLimit) ? { current: timerSeconds, max: config.timeLimit } : null}
            onPause={() => setBuddyText("Drawing is magic! Take a break. 🧘✨")}
            onQuit={onBack}
          />

          {/* Color Tools & Brush Settings Panel */}
          <div className="flex flex-wrap gap-4 justify-between items-center w-full max-w-5xl mx-auto px-4 select-none">
            {/* Draw Mode selection buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setFreeDrawMode(false)}
                className={`px-4 py-2 rounded-2xl font-black text-xs border-2 shadow-sm transition active:scale-95 flex items-center gap-1 ${
                  !freeDrawMode
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-500 border-teal-600 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                🎯 Target Mode
              </button>
              <button
                onClick={() => setFreeDrawMode(true)}
                className={`px-4 py-2 rounded-2xl font-black text-xs border-2 shadow-sm transition active:scale-95 flex items-center gap-1 ${
                  freeDrawMode
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 border-purple-600 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                🎨 Free Draw
              </button>
            </div>

            {/* Quick Palette selector */}
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-100 shadow-md">
              <Palette className="w-4 h-4 text-slate-400" />
              <div className="flex gap-1">
                {paletteColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setBrushColor(color.value)}
                    className={`w-6 h-6 rounded-full border border-slate-200 shadow-sm cursor-pointer transition transform hover:scale-110 active:scale-90 ${
                      color.style
                    } ${brushColor === color.value ? 'ring-2 ring-indigo-500 scale-110' : ''}`}
                    title={color.name}
                  />
                ))}
              </div>

              {/* Brush size slider */}
              <div className="flex items-center gap-1 border-l border-slate-100 pl-3 ml-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Brush:</span>
                <input
                  type="range"
                  min="5"
                  max="20"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-xs font-bold text-slate-600 w-5 text-center">{brushSize}px</span>
              </div>
            </div>

            {/* Notebook Gallery notebook */}
            <button
              onClick={() => setGalleryOpen(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-600 hover:text-indigo-800 rounded-2xl border border-indigo-100 shadow-sm font-black text-xs flex items-center gap-1 transition active:scale-95 select-none"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Sketches ({galleryDrawings.length})</span>
            </button>
          </div>

          <AIBuddy
            skin={childProfile?.companion || 'sparky'}
            state={buddyState}
            text={buddyText}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto px-4 select-none">
            {/* Draw Canvas panel */}
            <div className="lg:col-span-2 bg-white/70 backdrop-blur-md p-4 rounded-4xl border-3 border-white/60 shadow-lg flex flex-col items-center relative min-h-[350px]">
              
              {!freeDrawMode && (
                <div className="absolute top-4 right-4 bg-slate-100 border border-slate-200 text-slate-500 font-bold px-3 py-1 rounded-full text-[10px] z-50">
                  Shape {activeShapeIndex + 1} of {shapesList.length}
                </div>
              )}

              <div
                className={`relative w-full aspect-video overflow-hidden rounded-3xl border-6 border-curio-slate bg-slate-900 flex items-center justify-center ${
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
                {/* Camera mirror stream */}
                {!sandboxMode && (
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                    muted
                    playsInline
                  />
                )}

                {/* Hand skeleton drawings */}
                {!sandboxMode && (
                  <canvas
                    ref={skeletonCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    width={640}
                    height={480}
                  />
                )}

                {/* Trail Canvas */}
                <canvas
                  ref={drawingCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none z-20"
                  width={640}
                  height={480}
                />

                {/* Particles Sparkles */}
                <canvas
                  ref={particlesCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none z-30"
                  width={640}
                  height={480}
                />

                {/* Hand models loading */}
                {!sandboxMode && isLoadingModels && (
                  <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-6 text-center space-y-3 z-40 text-white">
                    <div className="w-10 h-10 border-4 border-slate-700 border-t-curio-pink rounded-full animate-spin" />
                    <h4 className="font-extrabold text-sm">Loading Hand Detector...</h4>
                    <p className="text-[10px] text-slate-400 font-bold max-w-xs leading-normal">
                      AI classifier models are booting up. Please ensure camera access is granted!
                    </p>
                  </div>
                )}

                {/* Detection banner */}
                {!sandboxMode && isHandDetected && (
                  <div className={`absolute top-4 left-4 px-3 py-1 rounded-full border-2 text-[9px] font-black uppercase tracking-wider z-50 shadow ${
                    isPinching
                      ? 'bg-curio-green text-white border-curio-slate animate-pulse'
                      : 'bg-curio-yellow text-curio-slate border-curio-slate'
                  }`}>
                    {isPinching ? "✍️ DRAWING ACTIVE" : "✋ CAMERA SCANNING"}
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="w-full flex flex-wrap gap-3 justify-between items-center mt-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const nextMode = !sandboxMode;
                      setSandboxMode(nextMode);
                      handleClear();
                      if (nextMode) {
                        stopTracking();
                      }
                    }}
                    className="text-xs font-black text-curio-purple bg-slate-100/60 hover:bg-slate-200 border-2 border-curio-slate px-3 py-2 rounded-xl flex items-center gap-1 shadow cursor-pointer transition active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{sandboxMode ? "Use Active Hand Camera" : "Switch to Button Sandbox"}</span>
                  </button>

                  {!sandboxMode && isHandDetected && (
                    <button
                      onClick={handleCalibrate}
                      className="text-xs font-black text-amber-600 bg-amber-50 hover:bg-amber-100 border-2 border-amber-500 px-3 py-2 rounded-xl flex items-center gap-1 shadow cursor-pointer transition active:scale-95 animate-pulse"
                    >
                      <span>🎯 Calibrate Hand</span>
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={strokes.length === 0}
                    className="bg-slate-100 border-2 border-curio-slate font-black px-3 py-2 rounded-xl text-xs uppercase cursor-pointer flex items-center gap-1 shadow hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none transition"
                  >
                    Undo ↩
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={strokes.length === 0}
                    className="bg-rose-50 text-rose-600 border-2 border-curio-slate font-black px-3 py-2 rounded-xl text-xs uppercase cursor-pointer flex items-center gap-1 shadow hover:bg-rose-100 disabled:opacity-40 disabled:pointer-events-none transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear 🧹</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Pane controls */}
            <div className="space-y-6 select-none">
              
              {/* Challenge Target Card */}
              <div className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg text-center space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  {freeDrawMode ? 'Creative Painting' : 'Draw Target'}
                </h4>
                
                <div className="w-20 h-20 rounded-full border-3 border-curio-slate bg-slate-50 mx-auto flex items-center justify-center text-4xl shadow relative">
                  {freeDrawMode ? '🎨' :
                   targetShape === 'circle' ? '🔴' :
                   targetShape === 'square' ? '🟦' :
                   targetShape === 'triangle' ? '🔺' :
                   targetShape === 'star' ? '⭐️' :
                   targetShape === 'heart' ? '💖' : '✍️'}
                </div>

                <div className="space-y-1">
                  <h5 className="text-lg font-black uppercase text-curio-slate tracking-wider font-kids">
                    {freeDrawMode ? 'Free Canvas' : targetShape}
                  </h5>
                  {!freeDrawMode && (
                    <p className="text-[10px] font-bold text-curio-purple uppercase tracking-wider">
                      Attempt {attempts}/3 • Minimum Accuracy: {100 - (config.tolerance || 35)}%
                    </p>
                  )}
                </div>

                {freeDrawMode ? (
                  /* Save button in Free Draw Mode */
                  <button
                    onClick={handleSaveDrawing}
                    disabled={strokes.length === 0}
                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-black py-4 px-6 rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none text-xs uppercase flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save to Notebook!</span>
                  </button>
                ) : (
                  /* Submit Shape check in Target Mode */
                  <div className="space-y-2">
                    <button
                      onClick={handleSubmitDrawing}
                      disabled={strokes.length === 0 || !matchingActive}
                      className="w-full bg-curio-green hover:bg-curio-green-dark text-white font-black py-4 px-6 rounded-2xl border-4 border-curio-slate shadow-playful-green hover:shadow-none hover:translate-y-0.5 active:scale-95 transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none text-xs uppercase tracking-wide"
                    >
                      Submit My Shape! ✅
                    </button>
                    {strokes.length > 0 && matchingActive && (
                      <button
                        onClick={handleSaveDrawing}
                        className="w-full text-indigo-600 hover:underline font-black text-[11px] flex items-center justify-center gap-1 mx-auto cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save current trail to Notebook</span>
                      </button>
                    )}
                  </div>
                )}
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
                  <li>Dotted pink outline shows the target shape!</li>
                  <li>Adjust colors, brush sizes, or switch to **Free Draw** anytime.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Persistent Gallery Overlay */}
      {galleryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 flex flex-col max-h-[85vh]"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📔</span>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg leading-none">Sketches Notebook</h3>
                  <span className="text-slate-400 text-xs font-medium">Your private gallery of drawings</span>
                </div>
              </div>
              <button
                onClick={() => setGalleryOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2.5 rounded-full text-xs font-bold leading-none cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-grow pr-1 mb-2">
              {galleryDrawings.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {galleryDrawings.map((draw, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 border-2 border-slate-100 rounded-2xl overflow-hidden shadow-sm relative group"
                    >
                      <img
                        src={draw.image}
                        alt={`Sketch ${idx + 1}`}
                        className="w-full aspect-video object-cover"
                      />
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-[10px] text-white font-bold bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                          {new Date(draw.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <span className="text-5xl block animate-bounce">🎨</span>
                  <p className="text-sm font-bold mt-2">Notebook is empty...</p>
                  <p className="text-[10px] font-semibold mt-1">Start sketching and click Save to fill your notebook gallery!</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {gamePhase === 'complete' && (
        <GameComplete
          gameName="airDraw"
          level={currentLevel}
          starsEarned={earnedStars}
          points={calculatedPoints}
          stats={{
            timeTaken,
            accuracy: attempts > 0 ? Math.round(Math.max(50, 100 - (attempts - 1) * 20)) : 95
          }}
          onReplay={() => startNewGame(currentLevel)}
          onNextLevel={handleNextLevel}
          onHome={() => setGamePhase('menu')}
        />
      )}
    </div>
  );
}
