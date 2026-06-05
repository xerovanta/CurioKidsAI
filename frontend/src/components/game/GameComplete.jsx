import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Star, RotateCcw, ArrowRight, Home, Award, Zap, Timer, CheckCircle } from 'lucide-react';

const headings = {
  3: '🏆 Super Star! 🏆',
  2: '🌟 Amazing Job! 🌟',
  1: '👍 Well Done! 👍',
  0: '💪 Good Try! 💪'
};

const subheadings = {
  3: 'Wow! You played perfectly!',
  2: 'So close to absolute perfection!',
  1: 'Great effort, keep practicing!',
  0: 'You got this, let\'s try again!'
};

export default function GameComplete({
  gameName = 'Game',
  level = 1,
  starsEarned = 0,
  points = 0,
  stats = {}, // { moves, timeTaken, accuracy, combo, ... }
  onReplay,
  onNextLevel,
  onHome
}) {
  const [displayedPoints, setDisplayedPoints] = useState(0);

  // Trigger celebration confetti
  useEffect(() => {
    if (starsEarned >= 2) {
      // Big confetti burst
      const duration = 2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    } else if (starsEarned === 1) {
      // Small celebratory burst
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
  }, [starsEarned]);

  // Points counter rollup effect
  useEffect(() => {
    let start = 0;
    const end = points;
    if (end === 0) return;
    
    const duration = 1200; // ms
    const incrementTime = Math.max(Math.floor(duration / end), 15);
    
    const timer = setInterval(() => {
      start += Math.ceil(end / 40);
      if (start >= end) {
        clearInterval(timer);
        setDisplayedPoints(end);
      } else {
        setDisplayedPoints(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [points]);

  // Define stat configurations dynamically
  const statItems = [
    stats.timeTaken !== undefined && {
      label: 'Time',
      value: `${stats.timeTaken}s`,
      icon: <Timer className="w-5 h-5 text-indigo-500" />,
      bg: 'bg-indigo-50 border-indigo-100'
    },
    stats.accuracy !== undefined && {
      label: 'Accuracy',
      value: `${stats.accuracy}%`,
      icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      bg: 'bg-emerald-50 border-emerald-100'
    },
    stats.combo !== undefined && stats.combo > 0 && {
      label: 'Max Combo',
      value: `${stats.combo}x`,
      icon: <Zap className="w-5 h-5 text-amber-500 animate-pulse" />,
      bg: 'bg-amber-50 border-amber-100'
    },
    stats.moves !== undefined && stats.moves > 0 && {
      label: 'Moves',
      value: stats.moves,
      icon: <Award className="w-5 h-5 text-purple-500" />,
      bg: 'bg-purple-50 border-purple-100'
    }
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
      >
        {/* Banner with header details */}
        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 text-center text-white relative">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              Level {level} Complete
            </span>
          </motion.div>
          
          <motion.h1
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="text-3xl font-black mt-3 leading-none drop-shadow-md"
          >
            {headings[starsEarned]}
          </motion.h1>
          <p className="text-white/80 text-sm mt-1.5 font-medium">
            {subheadings[starsEarned]}
          </p>

          {/* Three Stars Animation */}
          <div className="flex justify-center gap-4 mt-6">
            {[1, 2, 3].map((starIdx) => {
              const isEarned = starsEarned >= starIdx;
              return (
                <motion.div
                  key={starIdx}
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 15,
                    delay: 0.3 + starIdx * 0.15
                  }}
                  className="relative"
                >
                  <Star
                    className={`w-14 h-14 ${
                      isEarned
                        ? 'fill-amber-400 stroke-amber-500 filter drop-shadow-[0_4px_6px_rgba(245,158,11,0.5)]'
                        : 'text-white/30 stroke-white/40'
                    }`}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Scoring and Stats Breakdown */}
        <div className="p-8 text-center">
          {/* Points Display */}
          <div className="mb-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Total Points Earned
            </span>
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 leading-none mt-1">
              {displayedPoints.toLocaleString()}
            </div>
          </div>

          {/* Stats Grid */}
          {statItems.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {statItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col items-center p-3 rounded-2xl border ${item.bg}`}
                >
                  {item.icon}
                  <span className="text-lg font-black text-slate-700 mt-1 leading-none">
                    {item.value}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-2.5">
            {onNextLevel && (
              <button
                onClick={onNextLevel}
                disabled={starsEarned === 0}
                className={`w-full py-4 px-6 rounded-2xl font-black text-white shadow-lg flex items-center justify-center gap-2 transition-all leading-none ${
                  starsEarned > 0
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-slate-300 shadow-none cursor-not-allowed opacity-60'
                }`}
              >
                <span>Play Next Level</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onReplay}
                className="py-3.5 px-6 rounded-2xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] leading-none"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
              <button
                onClick={onHome}
                className="py-3.5 px-6 rounded-2xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] leading-none"
              >
                <Home className="w-4 h-4" />
                <span>Go Home</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
