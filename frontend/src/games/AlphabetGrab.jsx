import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, RefreshCw, Flame, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useHandTracking } from '../hooks/useHandTracking';
import AIBuddy from '../components/AIBuddy';
import { collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';
import { alphabetQuestions } from '../utils/alphabetQuestions';

export default function AlphabetGrab({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission, incrementStat, earnBadge } = useAuth();

  const [questionIndex, setQuestionIndex] = useState(0);
  const currentQuestion = alphabetQuestions[questionIndex % alphabetQuestions.length];

  // Mode settings
  const [sandboxMode, setSandboxMode] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [matchingActive, setMatchingActive] = useState(true);
  
  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [loadingLetters, setLoadingLetters] = useState(true);

  // Floating balloons state
  const [balloons, setBalloons] = useState([]);
  const [grabbedId, setGrabbedId] = useState(null);
  
  // Custom interactive animations
  const [particles, setParticles] = useState([]);
  const [wrongShakeId, setWrongShakeId] = useState(null);

  // HTML5 Canvases & loop refs
  const gameCanvasRef = useRef(null);
  const sparklesCanvasRef = useRef(null);
  const isGrabbingPrevRef = useRef(false);
  
  const balloonsRef = useRef([]);
  const grabbedIdRef = useRef(null);
  const sandboxModeRef = useRef(sandboxMode);
  const grabPositionRef = useRef({ x: 0, y: 0 });
  const frameCounterRef = useRef(0);

  // Keep refs synchronized to bypass closure locks in requestAnimationFrame
  useEffect(() => {
    sandboxModeRef.current = sandboxMode;
  }, [sandboxMode]);

  useEffect(() => {
    grabbedIdRef.current = grabbedId;
  }, [grabbedId]);

  // Initialize hand tracking hook
  const {
    indexFingerTip,
    isGrabbing,
    grabPosition,
    isHandDetected,
    isLoadingModels,
    videoRef,
    canvasRef: skeletonCanvasRef,
    stopTracking
  } = useHandTracking({ active: !sandboxMode });

  // Update cursor position ref
  useEffect(() => {
    if (grabPosition) {
      grabPositionRef.current = grabPosition;
    }
  }, [grabPosition]);

  // Sparkle generator triggers
  const spawnSparkles = (cx, cy) => {
    const freshParticles = [];
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const speed = 2 + Math.random() * 4.5;
      freshParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 5.5,
        alpha: 1.0,
        color: `hsl(${Math.random() * 360}, 95%, 70%)`
      });
    }
    setParticles(prev => [...prev, ...freshParticles]);
  };

  // Particle updates loop
  useEffect(() => {
    let animId;
    const canvas = sparklesCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const updateSparkles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      setParticles(prev => {
        const remaining = [];
        prev.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.035;

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

      animId = requestAnimationFrame(updateSparkles);
    };

    animId = requestAnimationFrame(updateSparkles);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 1. Initialize Question state & read question aloud via speech synthesis
  useEffect(() => {
    if (!currentQuestion) return;

    setLoadingLetters(true);
    setAttempts(0);
    setMatchingActive(true);
    setGrabbedId(null);
    grabbedIdRef.current = null;
    
    const introPrompt = `${currentQuestion.prompt} Pinch the balloon to grab it, then drop it in the mouth!`;
    setBuddyText(introPrompt);
    setBuddyState('idle');

    // Speech prompt synthesis
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel(); // clear queue
        const utterance = new SpeechSynthesisUtterance(currentQuestion.prompt);
        utterance.pitch = 1.3;
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn("Speech synthesis failed to execute:", e);
    }

    // Initialize letters focused towards screen center initially (640x480 bounds)
    const options = currentQuestion.options;
    
    console.log(`Rendering ${options.length} letters on canvas`);

    const initialBalloons = options.map((label, idx) => {
      const totalWidth = (options.length - 1) * 90;
      const startX = 320 - (totalWidth / 2) + idx * 90;
      const startY = 200 + (idx % 2 === 0 ? -20 : 20); // staggered vertical spacing
      
      const speedScale = currentQuestion.difficulty === 1 ? 0.7 : (currentQuestion.difficulty === 2 ? 1.3 : 1.9);

      return {
        id: idx,
        label,
        x: startX,
        y: startY,
        startX,
        startY,
        vx: (Math.random() - 0.5) * speedScale,
        vy: (Math.random() - 0.5) * speedScale - 0.4, // float upward slightly
        color: [
          '#FF4FA3', // Playful Pink
          '#7B61FF', // Modern Purple
          '#FF9F1C', // Playful Orange
          '#37D67A', // Vibrant Green
          '#38B6FF', // Vibrant Sky Blue
          '#EC4899'  // Rose Pink
        ][idx % 6],
        radius: 38,
        shaking: false,
        shakeOffset: 0
      };
    });

    balloonsRef.current = initialBalloons;
    setBalloons(initialBalloons);
    setLoadingLetters(false);
  }, [questionIndex, currentQuestion]);

  // 2. Continuous physics simulation update loop (60fps)
  useEffect(() => {
    let animId;
    
    const updatePhysics = () => {
      const grabbedCurId = grabbedIdRef.current;
      const cursor = sandboxModeRef.current ? { x: 0, y: 0 } : grabPositionRef.current;

      balloonsRef.current.forEach(b => {
        if (b.id === grabbedCurId) {
          // Locked to cursor
          if (!sandboxModeRef.current) {
            b.x = cursor.x;
            b.y = cursor.y;
          }
          b.radius = 46;
        } else {
          // Standard bobbing drift
          b.x += b.vx;
          b.y += b.vy;
          b.radius = 38;

          const bob = Math.sin(Date.now() / 240 + b.id) * 0.32;
          b.y += bob;

          // Bouncing off borders (640x480 coordinates)
          const margin = b.radius + 10;
          if (b.x - margin < 0 || b.x + margin > 640) {
            b.vx *= -1;
            b.x = Math.max(margin, Math.min(640 - margin, b.x));
          }
          if (b.y - margin < 20 || b.y + margin > 340) {
            b.vy *= -1;
            b.y = Math.max(margin + 20, Math.min(340, b.y));
          }
        }
      });

      setBalloons([...balloonsRef.current]);
      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 3. SECURE CANVAS DRAWING EFFECT (Triggered after React DOM commit)
  useEffect(() => {
    const canvas = gameCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    frameCounterRef.current++;
    if (frameCounterRef.current % 120 === 0) {
      console.log(`⏱️ Drawing loop running: frame #${frameCounterRef.current}`);
    }

    if (balloons.length === 0) return;

    balloons.forEach(b => {
      if (typeof b.x !== 'number' || typeof b.y !== 'number') return;

      ctx.save();

      // Outer contrasting glow circle
      ctx.shadowBlur = b.id === grabbedId ? 22 : 10;
      ctx.shadowColor = b.id === grabbedId ? '#FF9F1C' : 'rgba(0, 0, 0, 0.25)';

      if (b.label === currentQuestion.answer) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#FF4FA3';
      }

      // Draw custom balloon body
      const grad = ctx.createRadialGradient(b.x - 10, b.y - 10, 5, b.x, b.y, b.radius);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.3, b.color);
      grad.addColorStop(1, b.color);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, 2 * Math.PI);
      ctx.fill();

      // Knot at bottom
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.radius - 2);
      ctx.lineTo(b.x - 6, b.y + b.radius + 6);
      ctx.lineTo(b.x + 6, b.y + b.radius + 6);
      ctx.closePath();
      ctx.fill();

      // Wobbly string
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.25)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.radius + 6);
      ctx.bezierCurveTo(
        b.x - 5, b.y + b.radius + 16,
        b.x + 5, b.y + b.radius + 26,
        b.x, b.y + b.radius + 36
      );
      ctx.stroke();

      // Render bold typography (MINIMUM 48PX outline for legibility)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'black 48px "Fredoka", "Lexend", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0; 

      ctx.strokeStyle = '#1E293B'; 
      ctx.lineWidth = 6;
      ctx.strokeText(b.label, b.x, b.y);
      ctx.fillText(b.label, b.x, b.y);

      ctx.restore();
    });
  }, [balloons, grabbedId, currentQuestion]);

  // Grabbing Pinch Event listeners from camera hook
  useEffect(() => {
    if (sandboxMode || !isHandDetected || isLoadingModels || !matchingActive) return;

    if (isGrabbing) {
      if (!isGrabbingPrevRef.current && grabbedId === null) {
        balloonsRef.current.forEach(b => {
          const d = Math.sqrt(Math.pow(grabPosition.x - b.x, 2) + Math.pow(grabPosition.y - b.y, 2));
          if (d < 58) {
            setGrabbedId(b.id);
            spawnSparkles(b.x, b.y);
          }
        });
      }
    } else {
      if (isGrabbingPrevRef.current && grabbedId !== null) {
        handleLetterRelease(grabbedId);
      }
    }

    isGrabbingPrevRef.current = isGrabbing;
  }, [isGrabbing, grabPosition, isHandDetected, isLoadingModels, grabbedId, sandboxMode, matchingActive]);

  const handleLetterRelease = (balloonId) => {
    const droppedBalloon = balloonsRef.current.find(b => b.id === balloonId);
    if (!droppedBalloon) return;

    const isOverDropZone = droppedBalloon.y > 330 && droppedBalloon.x > 200 && droppedBalloon.x < 440;

    if (isOverDropZone) {
      setGrabbedId(null);
      grabbedIdRef.current = null;
      verifyAnswer(droppedBalloon);
    } else {
      setGrabbedId(null);
      grabbedIdRef.current = null;
      setBuddyState('idle');
    }
  };

  const verifyAnswer = async (balloon) => {
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    const isCorrect = balloon.label === currentQuestion.answer;

    if (isCorrect) {
      setMatchingActive(false);
      setBuddyState('happy');
      setBuddyText(`Perfect! That is the letter ${balloon.label}! Splendid job! ⭐️`);

      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 }
      });

      // Stars Award logic: 3 for 1st try, 1 for 2nd try, 0 for 3rd
      let starsReward = 0;
      if (nextAttempts === 1) starsReward = 3;
      else if (nextAttempts === 2) starsReward = 1;

      setScore(prev => prev + starsReward);
      if (starsReward > 0) {
        await awardStars(starsReward, 'alphabet-grab');
      }

      // Streaks
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      if (nextStreak > bestStreak) setBestStreak(nextStreak);

      await incrementStat('alphabetGrabLetters', 1);
      await incrementMission(1); // complete daily mission

      // Milestones check
      const nextQIndex = questionIndex + 1;
      if (nextQIndex === 5) {
        setBuddyText("🎉 Woohoo! 5 questions completed! Let's do a mini victory dance!");
      }
      if (nextQIndex === 10) {
        await earnBadge('letter-champion');
        setBuddyText("🎖️ Letter Champion unlocked! You earned the Letter Champion Badge!");
      }

      await logTelemetry(true, balloon.label);

      setTimeout(() => {
        advanceQuestion();
      }, 4000);

    } else {
      setBuddyState('sad');
      
      if (nextAttempts >= 3) {
        setMatchingActive(false);
        setBuddyText(`Good effort! The correct answer is indeed ${currentQuestion.answer}. Let's try the next one! 🎈`);
        await logTelemetry(false, balloon.label);
        setStreak(0);
        
        setTimeout(() => {
          advanceQuestion();
        }, 4000);
      } else {
        setBuddyText(`Oops! That's not correct. Attempt ${nextAttempts}/3. Try grabbing another balloon! 💪`);
        setStreak(0);
        await logTelemetry(false, balloon.label);

        setWrongShakeId(balloon.id);
        setTimeout(() => {
          setWrongShakeId(null);
          balloonsRef.current = balloonsRef.current.map(b => {
            if (b.id === balloon.id) {
              return {
                ...b,
                x: 200 + Math.random() * 240,
                y: 160 + Math.random() * 100
              };
            }
            return b;
          });
          setBalloons([...balloonsRef.current]);
        }, 1200);
      }
    }
  };

  const advanceQuestion = () => {
    if (questionIndex < 9) {
      setQuestionIndex(prev => prev + 1);
    } else {
      setSessionCompleted(true);
      setBuddyState('happy');
      setBuddyText("Hooray! You completed all 10 alphabet sequence cards! What a spelling hero! 👑");
    }
  };

  const logTelemetry = async (success, labelSeen) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'alphabet-grab',
      success,
      target: currentQuestion.answer,
      detected: labelSeen,
      emotion: success ? 'happy' : 'sad',
      difficulty: currentQuestion.difficulty === 1 ? 'EASY' : (currentQuestion.difficulty === 2 ? 'MEDIUM' : 'HARD')
    };

    if (isValidConfig && db && currentUser) {
      try {
        await addDoc(collection(db, 'interactions', currentUser.uid, 'logs'), logData);
      } catch (err) {
        console.error("Firestore logging failed:", err);
      }
    } else {
      console.log("📝 Offline Alphabet Telemetry Logged:", logData);
    }
  };

  // Sandbox Click & Drag controllers
  const getCanvasOffsetCoords = (e) => {
    const canvas = gameCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const handleSandboxStart = (e) => {
    if (!sandboxMode || !matchingActive) return;
    const coords = getCanvasOffsetCoords(e);
    
    balloonsRef.current.forEach(b => {
      const d = Math.sqrt(Math.pow(coords.x - b.x, 2) + Math.pow(coords.y - b.y, 2));
      if (d < b.radius + 10) {
        setGrabbedId(b.id);
        grabbedIdRef.current = b.id;
        spawnSparkles(b.x, b.y);
      }
    });
  };

  const handleSandboxMove = (e) => {
    if (!sandboxMode || grabbedId === null || !matchingActive) return;
    const coords = getCanvasOffsetCoords(e);
    
    balloonsRef.current = balloonsRef.current.map(b => {
      if (b.id === grabbedId) {
        return { ...b, x: coords.x, y: coords.y, radius: 46 };
      }
      return b;
    });
    setBalloons([...balloonsRef.current]);
  };

  const handleSandboxEnd = () => {
    if (!sandboxMode || grabbedId === null || !matchingActive) return;
    handleLetterRelease(grabbedId);
  };

  const resetSession = () => {
    setQuestionIndex(0);
    setScore(0);
    setStreak(0);
    setSessionCompleted(false);
    setMatchingActive(true);
    setGrabbedId(null);
    grabbedIdRef.current = null;
  };

  return (
    <div className="space-y-6">
      
      {/* Game Header */}
      <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-4 rounded-3xl border-3 border-white/60 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🎈🗣️</span>
          <div>
            <h3 className="text-base font-black text-curio-slate">Alphabet Grab Room</h3>
            <p className="text-[10px] font-bold text-slate-400">Grab floating balloons and drop them to answer!</p>
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
        
        {/* Left Screen: Floating Canvas */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md p-4 rounded-4xl border-3 border-white/60 shadow-lg flex flex-col items-center relative min-h-[350px]">
          
          {sessionCompleted ? (
            /* Complete victory panel */
            <motion.div
              key="victory-screen"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center space-y-6 w-full select-none"
            >
              <div className="text-7xl block animate-bounce-slow">👑🎈🎉</div>
              <h4 className="font-black text-2xl text-curio-slate uppercase tracking-wider">Spelling Champion!</h4>
              <p className="text-slate-500 font-bold max-w-xs mx-auto text-sm">
                Outstanding! You answered all 10 alphabet sequence cards correctly! Your best streak was **{bestStreak}**!
              </p>

              <div className="flex gap-4">
                <button
                  onClick={resetSession}
                  className="bg-curio-green hover:bg-curio-green-dark text-white font-black py-3 px-6 rounded-2xl border-3 border-curio-green-dark shadow-playful-green transition active:scale-95 cursor-pointer flex items-center gap-1.5 uppercase text-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Practice Again</span>
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
            /* Canvas drawing board viewport */
            <div 
              className={`relative w-full aspect-video overflow-hidden rounded-3xl border-6 border-curio-slate bg-black flex items-center justify-center ${
                sandboxMode ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
              onMouseDown={handleSandboxStart}
              onMouseMove={handleSandboxMove}
              onMouseUp={handleSandboxEnd}
              onTouchStart={handleSandboxStart}
              onTouchMove={handleSandboxMove}
              onTouchEnd={handleSandboxEnd}
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
                <div className="absolute inset-0 bg-gradient-to-b from-curio-orange-light to-curio-cream select-none pointer-events-none opacity-45" />
              )}

              {/* 2. Skeleton Gesture overlay */}
              {!sandboxMode && (
                <canvas 
                  ref={skeletonCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none z-10"
                  width={640}
                  height={480}
                />
              )}

              {/* 3. Letters/Balloons Canvas */}
              <canvas 
                ref={gameCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-20"
                width={640}
                height={480}
              />

              {/* 4. Sparkles particles overlay */}
              <canvas 
                ref={sparklesCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-30"
                width={640}
                height={480}
              />

              {/* 5. SECURE FALLBACK HTML RENDERING OVERLAY */}
              <div className="absolute inset-0 z-25 pointer-events-none">
                <AnimatePresence>
                  {balloons.map((b) => (
                    <motion.div
                      key={b.id}
                      className={`absolute rounded-full border-4 border-curio-slate flex items-center justify-center font-black select-none pointer-events-auto cursor-grab active:cursor-grabbing shadow-playful ${
                        wrongShakeId === b.id ? 'animate-wiggle' : ''
                      }`}
                      style={{
                        left: `${(b.x / 640) * 100}%`,
                        top: `${(b.y / 480) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        width: `${b.radius * 2}px`,
                        height: `${b.radius * 2}px`,
                        backgroundColor: b.color,
                        boxShadow: b.id === grabbedId ? '0 0 20px 8px #FF9F1C' : '0 8px 0px 0px rgba(0,0,0,0.15)',
                        borderColor: b.id === grabbedId ? '#FFFFFF' : '#1E293B',
                      }}
                      animate={{ scale: b.id === grabbedId ? 1.2 : 1.0 }}
                      onMouseDown={(e) => handleSandboxStart(e)}
                      onTouchStart={(e) => handleSandboxStart(e)}
                    >
                      <span 
                        className="text-white text-stroke-kids select-none pointer-events-none font-kids"
                        style={{
                          fontSize: '48px',
                          textShadow: '3px 3px 0px #1E293B, -2px -2px 0px #1E293B, 2px -2px 0px #1E293B, -2px 2px 0px #1E293B'
                        }}
                      >
                        {b.label}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Overlaid Drop Zone: styled like a cute mouth monster */}
              <div 
                className={`absolute bottom-2 left-1/2 transform -translate-x-1/2 w-48 h-24 rounded-t-5xl border-4 border-b-0 border-curio-slate bg-curio-purple flex flex-col items-center justify-center text-white z-40 transition-all shadow-[0_-8px_0_0_rgba(0,0,0,0.08)] ${
                  grabbedId !== null ? 'animate-pulse scale-105 border-curio-yellow bg-curio-purple-dark' : ''
                }`}
              >
                <div className="w-16 h-2 bg-pink-300 rounded-full mb-1"></div>
                <span className="text-[10px] font-black uppercase tracking-wider text-pink-100 select-none pointer-events-none font-kids">Drop here! 😋</span>
                <span className="text-3xl mt-0.5 select-none pointer-events-none">👾</span>
              </div>

              {/* Hand Wave guide banner */}
              {!sandboxMode && !isHandDetected && !isLoadingModels && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/95 px-4 py-2 rounded-2xl border-2 border-curio-slate text-[10px] font-black text-curio-slate uppercase flex items-center gap-1.5 z-50 animate-bounce shadow select-none pointer-events-none">
                  <span>Wave your hand at the camera! 👋</span>
                </div>
              )}

              {/* Loading Letters / Hand Models Spinner */}
              {(isLoadingModels || loadingLetters) && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center space-y-3 z-50 text-white select-none">
                  <div className="w-10 h-10 border-4 border-slate-700 border-t-curio-orange rounded-full animate-spin" />
                  <h4 className="font-extrabold text-sm">{loadingLetters ? "Loading letters..." : "Preparing Hand Grabber..."}</h4>
                  <p className="text-[10px] text-slate-400 font-bold max-w-xs leading-normal">
                    {loadingLetters ? "Distributing balloons on canvas..." : "MediaPipe Hand tracking weights are loading on-device..."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sandbox Toggle */}
          {!sessionCompleted && (
            <div className="w-full flex justify-between items-center mt-4 select-none">
              <button
                onClick={() => {
                  const nextMode = !sandboxMode;
                  setSandboxMode(nextMode);
                  setGrabbedId(null);
                  if (nextMode) {
                    stopTracking();
                  }
                }}
                className="text-xs font-black text-curio-purple hover:underline bg-slate-100/60 hover:bg-slate-200 border-2 border-curio-slate px-3 py-2 rounded-xl flex items-center gap-1 shadow cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{sandboxMode ? "Use Active Hand Camera" : "Switch to Button Sandbox"}</span>
              </button>

              <div className="flex gap-2 items-center text-xs font-black text-slate-400 uppercase">
                <Flame className="w-4 h-4 text-curio-pink fill-curio-pink" />
                <span>Streak: {streak}</span>
              </div>
            </div>
          )}

        </div>

        {/* Right Stats Sidebar */}
        <div className="space-y-6 select-none">
          
          {/* Question Prompt Card */}
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg text-center space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Question {questionIndex + 1} / 10</h4>
            
            <div className="bg-slate-50 py-4 px-6 rounded-3xl border-2 border-slate-100 min-h-[100px] flex flex-col justify-center shadow-inner">
              <h5 className="text-lg font-black text-curio-slate leading-snug">
                {currentQuestion.prompt}
              </h5>
              <span className="text-[10px] font-black text-curio-purple uppercase tracking-wider mt-2 block">
                Difficulty: {currentQuestion.difficulty === 1 ? '🟢 Easy' : (currentQuestion.difficulty === 2 ? '🟡 Medium' : '🔴 Hard')}
              </span>
            </div>

            <div className="p-3 bg-curio-orange-light/50 border-2 border-slate-100 rounded-2xl">
              <span className="text-[9px] font-black text-slate-400 uppercase block">Attempt Record</span>
              <span className="text-2xl font-black text-curio-orange mt-1 block">{attempts} / 3</span>
            </div>
          </div>

          {/* Guide notes */}
          <div className="bg-white/70 backdrop-blur-md p-5 rounded-4xl border-3 border-white/60 shadow-lg space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              🎮 Balloon Room Rules
            </h4>
            <ul className="text-[10px] text-slate-500 font-bold space-y-2 leading-relaxed list-disc list-inside">
              <li>Pinch thumb and index finger to grab a floating balloon letter!</li>
              <li>Drift it over the bottom Monster Mouth and release to drop!</li>
              <li>Bouncy physics bounce balloons off edge walls.</li>
            </ul>
          </div>
        </div>

      </div>

    </div>
  );
}
