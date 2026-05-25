import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Camera, AlertCircle, Sparkles, Check, Flame, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCamera } from '../hooks/useCamera';
import MemoryMatch from '../games/MemoryMatch';
import AirDraw from '../games/AirDraw';
import AlphabetGrab from '../games/AlphabetGrab';
import WordRepeat from '../games/WordRepeat';

export default function LearningRoom() {
  const { currentUser, loginAnonymously, childProfile } = useAuth();
  const [selectedGame, setSelectedGame] = useState(null);
  const [initializingAuth, setInitializingAuth] = useState(false);
  
  // Camera Onboarding Check states
  const [showGames, setShowGames] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const lobbyVideoRef = useRef(null);
  
  const { startCamera, stopCamera, stream, error: camErr, hasPermission } = useCamera();

  // 1. Read game query parameters for instant launch bypass
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameParam = params.get('game');
    const validGames = ['memory-match', 'air-draw', 'alphabet-grab', 'word-repeat'];
    if (gameParam && validGames.includes(gameParam)) {
      setSelectedGame(gameParam);
      setShowGames(true);
    }
  }, []);

  // 2. Auto-login child anonymously on mount
  useEffect(() => {
    async function triggerAutoLogin() {
      if (!currentUser) {
        setInitializingAuth(true);
        try {
          await loginAnonymously();
        } catch (err) {
          console.error("Anonymous onboarding failed:", err);
        } finally {
          setInitializingAuth(false);
        }
      }
    }
    triggerAutoLogin();
  }, [currentUser]);

  // 3. Start lobby camera to verify hardware works before entering games
  useEffect(() => {
    if (currentUser && !initializingAuth && !showGames && lobbyVideoRef.current) {
      setCameraLoading(true);
      startCamera(lobbyVideoRef.current)
        .catch(err => console.warn("Lobby camera activation exception:", err));
    }

    return () => {
      // Release camera hardware lock so child-games can request it without conflicts
      stopCamera();
    };
  }, [currentUser, initializingAuth, showGames, startCamera]);

  // Sync camera loading state when stream or errors occur
  useEffect(() => {
    if (stream || camErr) {
      setCameraLoading(false);
    }
  }, [stream, camErr]);

  const handleStartLearning = () => {
    stopCamera(); // Free device hardware lock
    setShowGames(true);
  };

  const games = [
    { 
      id: 'memory-match', 
      title: 'Memory Match', 
      desc: 'Flip and match adorable cartoon animal pairs! Purely digital, no camera needed.', 
      emoji: '🧩', 
      color: 'border-curio-orange shadow-playful-orange text-curio-orange',
      bg: 'bg-curio-orange-light',
      difficulty: 'Medium' 
    },
    { 
      id: 'air-draw', 
      title: 'AirDraw Adventure', 
      desc: 'Pinch and draw shapes in the air with your finger using smart hand tracking!', 
      emoji: '✨', 
      color: 'border-curio-pink shadow-playful-pink text-curio-pink',
      bg: 'bg-curio-pink-light',
      difficulty: 'Hard' 
    },
    { 
      id: 'alphabet-grab', 
      title: 'Alphabet Grab', 
      desc: 'Pinch and grab floating balloon letters in the air, then drop them in the monster\'s mouth!', 
      emoji: '🎈', 
      color: 'border-curio-blue shadow-playful-blue text-curio-blue',
      bg: 'bg-curio-blue-light',
      difficulty: 'Medium' 
    },
    { 
      id: 'word-repeat', 
      title: 'Word Repeat', 
      desc: 'Listen to your buddy speak a word and repeat it clearly into your mic!', 
      emoji: '🗣️', 
      color: 'border-curio-purple shadow-playful-purple text-curio-purple',
      bg: 'bg-curio-purple-light',
      difficulty: 'Easy' 
    },
  ];

  // While logging in anonymously
  if (initializingAuth || (!currentUser && !childProfile)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-curio-purple rounded-full animate-spin" />
        <h3 className="text-xl font-black text-curio-slate">Opening the Playroom...</h3>
        <p className="text-slate-400 font-bold text-xs">Getting your AI companion ready for adventure!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      
      {/* Lobby Title */}
      {!selectedGame && (
        <section className="text-center max-w-xl mx-auto space-y-1">
          <span className="text-4xl animate-wiggle inline-block">🚀</span>
          <h2 className="text-2xl sm:text-3xl font-black text-glow-purple tracking-tight">
            AI Learning Playroom
          </h2>
          <p className="text-slate-500 font-bold text-xs sm:text-sm">
            Explore magical interactive voice, canvas, and gesture tracking games!
          </p>
        </section>
      )}

      {/* Interface coordination */}
      <AnimatePresence mode="wait">
        
        {/* STEP A: CAMERA CALIBRATION ONBOARDING GATE */}
        {!showGames && !selectedGame ? (
          <motion.div 
            key="onboarding-gate"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="max-w-md mx-auto bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg flex flex-col items-center text-center space-y-6"
          >
            <div className="space-y-1.5">
              <span className="text-4xl animate-float inline-block">👋🎥</span>
              <h3 className="text-xl font-black text-curio-slate">Buddy Camera Setup</h3>
              <p className="text-xs font-bold text-slate-500 max-w-xs leading-normal">
                Let's make sure your camera is active so your companion pet can see your awesome drawing gestures!
              </p>
            </div>

            {/* Video Viewport Frame: Styled like a cute Toy TV */}
            <div className="relative w-full aspect-video rounded-3xl border-6 border-curio-slate bg-slate-950 overflow-hidden flex items-center justify-center shadow-lg">
              
              <video
                ref={lobbyVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* Loading State Spinner */}
              {cameraLoading && !camErr && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 text-white">
                  <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="text-xs font-black text-slate-300">Waking up camera...</span>
                </div>
              )}

              {/* Error Recovery */}
              {camErr && (
                <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center space-y-3 text-white">
                  <AlertCircle className="w-8 h-8 text-curio-orange animate-bounce" />
                  <div>
                    <h4 className="font-extrabold text-xs">Camera Offline</h4>
                    <p className="text-[10px] text-slate-400 max-w-[240px] leading-tight mt-0.5 mx-auto">
                      {camErr}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowGames(true)}
                    className="bg-curio-yellow hover:bg-curio-yellow-dark text-curio-slate-dark px-4 py-2 rounded-2xl text-[10px] font-black uppercase border-2 border-curio-slate shadow-playful cursor-pointer transition active:scale-95"
                  >
                    Play in Sandbox Mode 🎮
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col items-center gap-3 pt-1">
              {stream ? (
                <motion.button
                  onClick={handleStartLearning}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full bg-curio-green hover:bg-curio-green-dark text-white font-black py-4 px-6 rounded-2xl border-4 border-curio-slate shadow-playful-green text-center flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider text-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Start Playroom! 🚀</span>
                </motion.button>
              ) : (
                <button
                  disabled
                  className="w-full bg-slate-100 text-slate-400 font-extrabold py-4 px-6 rounded-2xl border-2 border-slate-200 text-center opacity-60 text-xs uppercase"
                >
                  Waiting for camera...
                </button>
              )}

              <button
                onClick={() => setShowGames(true)}
                className="text-xs font-black text-slate-400 hover:text-curio-slate hover:underline cursor-pointer"
              >
                Skip Setup & Browse Sandbox Games
              </button>
            </div>
          </motion.div>
        ) : !selectedGame ? (
          /* STEP B: MAGICAL CENTERED 2X2 GRID card SELECTION LOBBY */
          <motion.div 
            key="game-lobby-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto justify-center"
          >
            {games.map((game, idx) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05, type: 'spring', stiffness: 120 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedGame(game.id)}
                className={`bg-white p-6 rounded-4xl border-3 border-white/60 flex flex-col justify-between items-start cursor-pointer transition shadow-lg hover:shadow-xl relative overflow-hidden`}
              >
                <div className="space-y-4 w-full z-10">
                  <div className="flex justify-between items-center w-full">
                    <div className="text-4xl p-2.5 bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-center justify-center shadow">
                      {game.emoji}
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-curio-slate ${
                      game.difficulty === 'Easy' ? 'bg-curio-green text-white' : (game.difficulty === 'Medium' ? 'bg-curio-yellow text-curio-slate' : 'bg-curio-pink text-white')
                    }`}>
                      {game.difficulty}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-curio-slate">{game.title}</h3>
                    <p className="text-xs font-bold text-slate-400 leading-normal">
                      {game.desc}
                    </p>
                  </div>
                </div>

                <div className="w-full mt-6 pt-3 border-t border-slate-100 flex justify-end z-10">
                  <div className="bg-curio-slate text-white px-4 py-2 rounded-xl flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shadow-playful border border-curio-slate transform active:scale-95 transition">
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Launch Game</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : selectedGame === 'memory-match' ? (
          <motion.div
            key="active-memory-match"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full"
          >
            <MemoryMatch onBack={() => setSelectedGame(null)} />
          </motion.div>
        ) : selectedGame === 'air-draw' ? (
          <motion.div
            key="active-air-draw"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full"
          >
            <AirDraw onBack={() => setSelectedGame(null)} />
          </motion.div>
        ) : selectedGame === 'alphabet-grab' ? (
          <motion.div
            key="active-alphabet-grab"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full"
          >
            <AlphabetGrab onBack={() => setSelectedGame(null)} />
          </motion.div>
        ) : selectedGame === 'word-repeat' ? (
          <motion.div
            key="active-word-repeat"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full"
          >
            <WordRepeat onBack={() => setSelectedGame(null)} />
          </motion.div>
        ) : (
          <div className="text-center py-12 text-slate-400 font-bold">Game Loading...</div>
        )}
      </AnimatePresence>

    </div>
  );
}
