import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import AIBuddy from '../components/AIBuddy';
import { collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';
import { getLevelConfig, getNextLevelStars } from '../utils/levelSystem.js';
import { calculateStars } from '../utils/scoringEngine.js';
import GameHeader from '../components/game/GameHeader.jsx';
import GameComplete from '../components/game/GameComplete.jsx';
import LevelSelect from '../components/game/LevelSelect.jsx';import { useSound } from '../hooks/useSound.js';

export default function MemoryMatch({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission, incrementStat } = useAuth();
  const { playFlip, playCorrect, playWrong, playWin } = useSound();

  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);

  // Level & Phase states
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gamePhase, setGamePhase] = useState('menu'); // 'menu' | 'playing' | 'complete'
  
  // Gameplay states
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [moves, setMoves] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Time & scoring metrics
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);
  
  // Powerup state
  const [hintsUsed, setHintsUsed] = useState(0);
  const [shuffleUsed, setShuffleUsed] = useState(false);

  // Combo system
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lastMatchTime, setLastMatchTime] = useState(null);

  // Star metrics
  const [earnedStars, setEarnedStars] = useState(0);
  const [calculatedPoints, setCalculatedPoints] = useState(0);

  // Persistent level-by-level stars mapping
  const [gameStars, setGameStars] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  const cardIcons = ['🦁', '🦒', '🦓', '🐘', '🐨', '🐼', '🐯', '🐵', '🐸', '🐙', '🦖', '🦄', '🐬', '🐝'];

  const gridStyles = {
    "2x2": "grid-cols-2 max-w-[240px]",
    "2x3": "grid-cols-3 max-w-[340px]",
    "3x4": "grid-cols-4 max-w-[440px]",
    "4x4": "grid-cols-4 max-w-[440px]",
    "4x5": "grid-cols-5 max-w-[500px]"
  };

  // Load level stars from localStorage on profile load
  useEffect(() => {
    if (childProfile) {
      const storageKey = `curiokids_stars_memoryMatch_${childProfile.uid || 'guest'}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setGameStars(JSON.parse(saved));
      }
    }
  }, [childProfile]);

  const config = getLevelConfig('memoryMatch', currentLevel) || {};

  // Live Timer Effect
  useEffect(() => {
    if (gamePhase !== 'playing') return;

    const startTime = Date.now();
    const limit = config.timeLimit || 0;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeTaken(elapsed);

      if (limit > 0) {
        const remaining = Math.max(0, limit - elapsed);
        setTimerSeconds(remaining);
        if (remaining === 0) {
          clearInterval(interval);
          handleGameLoss();
        }
      } else {
        setTimerSeconds(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase, currentLevel]);

  const startNewGame = (levelNum = currentLevel) => {
    const activeLevel = levelNum || currentLevel;
    const activeConfig = getLevelConfig('memoryMatch', activeLevel);
    if (!activeConfig) return;

    const pairs = activeConfig.pairs || 2;
    const deckIcons = cardIcons.slice(0, pairs);

    // Duplicate icons to form matching pairs
    const deck = [...deckIcons, ...deckIcons]
      .map((icon, index) => ({
        id: index,
        icon,
        isFlipped: false,
        isMatched: false
      }))
      .sort(() => Math.random() - 0.5);

    setCards(deck);
    setFlippedCards([]);
    setMatchedPairs([]);
    setMoves(0);
    setIsLocked(false);
    setGameOver(false);
    setHintsUsed(0);
    setShuffleUsed(false);
    setCombo(0);
    setMaxCombo(0);
    setLastMatchTime(null);
    setTimeTaken(0);
    setTimerSeconds(activeConfig.timeLimit || 0);

    setBuddyText(`Welcome to level ${activeLevel}! 🧩 Find all the matched pairs!`);
    setBuddyState('idle');
    setGamePhase('playing');
  };

  const handleGameLoss = () => {
    setBuddyState('sad');
    setBuddyText("Oh no! Time ran out! ⏰ Let's try again!");
    setEarnedStars(0);
    setCalculatedPoints(0);
    setGamePhase('complete');
  };

  const logInteractionTelemetry = async (success, moveCount) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'memory-match',
      success,
      target: `${config.pairs} matches`,
      detected: `${moveCount} moves`,
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

  const handleHint = () => {
    if (hintsUsed >= (config.hints || 0) || isLocked || gameOver) return;
    setHintsUsed(prev => prev + 1);
    setIsLocked(true);

    const originalDeck = [...cards];
    // Reveal all cards briefly
    setCards(prev => prev.map(c => ({ ...c, isFlipped: true })));

    setTimeout(() => {
      setCards(prev =>
        prev.map((c, idx) => ({
          ...c,
          isFlipped: originalDeck[idx].isFlipped
        }))
      );
      setIsLocked(false);
    }, 1500);
  };

  const handleShuffle = () => {
    if (shuffleUsed || isLocked || gameOver) return;
    setShuffleUsed(true);

    const unmatched = cards.filter(c => !c.isMatched);
    const shuffledUnmatched = [...unmatched].sort(() => Math.random() - 0.5);

    let idx = 0;
    const newDeck = cards.map(c => {
      if (c.isMatched) return c;
      return shuffledUnmatched[idx++];
    });

    setCards(newDeck);
    setBuddyText("Cards shuffled! 🌀 Let's find those matches!");
  };

  const handleCardClick = (cardId) => {
    if (isLocked) return;

    const clickedCard = cards.find(c => c.id === cardId);
    if (clickedCard.isFlipped || clickedCard.isMatched) return;

    // Play flip sound
    playFlip();

    const updatedDeck = cards.map(c =>
      c.id === cardId ? { ...c, isFlipped: true } : c
    );
    setCards(updatedDeck);

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setIsLocked(true);
      setMoves(prev => prev + 1);

      const firstCard = cards.find(c => c.id === newFlipped[0]);
      const secondCard = cards.find(c => c.id === newFlipped[1]);

      if (firstCard.icon === secondCard.icon) {
        // MATCH DETECTED!
        playCorrect();
        setTimeout(async () => {
          const matchedDeck = updatedDeck.map(c =>
            c.id === firstCard.id || c.id === secondCard.id
              ? { ...c, isFlipped: false, isMatched: true }
              : c
          );
          setCards(matchedDeck);

          const newMatched = [...matchedPairs, firstCard.icon];
          setMatchedPairs(newMatched);
          setFlippedCards([]);
          setIsLocked(false);

          // Update Combo
          const now = Date.now();
          const isCombo = lastMatchTime && (now - lastMatchTime <= 3000);
          const newCombo = isCombo ? combo + 1 : 1;
          setCombo(newCombo);
          setMaxCombo(prev => Math.max(prev, newCombo));
          setLastMatchTime(now);

          setBuddyState('happy');
          setBuddyText(`Awesome! You found a pair of ${firstCard.icon}! Keep going! 🎉`);

          if (newMatched.length === config.pairs) {
            // Calculated values to ensure accurate async capturing
            const finalTime = timeTaken;
            const finalMoves = moves + 1;
            const finalHints = hintsUsed;
            const finalMaxCombo = Math.max(maxCombo, newCombo);

            handleGameWin(finalTime, finalMoves, finalHints, finalMaxCombo);
          } else {
            setTimeout(() => setBuddyState('idle'), 2000);
          }
        }, 600);
      } else {
        // MISMATCH! Flip back over
        playWrong();
        setTimeout(() => {
          const resetDeck = updatedDeck.map(c =>
            c.id === firstCard.id || c.id === secondCard.id
              ? { ...c, isFlipped: false }
              : c
          );
          setCards(resetDeck);
          setFlippedCards([]);
          setIsLocked(false);
          setCombo(0); // Reset combo

          setBuddyState('sad');
          setBuddyText("Oh, those are different animals! Let's try again! 🧩");
          setTimeout(() => setBuddyState('idle'), 1500);
        }, 1200);
      }
    }
  };

  const handleGameWin = async (finalTime, finalMoves, finalHints, finalMaxCombo) => {
    // Play win fanfare sound!
    playWin();
    setGameOver(true);
    setScore(prev => prev + 1);
    setBuddyState('happy');

    // Calculate stars and points based on scoring utility
    const { stars, points } = calculateStars('memoryMatch', currentLevel, {
      moves: finalMoves,
      timeTaken: finalTime,
      hintsUsed: finalHints,
      combo: finalMaxCombo,
      firstTry: (gameStars[currentLevel] || 0) === 0
    });

    setEarnedStars(stars);
    setCalculatedPoints(points);

    // Save level specific star ratings locally
    const storageKey = `curiokids_stars_memoryMatch_${childProfile?.uid || 'guest'}`;
    const updatedStars = { ...gameStars, [currentLevel]: Math.max(gameStars[currentLevel] || 0, stars) };
    setGameStars(updatedStars);
    localStorage.setItem(storageKey, JSON.stringify(updatedStars));

    // Award overall stars to profile
    const previousStars = gameStars[currentLevel] || 0;
    const newStarsGained = Math.max(0, stars - previousStars);
    if (newStarsGained > 0) {
      await awardStars(newStarsGained, 'memory-match');
    }

    // General achievements
    await incrementStat('memoryMatchPuzzles');
    await incrementMission(1);
    await logInteractionTelemetry(true, finalMoves);

    // Write standardized session log for Parent Dashboard
    const uid = currentUser?.uid || 'guest';
    const sessionData = {
      gameType: 'memoryMatch',
      level: currentLevel,
      starsEarned: stars,
      pointsEarned: points,
      accuracy: 100, // Memory match requires finding all matches
      timeTaken: finalTime,
      moves: finalMoves,
      timestamp: new Date().toISOString()
    };

    if (isValidConfig && db && currentUser) {
      try {
        await addDoc(collection(db, 'children', uid, 'sessions'), sessionData);
      } catch (err) {
        console.error("Firestore session logging failed:", err);
      }
    } else {
      // Offline local session tracking for mock dashboard
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

  return (
    <div className="space-y-6">
      {gamePhase === 'menu' && (
        <LevelSelect
          gameType="memoryMatch"
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
            gameName="memoryMatch"
            level={currentLevel}
            levelName={config.name}
            stars={gameStars[currentLevel] || 0}
            totalStars={Object.values(gameStars).reduce((s, a) => s + a, 0)}
            timer={config.timeLimit ? { current: timerSeconds, max: config.timeLimit } : null}
            onPause={() => setBuddyText("Take a breath! Click cards when you are ready. 🧘")}
            onQuit={onBack}
          />

          <AIBuddy
            skin={childProfile?.companion || 'sparky'}
            state={buddyState}
            text={buddyText}
          />

          {/* Main Board view */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Memory Grid */}
            <div className="lg:col-span-2 bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg min-h-[380px] flex flex-col justify-center items-center select-none">
              
              {/* Power-ups Panel */}
              <div className="flex gap-3 justify-center mb-6 w-full">
                <button
                  onClick={handleHint}
                  disabled={hintsUsed >= (config.hints || 0) || isLocked}
                  className={`px-4 py-2 rounded-2xl font-bold border-2 transition active:scale-95 flex items-center gap-1.5 text-xs select-none ${
                    hintsUsed >= (config.hints || 0)
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 cursor-pointer shadow-sm'
                  }`}
                >
                  🔍 Hint ({ (config.hints || 0) - hintsUsed } left)
                </button>

                <button
                  onClick={handleShuffle}
                  disabled={shuffleUsed || isLocked}
                  className={`px-4 py-2 rounded-2xl font-bold border-2 transition active:scale-95 flex items-center gap-1.5 text-xs select-none ${
                    shuffleUsed
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700 cursor-pointer shadow-sm'
                  }`}
                >
                  🌀 Shuffle (1 use)
                </button>
              </div>

              {/* Combo Banner */}
              {combo > 1 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-4 bg-amber-400 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow-md animate-pulse"
                >
                  🔥 Combo x{combo}! 🔥
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={`game-grid-${currentLevel}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`grid ${gridStyles[config.grid || "3x4"]} gap-3 w-full max-w-lg`}
                >
                  {cards.map((card) => {
                    const showFront = card.isFlipped || card.isMatched;

                    return (
                      <motion.div
                        key={card.id}
                        onClick={() => handleCardClick(card.id)}
                        className="aspect-square relative cursor-pointer group"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {/* Bouncy 3D perspective flip card container */}
                        <div className={`w-full h-full rounded-2xl border-3 transition duration-300 transform-style-3d shadow-playful relative flex items-center justify-center text-3xl sm:text-4xl select-none ${
                          showFront
                            ? 'bg-curio-purple-light border-curio-slate transform rotate-y-180 shadow-none translate-y-0.5'
                            : 'bg-curio-orange text-white hover:bg-curio-orange-dark shadow-playful-orange border-curio-orange-dark'
                        }`}>
                          {showFront ? (
                            <span>{card.icon}</span>
                          ) : (
                            <span className="font-black text-white text-2xl sm:text-3xl">?</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Stats sidebar */}
            <div className="space-y-6">
              {/* Dashboard stats */}
              <div className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg text-center space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Match Metrics</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border-2 border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase block">Moves Made</span>
                    <span className="text-3xl font-black text-curio-slate mt-1 block">{moves}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border-2 border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase block">Pairs Found</span>
                    <span className="text-3xl font-black text-curio-green mt-1 block">{matchedPairs.length} / {config.pairs || 6}</span>
                  </div>
                </div>

                <button
                  onClick={() => startNewGame()}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-curio-slate font-black py-3 px-4 rounded-2xl border-2 border-curio-slate shadow-playful transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-xs uppercase"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Level</span>
                </button>
              </div>

              {/* Cards found deck */}
              <div className="bg-white/70 backdrop-blur-md p-5 rounded-4xl border-3 border-white/60 shadow-lg space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  🎒 Animal Roster Matched
                </h4>

                {matchedPairs.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {matchedPairs.map((icon, i) => (
                      <span
                        key={i}
                        className="text-3xl p-2 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm"
                      >
                        {icon}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-bold italic text-center py-4">
                    No animal pairs matched yet...
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {gamePhase === 'complete' && (
        <GameComplete
          gameName="memoryMatch"
          level={currentLevel}
          starsEarned={earnedStars}
          points={calculatedPoints}
          stats={{
            moves,
            timeTaken,
            combo: maxCombo
          }}
          onReplay={() => startNewGame(currentLevel)}
          onNextLevel={handleNextLevel}
          onHome={() => setGamePhase('menu')}
        />
      )}
    </div>
  );
}
