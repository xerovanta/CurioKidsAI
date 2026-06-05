import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Mic, AlertCircle, RefreshCw, Sparkles, Volume2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useSpeech } from '../hooks/useSpeech';
import AIBuddy from '../components/AIBuddy';
import { collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';
import { getLevelConfig, getNextLevelStars } from '../utils/levelSystem.js';
import { calculateStars } from '../utils/scoringEngine.js';
import GameHeader from '../components/game/GameHeader.jsx';
import GameComplete from '../components/game/GameComplete.jsx';
import LevelSelect from '../components/game/LevelSelect.jsx';

const WORD_POOL = [
  // Animals
  { word: 'cat', emoji: '🐱', category: 'animals' },
  { word: 'dog', emoji: '🐶', category: 'animals' },
  { word: 'lion', emoji: '🦁', category: 'animals' },
  { word: 'bear', emoji: '🐻', category: 'animals' },
  { word: 'frog', emoji: '🐸', category: 'animals' },
  { word: 'duck', emoji: '🦆', category: 'animals' },
  { word: 'zebra', emoji: '🦓', category: 'animals' },
  { word: 'elephant', emoji: '🐘', category: 'animals' },
  { word: 'monkey', emoji: '🐒', category: 'animals' },
  { word: 'octopus', emoji: '🐙', category: 'animals' },
  { word: 'dinosaur', emoji: '🦖', category: 'animals' },
  { word: 'dolphin', emoji: '🐬', category: 'animals' },

  // Fruits
  { word: 'pear', emoji: '🍐', category: 'fruits' },
  { word: 'apple', emoji: '🍎', category: 'fruits' },
  { word: 'peach', emoji: '🍑', category: 'fruits' },
  { word: 'banana', emoji: '🍌', category: 'fruits' },
  { word: 'orange', emoji: '🍊', category: 'fruits' },
  { word: 'cherry', emoji: '🍒', category: 'fruits' },
  { word: 'grapes', emoji: '🍇', category: 'fruits' },
  { word: 'strawberry', emoji: '🍓', category: 'fruits' },

  // Objects
  { word: 'car', emoji: '🚗', category: 'objects' },
  { word: 'hat', emoji: '🎩', category: 'objects' },
  { word: 'ball', emoji: '⚽', category: 'objects' },
  { word: 'book', emoji: '📖', category: 'objects' },
  { word: 'house', emoji: '🏠', category: 'objects' },
  { word: 'pencil', emoji: '✏️', category: 'objects' },
  { word: 'balloon', emoji: '🎈', category: 'objects' },
  { word: 'umbrella', emoji: '☂️', category: 'objects' },
  { word: 'telescope', emoji: '🔭', category: 'objects' }
];

import { useSound } from '../hooks/useSound.js';

export default function WordRepeat({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission, incrementStat } = useAuth();
  const { speak, startListening, stopListening, isListening, recognitionError, cancelAllSpeech } = useSpeech();
  const { playCorrect, playWrong, playWin } = useSound();

  // Level & Phase states
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gamePhase, setGamePhase] = useState('menu'); // 'menu' | 'playing' | 'complete'
  const [sessionWords, setSessionWords] = useState([]);
  const [activeWordIndex, setActiveWordIndex] = useState(0);

  // Settings
  const [phonicsMode, setPhonicsMode] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);

  // Audio / speak / text triggers
  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [matchingActive, setMatchingActive] = useState(true);

  // Timing
  const [timeTaken, setTimeTaken] = useState(0);

  // Stats states
  const [stats, setStats] = useState({
    wordsAttempted: 0,
    wordsCorrect: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalAccuracySum: 0
  });

  // Last attempt accuracy (visual feedback)
  const [lastWordAccuracy, setLastWordAccuracy] = useState(null);
  const [showAccuracyMeter, setShowAccuracyMeter] = useState(false);

  // Stars tracking
  const [earnedStars, setEarnedStars] = useState(0);
  const [calculatedPoints, setCalculatedPoints] = useState(0);
  const [gameStars, setGameStars] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  // Safety references for sudden navigation/unmounts
  const mountedRef = React.useRef(true);
  const phonicsTimeoutRef = React.useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (phonicsTimeoutRef.current) {
        clearTimeout(phonicsTimeoutRef.current);
      }
      cancelAllSpeech();
    };
  }, [cancelAllSpeech]);

  const config = getLevelConfig('wordRepeat', currentLevel) || {};
  const currentItem = sessionWords[activeWordIndex] || { word: 'cat', emoji: '🐱', category: 'animals' };

  // Load level stars from localStorage on child profile load
  useEffect(() => {
    if (childProfile) {
      const storageKey = `curiokids_stars_wordRepeat_${childProfile.uid || 'guest'}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setGameStars(JSON.parse(saved));
      }
    }
  }, [childProfile]);

  // Handle active word synthesising / speaking
  useEffect(() => {
    if (gamePhase !== 'playing' || sessionWords.length === 0) return;

    setSpokenTranscript('');
    setMatchingActive(true);
    setBuddyState('idle');
    setShowAccuracyMeter(false);

    const isFirstTime = stats.wordsAttempted === 0;

    let displayWord = currentItem.word.toUpperCase();
    if (phonicsMode) {
      displayWord = currentItem.word.split('').join(' - ').toUpperCase();
    }

    setBuddyText(
      phonicsMode
        ? `Blend the phonemes: "${displayWord}"! Let's say: "${currentItem.word.toUpperCase()}"! 🗣️`
        : `Repeat after me! Say: "${currentItem.word.toUpperCase()}"! 🗣️`
    );

    const delaySpeech = setTimeout(() => {
      if (!mountedRef.current) return;
      if (phonicsMode) {
        const spokenPhonics = currentItem.word.split('').join(' . ');
        speak(spokenPhonics, () => {
          if (mountedRef.current) {
            phonicsTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) speak(currentItem.word);
            }, 600);
          }
        });
      } else {
        speak(currentItem.word);
      }
    }, isFirstTime ? 800 : 300);

    return () => {
      clearTimeout(delaySpeech);
      stopListening();
    };
  }, [activeWordIndex, sessionWords, phonicsMode, gamePhase]);

  // Live Timer Effect
  useEffect(() => {
    if (gamePhase !== 'playing') return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      setTimeTaken(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase]);

  const filterWordPool = (levelConfig) => {
    if (!levelConfig) return WORD_POOL;
    const categories = levelConfig.categories || ["all"];
    const wordLength = levelConfig.wordLength || "all";

    return WORD_POOL.filter(item => {
      // 1. Filter by category
      const matchesCategory = categories.includes("all") || categories.includes(item.category);
      if (!matchesCategory) return false;

      // 2. Filter by word length
      const len = item.word.length;
      if (wordLength === "3-4 letters") {
        return len >= 3 && len <= 4;
      } else if (wordLength === "4-5 letters") {
        return len >= 4 && len <= 5;
      } else if (wordLength === "5-6 letters") {
        return len >= 5 && len <= 6;
      } else if (wordLength === "6+ letters") {
        return len >= 6;
      }
      return true; // "all"
    });
  };

  const startNewGame = (levelNum = currentLevel) => {
    const activeLevel = levelNum || currentLevel;
    const activeConfig = getLevelConfig('wordRepeat', activeLevel);
    if (!activeConfig) return;

    const filtered = filterWordPool(activeConfig);
    // Shuffle and pick 10 words (or all if filtered pool size is smaller than 10)
    const shuffled = [...filtered].sort(() => Math.random() - 0.5).slice(0, 10);

    setSessionWords(shuffled);
    setActiveWordIndex(0);
    setSpokenTranscript('');
    setMatchingActive(true);
    setBuddyState('idle');
    setTimeTaken(0);
    setLastWordAccuracy(null);
    setShowAccuracyMeter(false);

    setStats({
      wordsAttempted: 0,
      wordsCorrect: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalAccuracySum: 0
    });

    setGamePhase('playing');
  };

  const handleSpeakItem = () => {
    speak(currentItem.word);
  };

  const getSpeechAccuracy = (target, spoken) => {
    const t = target.toLowerCase().trim();
    const s = spoken.toLowerCase().trim();
    if (t === s) return 100;

    if (s.includes(t)) {
      const diff = s.length - t.length;
      return Math.max(75, 100 - diff * 5);
    }

    // Characters overlap calculation
    let matches = 0;
    const tChars = t.split('');
    const sChars = s.split('');
    tChars.forEach(c => {
      const idx = sChars.indexOf(c);
      if (idx !== -1) {
        matches++;
        sChars.splice(idx, 1);
      }
    });

    const maxLen = Math.max(t.length, s.length);
    const score = maxLen > 0 ? Math.round((matches / maxLen) * 100) : 0;
    return Math.min(98, Math.max(25, score));
  };

  const handleStartMicListen = () => {
    if (!matchingActive) return;

    setBuddyState('listening');
    setBuddyText(`Listening... Pronounce: "${currentItem.word.toUpperCase()}"! 🎙️`);

    startListening(async (spokenResult) => {
      setSpokenTranscript(spokenResult);
      const accuracy = getSpeechAccuracy(currentItem.word, spokenResult);

      setLastWordAccuracy(accuracy);
      setShowAccuracyMeter(true);

      const threshold = config.accuracyThreshold || 60;

      if (accuracy >= threshold) {
        await handleCorrectAnswer(spokenResult, accuracy);
      } else {
        await handleWrongAnswer(spokenResult, accuracy);
      }
    });
  };

  const handleCorrectAnswer = async (spokenValue, accuracy) => {
    // Play correct answer sound
    playCorrect();
    setMatchingActive(false);
    setBuddyState('happy');

    const nextStreak = stats.currentStreak + 1;
    const bestStreak = Math.max(stats.bestStreak, nextStreak);

    setStats(prev => ({
      wordsAttempted: prev.wordsAttempted + 1,
      wordsCorrect: prev.wordsCorrect + 1,
      currentStreak: nextStreak,
      bestStreak: bestStreak,
      totalAccuracySum: prev.totalAccuracySum + accuracy
    }));

    setBuddyText(`Fantastic! You said "${currentItem.word.toUpperCase()}" perfectly! ${currentItem.emoji} accuracy is ${accuracy}%!`);

    confetti({
      particleCount: 50,
      spread: 40,
      origin: { y: 0.6 }
    });

    await logSpeechTelemetry(true, spokenValue, accuracy);

    setTimeout(() => {
      advanceWord();
    }, 2800);
  };

  const handleWrongAnswer = async (spokenValue, accuracy) => {
    // Play incorrect answer sound
    playWrong();
    setBuddyState('sad');
    setBuddyText(`Hmm, accuracy is ${accuracy}%. Let's try again! Speak clearly: "${currentItem.word.toUpperCase()}"! 🦖`);

    setStats(prev => ({
      ...prev,
      wordsAttempted: prev.wordsAttempted + 1,
      currentStreak: 0,
      totalAccuracySum: prev.totalAccuracySum + accuracy
    }));

    await logSpeechTelemetry(false, spokenValue, accuracy);

    setTimeout(() => {
      setBuddyState('idle');
      setBuddyText(`Try: "${currentItem.word.toUpperCase()}" again! Tap the microphone.`);
      setShowAccuracyMeter(false);
    }, 3500);
  };

  const advanceWord = () => {
    const nextIdx = activeWordIndex + 1;
    if (nextIdx >= sessionWords.length) {
      handleSessionComplete();
    } else {
      setActiveWordIndex(nextIdx);
    }
  };

  const handleSandboxClick = async (word) => {
    if (!matchingActive) return;

    if (word === currentItem.word) {
      setLastWordAccuracy(100);
      setShowAccuracyMeter(true);
      await handleCorrectAnswer(word, 100);
    } else {
      setLastWordAccuracy(30);
      setShowAccuracyMeter(true);
      await handleWrongAnswer(word, 30);
    }
  };

  const handleSessionComplete = async () => {
    // Play level completed fanfare!
    playWin();
    setBuddyState('happy');
    setBuddyText("Hooray! Level finished! Let's check your stars! 🏆");

    const attempted = stats.wordsAttempted;
    const finalAccuracy = attempted > 0 ? Math.round(stats.totalAccuracySum / attempted) : 0;

    // Calculate stars
    const { stars, points } = calculateStars('wordRepeat', currentLevel, {
      accuracy: finalAccuracy,
      timeTaken: timeTaken,
      streak: stats.bestStreak,
      firstTry: (gameStars[currentLevel] || 0) === 0
    });

    setEarnedStars(stars);
    setCalculatedPoints(points);

    // Save level stars locally
    const storageKey = `curiokids_stars_wordRepeat_${childProfile?.uid || 'guest'}`;
    const updatedStars = { ...gameStars, [currentLevel]: Math.max(gameStars[currentLevel] || 0, stars) };
    setGameStars(updatedStars);
    localStorage.setItem(storageKey, JSON.stringify(updatedStars));

    // Award overall stars in DB
    const previousStars = gameStars[currentLevel] || 0;
    const newStarsGained = Math.max(0, stars - previousStars);
    if (newStarsGained > 0) {
      await awardStars(newStarsGained, 'word-repeat');
    }

    // Standard achievements tracking
    await incrementStat('wordRepeatWords', stats.wordsCorrect);
    await incrementMission(1);

    // Write a session record for Parent Dashboard
    const uid = currentUser?.uid || 'guest';
    const sessionData = {
      gameType: 'wordRepeat',
      level: currentLevel,
      starsEarned: stars,
      pointsEarned: points,
      accuracy: finalAccuracy,
      timeTaken: timeTaken,
      wordsCorrect: stats.wordsCorrect,
      wordsAttempted: stats.wordsAttempted,
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
      console.log("📝 Saved offline session record:", sessionData);
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

  const logSpeechTelemetry = async (success, spoken, accuracyScore) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'word-repeat',
      success,
      target: currentItem.word,
      detected: spoken || 'none',
      accuracy: accuracyScore,
      emotion: success ? 'happy' : 'neutral'
    };

    if (isValidConfig && db && currentUser) {
      try {
        await addDoc(collection(db, 'interactions', currentUser.uid, 'logs'), logData);
      } catch (err) {
        console.error("Firestore logging failed:", err);
      }
    } else {
      console.log("📝 Offline Speech Telemetry Logged:", logData);
    }
  };

  // SVG Circular Accuracy progress metrics
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = lastWordAccuracy !== null ? circumference - (lastWordAccuracy / 100) * circumference : circumference;

  return (
    <div className="space-y-6">
      {gamePhase === 'menu' && (
        <LevelSelect
          gameType="wordRepeat"
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
            gameName="wordRepeat"
            level={currentLevel}
            levelName={config.name}
            stars={gameStars[currentLevel] || 0}
            totalStars={Object.values(gameStars).reduce((s, a) => s + a, 0)}
            onPause={() => setBuddyText("Perfect pronunciation takes practice! Rest up. 🗣️")}
            onQuit={onBack}
          />

          {/* Phonics & Theme Mode controls */}
          <div className="flex flex-wrap gap-3 justify-between items-center w-full max-w-5xl mx-auto px-4">
            {/* Phonics Toggle button */}
            <button
              onClick={() => setPhonicsMode(prev => !prev)}
              className={`px-4 py-2 rounded-2xl font-black text-xs border-2 shadow-sm transition active:scale-95 flex items-center gap-1.5 ${
                phonicsMode
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-purple-600 text-white'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              🧩 Phonics Mode: {phonicsMode ? 'ON' : 'OFF'}
            </button>

            {/* Streak Tracker Display */}
            {stats.currentStreak > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-100 border border-orange-200/60 px-3 py-1.5 rounded-full font-black text-xs text-orange-700 shadow-sm">
                <span>🔥 Streak: {stats.currentStreak}</span>
                {stats.currentStreak > 3 && <span className="animate-bounce">🔥</span>}
              </div>
            )}
          </div>

          <AIBuddy
            skin={childProfile?.companion || 'sparky'}
            state={buddyState}
            text={buddyText}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto px-4">
            
            {/* Interaction Panel */}
            <div className="lg:col-span-2 bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg flex flex-col items-center justify-center min-h-[380px] relative select-none">
              
              {/* Progress counter pill */}
              <div className="absolute top-4 right-4 bg-slate-100 border border-slate-200 text-slate-500 font-bold px-3 py-1 rounded-full text-[10px]">
                Word {activeWordIndex + 1} of {sessionWords.length}
              </div>

              {sandboxMode ? (
                /* Sandbox Buttons */
                <div className="flex flex-col items-center justify-center w-full h-full py-6 space-y-6">
                  <div className="text-center space-y-1">
                    <span className="text-5xl block animate-bounce-slow">🧩</span>
                    <h4 className="font-black text-curio-slate text-lg uppercase">Sandbox Matching</h4>
                    <p className="text-xs text-slate-400 font-bold max-w-xs mx-auto">
                      Microphone is disabled. Click the matching bubble representing your buddy's word!
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 w-full max-w-lg">
                    {sessionWords.slice(0, 8).map((item) => (
                      <button
                        key={item.word}
                        onClick={() => handleSandboxClick(item.word)}
                        className={`p-4 bg-white hover:bg-curio-purple-light border-3 border-curio-slate rounded-3xl flex flex-col items-center transition duration-150 transform hover:scale-105 active:scale-95 shadow cursor-pointer ${
                          !matchingActive ? 'pointer-events-none opacity-40' : ''
                        }`}
                      >
                        <span className="text-4xl">{item.emoji}</span>
                        <span className="text-xs font-black text-curio-slate mt-1.5 capitalize">{item.word}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Standard Microphone visually animated */
                <div className="flex flex-col items-center justify-center space-y-8 py-8 w-full max-w-md">
                  <div className="text-center space-y-1.5 select-none">
                    <div className="text-7xl animate-float block">🎙️</div>
                    <h4 className="font-black text-lg text-curio-slate">Tap & Say it out loud!</h4>
                    <p className="text-xs text-slate-400 font-bold leading-normal">
                      Press the microphone bubble, say the word clearly, and let Buddy check your spelling!
                    </p>
                  </div>

                  {/* Glow active micro bubble */}
                  <motion.button
                    onClick={handleStartMicListen}
                    disabled={!matchingActive}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-28 h-28 rounded-full border-4 border-white shadow-lg flex items-center justify-center cursor-pointer transition select-none ${
                      isListening
                        ? 'bg-curio-pink animate-pulse text-white shadow-playful-pink scale-102'
                        : 'bg-curio-purple hover:bg-curio-purple-dark text-white shadow-playful-purple'
                    } disabled:opacity-40 disabled:pointer-events-none`}
                  >
                    <Mic className="w-12 h-12" />
                  </motion.button>

                  {recognitionError && (
                    <div className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-2.5 rounded-2xl text-xs font-bold text-center animate-wiggle">
                      ⚠️ Microphone Error: {recognitionError}
                    </div>
                  )}
                </div>
              )}

              {/* Toggle Sandbox mode switch */}
              <button
                onClick={() => {
                  const nextMode = !sandboxMode;
                  setSandboxMode(nextMode);
                  stopListening();
                  setShowAccuracyMeter(false);
                }}
                className="mt-4 text-xs font-black text-curio-purple hover:underline bg-slate-100/60 hover:bg-slate-200 border-2 border-curio-slate px-3 py-1.5 rounded-xl flex items-center gap-1 shadow cursor-pointer select-none"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{sandboxMode ? "Use Active Microphone" : "Switch to Button Sandbox"}</span>
              </button>
            </div>

            {/* Right Pane Target Word card */}
            <div className="space-y-6">
              
              {/* Card target */}
              <div className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg text-center space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-curio-pink" />
                  Target Word
                </h4>
                
                <div className="flex justify-center">
                  <motion.div
                    className="w-24 h-24 rounded-full border-3 border-curio-slate shadow bg-curio-purple-light flex items-center justify-center text-5xl relative cursor-pointer group"
                    onClick={handleSpeakItem}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {currentItem.emoji}
                    <div className="absolute -bottom-1 -right-1 bg-curio-pink text-white p-1 rounded-full border border-curio-slate shadow">
                      <Volume2 className="w-3.5 h-3.5" />
                    </div>
                  </motion.div>
                </div>

                <h5 className="text-2xl font-black uppercase text-curio-slate tracking-wider font-kids">
                  {currentItem.word}
                </h5>

                <button
                  onClick={handleSpeakItem}
                  className="text-xs font-black text-slate-400 hover:text-curio-purple hover:underline flex items-center gap-1 mx-auto cursor-pointer select-none"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Hear word pronunciation</span>
                </button>
              </div>

              {/* Accuracy Circular Meter */}
              {showAccuracyMeter && lastWordAccuracy !== null && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-white/70 backdrop-blur-md p-5 rounded-4xl border-3 border-white/60 shadow-lg flex items-center justify-between gap-4"
                >
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">
                      Pronunciation Accuracy
                    </h4>
                    <span className="text-xl font-black text-slate-700 block mt-1">
                      {lastWordAccuracy}% Match
                    </span>
                    <span className={`text-[10px] font-bold block mt-0.5 ${
                      lastWordAccuracy >= (config.accuracyThreshold || 60)
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    }`}>
                      {lastWordAccuracy >= (config.accuracyThreshold || 60) ? '✅ PASSING SCORE' : '❌ TRY AGAIN'}
                    </span>
                  </div>

                  {/* Circular visual progress meter */}
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        className="stroke-slate-100 fill-transparent"
                        strokeWidth="5"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        className={`fill-transparent transition-all duration-500 ${
                          lastWordAccuracy >= (config.accuracyThreshold || 60)
                            ? 'stroke-emerald-400'
                            : 'stroke-rose-400'
                        }`}
                        strokeWidth="5"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <span className="absolute text-xs font-black text-slate-700">
                      {lastWordAccuracy}%
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Transcript Feed */}
              {!sandboxMode && spokenTranscript && (
                <div className="bg-white/70 backdrop-blur-md p-5 rounded-4xl border-3 border-white/60 shadow-lg space-y-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    🎙️ Mic Transcript Feed
                  </h4>
                  <p className="text-xs font-bold text-slate-500">
                    🔹 Buddy Heard: <strong className="text-curio-slate text-sm">"{spokenTranscript}"</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {gamePhase === 'complete' && (
        <GameComplete
          gameName="wordRepeat"
          level={currentLevel}
          starsEarned={earnedStars}
          points={calculatedPoints}
          stats={{
            timeTaken,
            accuracy: stats.wordsAttempted > 0 ? Math.round(stats.totalAccuracySum / stats.wordsAttempted) : 0,
            combo: stats.bestStreak
          }}
          onReplay={() => startNewGame(currentLevel)}
          onNextLevel={handleNextLevel}
          onHome={() => setGamePhase('menu')}
        />
      )}
    </div>
  );
}
