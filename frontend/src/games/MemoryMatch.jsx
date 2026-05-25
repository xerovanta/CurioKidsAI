import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Award, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import AIBuddy from '../components/AIBuddy';
import { doc, collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';

export default function MemoryMatch({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission, incrementStat } = useAuth();

  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);

  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [moves, setMoves] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const cardIcons = ['🦁', '🦒', '🦓', '🐘', '🐨', '🐼'];

  // Initialize Card Deck
  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = () => {
    // Duplicate icons to form 6 matching pairs (12 cards total)
    const deck = [...cardIcons, ...cardIcons]
      .map((icon, index) => ({
        id: index,
        icon,
        isFlipped: false,
        isMatched: false
      }))
      // Simple random shuffle
      .sort(() => Math.random() - 0.5);

    setCards(deck);
    setFlippedCards([]);
    setMatchedPairs([]);
    setMoves(0);
    setIsLocked(false);
    setGameOver(false);

    setBuddyText("Let's play Memory Match! 🧩 Tap the cards to find matching animal pairs!");
    setBuddyState('idle');
  };

  const logInteractionTelemetry = async (success, moveCount) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'memory-match',
      success,
      target: '6 matches',
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

  const handleCardClick = (cardId) => {
    if (isLocked) return;

    // Ignore already flipped or matched cards
    const clickedCard = cards.find(c => c.id === cardId);
    if (clickedCard.isFlipped || clickedCard.isMatched) return;

    // Flip the clicked card
    const updatedDeck = cards.map(c =>
      c.id === cardId ? { ...c, isFlipped: true } : c
    );
    setCards(updatedDeck);

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);

    // If this is the second card selected, check for a match!
    if (newFlipped.length === 2) {
      setIsLocked(true);
      setMoves(prev => prev + 1);

      const firstCard = cards.find(c => c.id === newFlipped[0]);
      const secondCard = cards.find(c => c.id === newFlipped[1]);

      if (firstCard.icon === secondCard.icon) {
        // MATCH DETECTED!
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

          setBuddyState('happy');
          setBuddyText(`Awesome! You found a pair of ${firstCard.icon}! Keep going! 🎉`);

          // Award +1 star per matched pair!
          await awardStars(1, 'memory-match');

          // Check if all pairs are matched (6 pairs total)
          if (newMatched.length === 6) {
            handleGameWin();
          } else {
            setTimeout(() => setBuddyState('idle'), 2000);
          }
        }, 600);
      } else {
        // MISMATCH! Flip back over after 1.2s
        setTimeout(() => {
          const resetDeck = updatedDeck.map(c =>
            c.id === firstCard.id || c.id === secondCard.id
              ? { ...c, isFlipped: false }
              : c
          );
          setCards(resetDeck);
          setFlippedCards([]);
          setIsLocked(false);
          setBuddyState('sad');
          setBuddyText("Oh, those are different animals! Let's try again! 🧩");
          setTimeout(() => setBuddyState('idle'), 1500);
        }, 1200);
      }
    }
  };

  const handleGameWin = async () => {
    setGameOver(true);
    setScore(prev => prev + 1);
    setBuddyState('happy');
    setBuddyText(`Hooray! You matched all pairs in ${moves + 1} moves! You are a Memory Champion! 🏆`);

    confetti({
      particleCount: 100,
      spread: 75,
      origin: { y: 0.6 }
    });

    // Award +3 bonus for completing puzzle!
    await awardStars(3, 'memory-match');
    await incrementStat('memoryMatchPuzzles');
    await incrementMission(1); // updates mission profile

    await logInteractionTelemetry(true, moves + 1);
  };

  return (
    <div className="space-y-6">

      {/* Game Header */}
      <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-4 rounded-3xl border-3 border-white/60 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🧩</span>
          <div>
            <h3 className="text-base font-black text-curio-slate">Memory Match</h3>
            <p className="text-[10px] font-bold text-slate-400">Match cartoon animal pairs!</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-curio-orange text-white px-3.5 py-1 rounded-full text-xs font-black border-2 border-curio-orange shadow flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-white" />
            <span>Cleared: {score}</span>
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

      {/* Main Board view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Memory Grid */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg min-h-[350px] flex flex-col justify-center items-center select-none">

          <AnimatePresence mode="wait">
            {gameOver ? (
              /* Success screen */
              <motion.div
                key="win-screen"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="text-center space-y-6 py-8"
              >
                <div className="text-7xl block animate-bounce-slow">🏆</div>
                <h4 className="font-black text-2xl text-curio-slate uppercase tracking-wider">Match Master!</h4>
                <p className="text-slate-500 font-bold max-w-xs mx-auto text-sm">
                  Excellent work! You matched all animal pairs in **{moves}** moves!
                </p>

                <div className="flex gap-4 justify-center">
                  <button
                    onClick={startNewGame}
                    className="bg-curio-green hover:bg-curio-green-dark text-white font-black py-3 px-6 rounded-2xl border-3 border-curio-green-dark shadow-playful-green transition active:scale-95 cursor-pointer flex items-center gap-2 uppercase tracking-wide text-xs"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Play Again</span>
                  </button>
                  <button
                    onClick={onBack}
                    className="bg-slate-100 hover:bg-slate-200 border-2 border-curio-slate text-curio-slate font-black py-3 px-6 rounded-2xl transition active:scale-95 cursor-pointer uppercase text-xs shadow"
                  >
                    Lobby ◀
                  </button>
                </div>
              </motion.div>
            ) : (
              /* Grid of 12 Cards */
              <motion.div
                key="game-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-3 sm:grid-cols-4 gap-4 max-w-md w-full"
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
                      <div className={`w-full h-full rounded-2xl border-3 border-curio-slate transition duration-300 transform-style-3d shadow-playful relative flex items-center justify-center text-4xl select-none ${showFront
                        ? 'bg-curio-purple-light border-curio-slate transform rotate-y-180 shadow-none translate-y-0.5'
                        : 'bg-curio-orange text-white hover:bg-curio-orange-dark shadow-playful-orange border-curio-orange-dark'
                        }`}>
                        {showFront ? (
                          <span>{card.icon}</span>
                        ) : (
                          <span className="font-black text-white text-3xl">?</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
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
                <span className="text-3xl font-black text-curio-green mt-1 block">{matchedPairs.length} / 6</span>
              </div>
            </div>

            <button
              onClick={startNewGame}
              className="w-full bg-slate-100 hover:bg-slate-200 text-curio-slate font-black py-3 px-4 rounded-2xl border-2 border-curio-slate shadow-playful transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-xs uppercase"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Game</span>
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

    </div>
  );
}
