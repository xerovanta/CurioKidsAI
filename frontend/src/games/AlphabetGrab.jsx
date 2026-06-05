import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, RefreshCw, Flame, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useHandTracking } from '../hooks/useHandTracking';
import AIBuddy from '../components/AIBuddy';
import { collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';
import { getLevelConfig, getNextLevelStars } from '../utils/levelSystem.js';
import { calculateStars } from '../utils/scoringEngine.js';
import GameHeader from '../components/game/GameHeader.jsx';
import GameComplete from '../components/game/GameComplete.jsx';
import LevelSelect from '../components/game/LevelSelect.jsx';

import { useSound } from '../hooks/useSound.js';

export default function AlphabetGrab({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission, incrementStat, earnBadge } = useAuth();
  const { playClick, playCorrect, playWrong, playWin } = useSound();

  // Level & Phase states
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gamePhase, setGamePhase] = useState('menu'); // 'menu' | 'playing' | 'complete'
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);

  const currentQuestion = sessionQuestions[questionIndex] || {
    prompt: 'What comes after A?',
    answer: 'B',
    options: ['B', 'C', 'D'],
    type: 'after'
  };

  // Mode settings
  const [sandboxMode, setSandboxMode] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [matchingActive, setMatchingActive] = useState(true);
  
  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [loadingLetters, setLoadingLetters] = useState(true);

  // Floating balloons state
  const [balloons, setBalloons] = useState([]);
  const [grabbedId, setGrabbedId] = useState(null);
  
  // Custom interactive animations & feedback
  const [particles, setParticles] = useState([]);
  const [wrongShakeId, setWrongShakeId] = useState(null);
  const [flashRed, setFlashRed] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);

  // Timing
  const [timeTaken, setTimeTaken] = useState(0);

  // Stats states
  const [stats, setStats] = useState({
    questionsAttempted: 0,
    questionsCorrect: 0
  });

  // Stars tracking
  const [earnedStars, setEarnedStars] = useState(0);
  const [calculatedPoints, setCalculatedPoints] = useState(0);
  const [gameStars, setGameStars] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  // HTML5 Canvases & loop refs
  const gameCanvasRef = useRef(null);
  const sparklesCanvasRef = useRef(null);
  const isPinchingPrevRef = useRef(false);
  
  const balloonsRef = useRef([]);
  const grabbedIdRef = useRef(null);
  const sandboxModeRef = useRef(sandboxMode);
  const grabPositionRef = useRef({ x: 0, y: 0 });
  const frameCounterRef = useRef(0);

  const config = getLevelConfig('alphabetGrab', currentLevel) || {};

  // World Themes list mapping to levels
  const themes = {
    1: { name: 'Jungle Green', style: 'from-emerald-950 via-teal-950 to-emerald-900', border: 'border-emerald-500' },
    2: { name: 'Ocean Blue', style: 'from-sky-950 via-blue-950 to-sky-900', border: 'border-sky-500' },
    3: { name: 'Space Dark', style: 'from-indigo-950 via-slate-950 to-black', border: 'border-indigo-500' },
    4: { name: 'Sunset Red', style: 'from-rose-950 via-orange-950 to-stone-950', border: 'border-rose-500' },
    5: { name: 'Cosmic Candy', style: 'from-purple-950 via-fuchsia-950 to-slate-950', border: 'border-fuchsia-500' }
  };
  const activeTheme = themes[currentLevel] || themes[1];

  // Load level stars from localStorage on child profile load
  useEffect(() => {
    if (childProfile) {
      const storageKey = `curiokids_stars_alphabetGrab_${childProfile.uid || 'guest'}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setGameStars(JSON.parse(saved));
      }
    }
  }, [childProfile]);

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
    isPinching, // Using high-accuracy, debounced, stable pinching filter
    isGrabbing,
    grabPosition,
    isHandDetected,
    isLoadingModels,
    videoRef,
    canvasRef: skeletonCanvasRef,
    stopTracking,
    handScale,
    isHandConfident
  } = useHandTracking({ active: !sandboxMode && gamePhase === 'playing' });

  // Update cursor position ref
  useEffect(() => {
    if (indexFingerTip) {
      grabPositionRef.current = indexFingerTip;
    }
  }, [indexFingerTip]);

  // Live Timer Effect for Target Mode
  useEffect(() => {
    if (gamePhase !== 'playing') return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      setTimeTaken(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase]);

  // Sparkle generator triggers
  const spawnSparkles = (cx, cy) => {
    playClick(); // Play grab/click sound effect
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

  // Initialize Question state
  useEffect(() => {
    if (sessionQuestions.length === 0 || gamePhase !== 'playing') return;

    setLoadingLetters(true);
    setAttempts(0);
    setMatchingActive(true);
    setGrabbedId(null);
    grabbedIdRef.current = null;
    
    const introPrompt = `${currentQuestion.prompt} Pinch the balloon to grab, and drop it in the monster mouth!`;
    setBuddyText(introPrompt);
    setBuddyState('idle');

    // Speech prompt synthesis
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel(); // clear queue
        const utterance = new SpeechSynthesisUtterance(currentQuestion.prompt);
        utterance.pitch = 1.35;
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn("Speech synthesis failed to execute:", e);
    }

    // Distribute balloons based on options
    const options = currentQuestion.options || [];
    
    const initialBalloons = options.map((label, idx) => {
      const totalWidth = (options.length - 1) * 90;
      const startX = 320 - (totalWidth / 2) + idx * 90;
      const startY = 180 + (idx % 2 === 0 ? -20 : 20); // staggered vertical spacing
      
      const speed = config.speed || 'slow';
      const speedScale = speed === 'slow' ? 0.6 : (speed === 'medium' ? 1.2 : (speed === 'fast' ? 1.8 : 2.4));

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
        shakeOffset: 0,
        returning: false
      };
    });

    balloonsRef.current = initialBalloons;
    setBalloons(initialBalloons);
    setLoadingLetters(false);
  }, [questionIndex, sessionQuestions, gamePhase]);

  // Continuous physics simulation update loop (60fps)
  useEffect(() => {
    let animId;
    
    const updatePhysics = () => {
      const grabbedCurId = grabbedIdRef.current;
      const cursor = sandboxModeRef.current ? { x: 0, y: 0 } : grabPositionRef.current;

      balloonsRef.current.forEach(b => {
        if (b.swallowed) {
          // Smoothly animate towards monster mouth center (x: 320, y: 400) and shrink to 0
          b.x += (320 - b.x) * 0.15;
          b.y += (400 - b.y) * 0.15;
          b.radius = Math.max(0, b.radius - 2.5);
        } else if (b.id === grabbedCurId) {
          // Locked to cursor with silky-smooth spring damping physics + vertical offset so hand doesn't block letter
          if (!sandboxModeRef.current) {
            const targetX = cursor.x;
            const targetY = cursor.y - 20; // 20px offset
            const ax = (targetX - b.x) * 0.09; // spring stiffness
            const ay = (targetY - b.y) * 0.09;
            
            b.vx = (b.vx + ax) * 0.70; // spring friction
            b.vy = (b.vy + ay) * 0.70;
            
            b.x += b.vx;
            b.y += b.vy;
          } else {
            b.x = cursor.x;
            b.y = cursor.y;
          }
          b.radius = 46;
        } else if (b.returning) {
          // Smooth spring back return to spawn coordinates
          b.x += (b.startX - b.x) * 0.12;
          b.y += (b.startY - b.y) * 0.12;
          b.radius = 38;

          const dx = b.x - b.startX;
          const dy = b.y - b.startY;
          if (Math.sqrt(dx * dx + dy * dy) < 4) {
            b.returning = false;
            b.vx = (Math.random() - 0.5) * 1.2;
            b.vy = (Math.random() - 0.5) * 1.2 - 0.2;
          }
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

  // SECURE CANVAS DRAWING EFFECT (Triggered after React DOM commit)
  useEffect(() => {
    const canvas = gameCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Completely clear canvas balloons duplicate drawings!
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [balloons, grabbedId, currentQuestion]);

  // Grabbing Pinch Event listeners from camera hook
  useEffect(() => {
    if (sandboxMode || !isHandDetected || isLoadingModels || !matchingActive || gamePhase !== 'playing') return;

    if (isPinching) {
      if (!isPinchingPrevRef.current && grabbedId === null) {
        balloonsRef.current.forEach(b => {
          // Increased child-friendly hit hitbox to 65px
          const d = Math.sqrt(Math.pow(indexFingerTip.x - b.x, 2) + Math.pow(indexFingerTip.y - b.y, 2));
          if (d < 65 && !b.swallowed && !b.returning) {
            setGrabbedId(b.id);
            grabbedIdRef.current = b.id;
            spawnSparkles(b.x, b.y);
          }
        });
      }
    } else {
      if (isPinchingPrevRef.current && grabbedId !== null) {
        handleLetterRelease(grabbedId);
      }
    }

    isPinchingPrevRef.current = isPinching;
  }, [isPinching, indexFingerTip, isHandDetected, isLoadingModels, grabbedId, sandboxMode, matchingActive, gamePhase]);

  const handleLetterRelease = (balloonId) => {
    const droppedBalloon = balloonsRef.current.find(b => b.id === balloonId);
    if (!droppedBalloon) return;

    // Generous drop zone over monster mouth
    const isOverDropZone = droppedBalloon.y > 300 && droppedBalloon.x > 180 && droppedBalloon.x < 460;

    if (isOverDropZone) {
      setGrabbedId(null);
      grabbedIdRef.current = null;
      verifyAnswer(droppedBalloon);
    } else {
      // Released outside: Trigger spring-back return animation
      balloonsRef.current = balloonsRef.current.map(b => {
        if (b.id === balloonId) {
          return { ...b, returning: true };
        }
        return b;
      });
      setBalloons([...balloonsRef.current]);
      setGrabbedId(null);
      grabbedIdRef.current = null;
      setBuddyState('idle');
    }
  };

  const verifyAnswer = async (balloon) => {
    // Set swallowed to true immediately!
    balloonsRef.current = balloonsRef.current.map(b => {
      if (b.id === balloon.id) {
        return { ...b, swallowed: true };
      }
      return b;
    });
    setBalloons([...balloonsRef.current]);

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    const isCorrect = balloon.label === currentQuestion.answer;

    if (isCorrect) {
      setMatchingActive(false);
      setBuddyState('happy');
      setBuddyText(`Perfect! You grabbed the letter ${balloon.label}! ⭐️`);

      // Spawn extra pop sparkles at monster mouth
      spawnSparkles(320, 400);
      playCorrect(); // play correct chime sound

      // Trigger Confetti Drop
      confetti({
        particleCount: 80,
        spread: 50,
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

      setStats(prev => ({
        questionsAttempted: prev.questionsAttempted + 1,
        questionsCorrect: prev.questionsCorrect + 1
      }));

      await incrementStat('alphabetGrabLetters', 1);
      await incrementMission(1);

      // Achievements
      const nextQIndex = questionIndex + 1;
      if (nextQIndex === 5) {
        setBuddyText("🎉 Awesome! 5 correct sequence gaps matched!");
      }
      if (nextQIndex === 10) {
        await earnBadge('letter-champion');
      }

      await logTelemetry(true, balloon.label);

      setTimeout(() => {
        advanceQuestion();
      }, 3000);

    } else {
      setBuddyState('sad');
      setFlashRed(true);
      setShakeScreen(true); // screen shake on wrong drop!
      playWrong(); // Play incorrect sound
      
      setTimeout(() => {
        setFlashRed(false);
        setShakeScreen(false);
      }, 500);
      
      setStats(prev => ({
        ...prev,
        questionsAttempted: prev.questionsAttempted + 1
      }));

      if (nextAttempts >= 3) {
        setMatchingActive(false);
        setBuddyText(`Good effort! The sequence completed with: ${currentQuestion.answer}. 🎈`);
        await logTelemetry(false, balloon.label);
        setStreak(0);
        
        setTimeout(() => {
          advanceQuestion();
        }, 3200);
      } else {
        setBuddyText(`Not quite! Attempt ${nextAttempts}/3. Look closely and grab again! 💪`);
        setStreak(0);
        await logTelemetry(false, balloon.label);

        // Respawn the incorrect balloon back in the sky area after it is swallowed completely (1.5s)
        setTimeout(() => {
          balloonsRef.current = balloonsRef.current.map(b => {
            if (b.id === balloon.id) {
              return {
                ...b,
                swallowed: false,
                x: 200 + Math.random() * 240,
                y: 120 + Math.random() * 100,
                radius: 38,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5 - 0.2
              };
            }
            return b;
          });
          setBalloons([...balloonsRef.current]);
        }, 1500);
      }
    }
  };

  const advanceQuestion = () => {
    const nextIdx = questionIndex + 1;
    if (nextIdx < 10) {
      setQuestionIndex(nextIdx);
    } else {
      handleSessionComplete();
    }
  };

  const handleSessionComplete = async () => {
    setBuddyState('happy');
    setBuddyText("Hooray! Sequence completed! Let's check your stars! 🏆");

    const attempted = stats.questionsAttempted;
    const accuracyVal = attempted > 0 ? Math.round((stats.questionsCorrect / attempted) * 100) : 100;

    // Calculate stars
    const { stars, points } = calculateStars('alphabetGrab', currentLevel, {
      accuracy: accuracyVal,
      timeTaken,
      streak: bestStreak,
      firstTry: (gameStars[currentLevel] || 0) === 0
    });

    setEarnedStars(stars);
    setCalculatedPoints(points);

    // Save level stars locally
    const storageKey = `curiokids_stars_alphabetGrab_${childProfile?.uid || 'guest'}`;
    const updatedStars = { ...gameStars, [currentLevel]: Math.max(gameStars[currentLevel] || 0, stars) };
    setGameStars(updatedStars);
    localStorage.setItem(storageKey, JSON.stringify(updatedStars));

    // Award overall stars to profile
    const previousStars = gameStars[currentLevel] || 0;
    const newStarsGained = Math.max(0, stars - previousStars);
    if (newStarsGained > 0) {
      await awardStars(newStarsGained, 'alphabet-grab');
    }

    // Standard achievements tracking
    await incrementStat('alphabetGrabLetters', stats.questionsCorrect);
    await incrementMission(1);

    // Write session log
    const uid = currentUser?.uid || 'guest';
    const sessionData = {
      gameType: 'alphabetGrab',
      level: currentLevel,
      starsEarned: stars,
      pointsEarned: points,
      accuracy: accuracyVal,
      timeTaken: timeTaken,
      questionsCorrect: stats.questionsCorrect,
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

  const generateQuestions = (levelNum) => {
    const lvlConfig = getLevelConfig('alphabetGrab', levelNum);
    if (!lvlConfig) return [];
    
    const types = lvlConfig.questionTypes || ['after'];
    const numOptions = lvlConfig.numOptions || 3;
    
    const questions = [];
    
    for (let i = 0; i < 10; i++) {
      const type = types.includes('all')
        ? ['after', 'before', 'missing', 'spell'][Math.floor(Math.random() * 4)]
        : types[Math.floor(Math.random() * types.length)];
        
      if (type === 'after') {
        const charCode = 65 + Math.floor(Math.random() * 23); // A-X
        const current = String.fromCharCode(charCode);
        const next = String.fromCharCode(charCode + 1);
        
        const opts = new Set([next]);
        while (opts.size < numOptions) {
          const randChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
          opts.add(randChar);
        }
        
        questions.push({
          prompt: `What comes after ${current}?`,
          answer: next,
          options: [...opts].sort(() => Math.random() - 0.5),
          type: 'after',
          difficulty: levelNum <= 2 ? 1 : (levelNum === 3 ? 2 : 3)
        });
      }
      else if (type === 'before') {
        const charCode = 66 + Math.floor(Math.random() * 24); // B-Y
        const current = String.fromCharCode(charCode);
        const prev = String.fromCharCode(charCode - 1);
        
        const opts = new Set([prev]);
        while (opts.size < numOptions) {
          const randChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
          opts.add(randChar);
        }
        
        questions.push({
          prompt: `What comes before ${current}?`,
          answer: prev,
          options: [...opts].sort(() => Math.random() - 0.5),
          type: 'before',
          difficulty: levelNum <= 2 ? 1 : (levelNum === 3 ? 2 : 3)
        });
      }
      else if (type === 'missing') {
        const charCode = 65 + Math.floor(Math.random() * 22); // A-W
        const first = String.fromCharCode(charCode);
        const mid = String.fromCharCode(charCode + 1);
        const last = String.fromCharCode(charCode + 2);
        
        const opts = new Set([mid]);
        while (opts.size < numOptions) {
          const randChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
          opts.add(randChar);
        }
        
        questions.push({
          prompt: `Fill in the blank: ${first} _ ${last}`,
          answer: mid,
          options: [...opts].sort(() => Math.random() - 0.5),
          type: 'missing',
          difficulty: levelNum <= 2 ? 1 : (levelNum === 3 ? 2 : 3)
        });
      }
      else if (type === 'spell') {
        const spellPool = [
          { word: 'CAT', missing: 'A', display: 'C _ T 🐱' },
          { word: 'DOG', missing: 'O', display: 'D _ G 🐶' },
          { word: 'LION', missing: 'I', display: 'L _ O N 🦁' },
          { word: 'BEE', missing: 'E', display: 'B _ E 🐝' },
          { word: 'FROG', missing: 'R', display: 'F _ O G 🐸' },
          { word: 'DUCK', missing: 'U', display: 'D _ C K 🦆' },
          { word: 'PEAR', missing: 'E', display: 'P _ A R 🍐' },
          { word: 'STAR', missing: 'A', display: 'S T _ R ⭐️' },
          { word: 'SUN', missing: 'U', display: 'S _ N ☀️' }
        ];
        
        const selected = spellPool[Math.floor(Math.random() * spellPool.length)];
        
        const opts = new Set([selected.missing]);
        while (opts.size < numOptions) {
          const randChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
          opts.add(randChar);
        }
        
        questions.push({
          prompt: `Find the spelling letter for: ${selected.display}`,
          answer: selected.missing,
          options: [...opts].sort(() => Math.random() - 0.5),
          type: 'spell',
          difficulty: levelNum <= 2 ? 1 : (levelNum === 3 ? 2 : 3)
        });
      }
    }
    
    return questions;
  };

  const startNewGame = (levelNum = currentLevel) => {
    const activeLevel = levelNum || currentLevel;
    const generated = generateQuestions(activeLevel);

    setSessionQuestions(generated);
    setQuestionIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setAttempts(0);
    setGrabbedId(null);
    grabbedIdRef.current = null;
    setMatchingActive(true);
    setTimeTaken(0);
    setStats({
      questionsAttempted: 0,
      questionsCorrect: 0
    });

    setGamePhase('playing');
  };

  const logTelemetry = async (success, labelSeen) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'alphabet-grab',
      success,
      target: currentQuestion.answer,
      detected: labelSeen,
      emotion: success ? 'happy' : 'sad',
      difficulty: currentLevel <= 2 ? 'EASY' : (currentLevel === 3 ? 'MEDIUM' : 'HARD')
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

  // Sandbox drag coordinates
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
    if (!sandboxMode || !matchingActive || gamePhase !== 'playing') return;
    const coords = getCanvasOffsetCoords(e);
    
    balloonsRef.current.forEach(b => {
      const d = Math.sqrt(Math.pow(coords.x - b.x, 2) + Math.pow(coords.y - b.y, 2));
      if (d < b.radius + 15) {
        setGrabbedId(b.id);
        grabbedIdRef.current = b.id;
        spawnSparkles(b.x, b.y);
      }
    });
  };

  const handleSandboxMove = (e) => {
    if (!sandboxMode || grabbedId === null || !matchingActive || gamePhase !== 'playing') return;
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
    if (!sandboxMode || grabbedId === null || !matchingActive || gamePhase !== 'playing') return;
    handleLetterRelease(grabbedId);
  };

  const isHoveringDropZone = balloons.some(b => b.id === grabbedId && b.y > 280 && b.x > 180 && b.x < 460);

  return (
    <div className="space-y-6">
      {gamePhase === 'menu' && (
        <LevelSelect
          gameType="alphabetGrab"
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
            gameName="alphabetGrab"
            level={currentLevel}
            levelName={config.name}
            stars={gameStars[currentLevel] || 0}
            totalStars={Object.values(gameStars).reduce((s, a) => s + a, 0)}
            onPause={() => setBuddyText("Take a breath! Find those letters whenever you are ready! 🧘🎈")}
            onQuit={onBack}
          />

          <AIBuddy
            skin={childProfile?.companion || 'sparky'}
            state={buddyState}
            text={buddyText}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto px-4 select-none">
            
            {/* Left Screen: Floating Canvas */}
            <div className="lg:col-span-2 bg-white/70 backdrop-blur-md p-4 rounded-4xl border-3 border-white/60 shadow-lg flex flex-col items-center relative min-h-[350px]">
              
              {/* Question progress */}
              <div className="absolute top-4 right-4 bg-slate-100 border border-slate-200 text-slate-500 font-bold px-3 py-1 rounded-full text-[10px] z-50">
                Card {questionIndex + 1} of 10
              </div>

              {/* World Theme Container frame (Framer Motion enabled shake anim) */}
              <motion.div
                animate={shakeScreen ? { x: [-10, 10, -10, 10, -5, 5, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                className={`relative w-full aspect-video overflow-hidden rounded-3xl border-6 bg-gradient-to-b ${activeTheme.style} ${activeTheme.border} flex items-center justify-center transition-all ${
                  sandboxMode ? 'cursor-grab active:cursor-grabbing' : ''
                }`}
                onMouseDown={handleSandboxStart}
                onMouseMove={handleSandboxMove}
                onMouseUp={handleSandboxEnd}
                onTouchStart={handleSandboxStart}
                onTouchMove={handleSandboxMove}
                onTouchEnd={handleSandboxEnd}
              >
                {/* Red flash mismatch overlay */}
                {flashRed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.65, 0] }}
                    className="absolute inset-0 bg-red-600/40 z-45 pointer-events-none"
                    transition={{ duration: 0.4 }}
                  />
                )}

                {/* Mirror camera input stream */}
                {!sandboxMode && (
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                    muted
                    playsInline
                  />
                )}

                {/* Hand skeleton drawings overlay */}
                {!sandboxMode && (
                  <canvas
                    ref={skeletonCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    width={640}
                    height={480}
                  />
                )}

                {/* Canvas renderer for trails/balloons */}
                <canvas
                  ref={gameCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none z-20"
                  width={640}
                  height={480}
                />

                {/* Sparkles particle system */}
                <canvas
                  ref={sparklesCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none z-30"
                  width={640}
                  height={480}
                />

                {/* High-Accuracy Custom Cursor Ring Overlay */}
                {!sandboxMode && isHandDetected && (
                  <div 
                    className="absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${(indexFingerTip.x / 640) * 100}%`,
                      top: `${(indexFingerTip.y / 480) * 100}%`,
                    }}
                  >
                    {/* Ring indicator */}
                    <div 
                      className={`absolute inset-[-15px] rounded-full border-2 ${isPinching ? 'border-curio-pink bg-curio-pink/15 scale-95' : 'border-curio-purple bg-curio-purple/5 scale-100'} transition-all duration-200 ${
                        balloons.some(b => !b.swallowed && !b.returning && Math.sqrt(Math.pow(indexFingerTip.x - b.x, 2) + Math.pow(indexFingerTip.y - b.y, 2)) < 90)
                          ? 'animate-pulse border-curio-yellow border-3 scale-110'
                          : ''
                      }`}
                    />
                    {/* Center point target */}
                    <div className={`w-8 h-8 rounded-full ${isPinching ? 'bg-curio-pink scale-95' : 'bg-curio-purple scale-100'} border-3 border-white shadow-lg transition-all duration-200 flex items-center justify-center text-sm`}>
                      {isPinching ? '✊' : '✋'}
                    </div>
                  </div>
                )}

                {/* Floating CSS Balloon nodes wrapper */}
                <div className="absolute inset-0 z-25 pointer-events-none">
                  <AnimatePresence>
                    {balloons.map((b) => {
                      if (b.radius <= 0) return null;
                      return (
                        <motion.div
                          key={b.id}
                          className={`absolute rounded-full flex items-center justify-center font-black select-none pointer-events-auto cursor-grab active:cursor-grabbing border-3 border-white/90 shadow-lg ${
                            wrongShakeId === b.id ? 'animate-wiggle' : ''
                          }`}
                          style={{
                            left: `${(b.x / 640) * 100}%`,
                            top: `${(b.y / 480) * 100}%`,
                            transform: 'translate(-50%, -50%)',
                            width: `${b.radius * 2}px`,
                            height: `${b.radius * 2}px`,
                            background: `radial-gradient(circle at 30% 30%, #ffffff 0%, ${b.color} 40%, ${b.color} 100%)`,
                            boxShadow: b.id === grabbedId
                              ? '0 0 25px 8px rgba(255, 159, 28, 0.65), inset 0 -4px 10px rgba(0,0,0,0.3)'
                              : '0 8px 16px rgba(0,0,0,0.35), inset 0 -4px 10px rgba(0,0,0,0.25)',
                          }}
                          animate={{ scale: b.id === grabbedId ? 1.25 : 1.0 }}
                          onMouseDown={(e) => handleSandboxStart(e)}
                          onTouchStart={(e) => handleSandboxStart(e)}
                        >
                          {/* 3D Gloss highlight reflection */}
                          <div className="absolute top-2 left-2 w-3.5 h-2 bg-white/40 rounded-full rotate-[-30deg]"></div>

                          {/* Balloon Knot */}
                          <div 
                            className="absolute bottom-[-3px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px]"
                            style={{ borderBottomColor: b.color }}
                          ></div>

                          {/* String */}
                          <div className="absolute bottom-[-22px] left-1/2 transform -translate-x-1/2 w-[2px] h-[20px] bg-white/20 border-l border-dashed border-white/40" />

                          {/* Label Typography */}
                          <span
                            className="text-white select-none pointer-events-none font-kids drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                            style={{
                              fontSize: `${b.radius * 0.9}px`,
                              fontWeight: '900',
                            }}
                          >
                            {b.label}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Monster Mouth Drop Target (Glows brighter when hovering) */}
                <div
                  className={`absolute bottom-2 left-1/2 transform -translate-x-1/2 w-48 h-24 rounded-t-5xl border-4 border-b-0 border-curio-slate bg-curio-purple flex flex-col items-center justify-center text-white z-40 transition-all shadow-[0_-8px_0_0_rgba(0,0,0,0.08)] ${
                    isHoveringDropZone
                      ? 'scale-110 border-amber-400 bg-indigo-900 shadow-[0_-8px_35px_10px_rgba(251,191,36,0.6)] font-extrabold animate-pulse'
                      : grabbedId !== null 
                        ? 'scale-105 border-curio-yellow bg-curio-purple-dark shadow-[0_-8px_20px_0_rgba(245,158,11,0.3)] shadow-playful' 
                        : ''
                  }`}
                >
                  <div className="w-16 h-2 bg-pink-300 rounded-full mb-1"></div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-pink-100 select-none pointer-events-none font-kids">Drop here! 😋</span>
                  <span className="text-3xl mt-0.5 select-none pointer-events-none">👾</span>
                </div>

                {/* Hand tracker loader feedback */}
                {!sandboxMode && isLoadingModels && (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center space-y-3 z-50 text-white select-none">
                    <div className="w-10 h-10 border-4 border-slate-700 border-t-curio-orange rounded-full animate-spin" />
                    <h4 className="font-extrabold text-sm">Preparing Hand Grabber...</h4>
                    <p className="text-[10px] text-slate-400 font-bold max-w-xs leading-normal">
                      Camera tracking assets are booting up. Wave hand when ready!
                    </p>
                  </div>
                )}

                {/* Letter Loader fallback */}
                {loadingLetters && (
                  <div className="absolute inset-0 bg-slate-950/40 z-50 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </motion.div>

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
                  className="text-xs font-black text-curio-purple hover:underline bg-slate-100/60 hover:bg-slate-200 border-2 border-curio-slate px-3 py-2 rounded-xl flex items-center gap-1 shadow cursor-pointer transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{sandboxMode ? "Use Active Hand Camera" : "Switch to Button Sandbox"}</span>
                </button>

                <div className="flex gap-2 items-center text-xs font-black text-slate-400 uppercase">
                  <Flame className="w-4 h-4 text-curio-pink fill-curio-pink" />
                  <span>Streak: {streak}</span>
                </div>
              </div>
            </div>

            {/* Right Pane question metrics */}
            <div className="space-y-6 select-none">
              {/* Question card */}
              <div className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg text-center space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
                  Active Challenge
                </h4>
                
                <div className="bg-slate-50 py-4 px-6 rounded-3xl border-2 border-slate-100 min-h-[100px] flex flex-col justify-center shadow-inner">
                  <h5 className="text-lg font-black text-curio-slate leading-snug">
                    {currentQuestion.prompt}
                  </h5>
                  <span className="text-[10px] font-black text-curio-purple uppercase tracking-wider mt-2.5 block leading-none">
                    World: {activeTheme.name}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-curio-orange-light/50 border-2 border-slate-100 rounded-2xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase block leading-none">Attempts</span>
                    <span className="text-xl font-black text-curio-orange mt-1 block leading-none">{attempts} / 3</span>
                  </div>
                  <div className="p-3 bg-sky-100/50 border-2 border-slate-100 rounded-2xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase block leading-none">Drift Speed</span>
                    <span className="text-xl font-black text-sky-600 mt-1 block leading-none capitalize">{config.speed}</span>
                  </div>
                </div>
              </div>

              {/* Guidelines panel */}
              <div className="bg-white/70 backdrop-blur-md p-5 rounded-4xl border-3 border-white/60 shadow-lg space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  🎮 Grab Room Rules
                </h4>
                
                <ul className="text-[10px] text-slate-500 font-bold space-y-2 leading-relaxed list-disc list-inside">
                  <li>Pinch thumb and index finger to grab a floating balloon letter!</li>
                  <li>Drift it over the bottom Monster Mouth and release to drop!</li>
                  <li>Wrong drops trigger shake effects and flashing screen alerts.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {gamePhase === 'complete' && (
        <GameComplete
          gameName="alphabetGrab"
          level={currentLevel}
          starsEarned={earnedStars}
          points={calculatedPoints}
          stats={{
            timeTaken,
            accuracy: stats.questionsAttempted > 0 ? Math.round((stats.questionsCorrect / stats.questionsAttempted) * 100) : 100,
            combo: bestStreak
          }}
          onReplay={() => startNewGame(currentLevel)}
          onNextLevel={handleNextLevel}
          onHome={() => setGamePhase('menu')}
        />
      )}
    </div>
  );
}
