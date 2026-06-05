import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, LogOut, Star } from 'lucide-react';

const gameEmojis = {
  memoryMatch: '🧠',
  wordRepeat: '🗣️',
  airDraw: '🎨',
  alphabetGrab: '🔤',
};

const gameTitles = {
  memoryMatch: 'Memory Match',
  wordRepeat: 'Word Repeat',
  airDraw: 'Air Draw',
  alphabetGrab: 'Alphabet Grab',
};

export default function GameHeader({
  gameName = 'Game',
  level = 1,
  levelName = '',
  stars = 0,
  totalStars = 0,
  timer = null, // { current: number, max: number }
  onPause,
  onQuit
}) {
  const emoji = gameEmojis[gameName] || '🎮';
  const title = gameTitles[gameName] || gameName;

  // Star animation check
  const [prevStars, setPrevStars] = useState(stars);
  const [animateStar, setAnimateStar] = useState(false);

  useEffect(() => {
    if (stars !== prevStars) {
      setAnimateStar(true);
      const timer = setTimeout(() => setAnimateStar(false), 600);
      setPrevStars(stars);
      return () => clearTimeout(timer);
    }
  }, [stars, prevStars]);

  // Timer configuration
  const hasTimer = timer && typeof timer.current === 'number' && typeof timer.max === 'number';
  const timerPercentage = hasTimer ? (timer.current / timer.max) * 100 : 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timerPercentage / 100) * circumference;

  return (
    <header className="w-full max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Left side: Game Info Badge */}
      <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-sky-100 shadow-md">
        <span className="text-2xl" role="img" aria-label={title}>
          {emoji}
        </span>
        <div>
          <h2 className="font-bold text-slate-800 text-sm md:text-base leading-none">
            {title}
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-extrabold text-[10px] uppercase rounded-full shadow-sm">
              Lvl {level}/5
            </span>
            {levelName && (
              <span className="text-xs font-semibold text-slate-500 truncate max-w-[120px] md:max-w-none">
                {levelName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Live Timer */}
      {hasTimer && (
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-sky-100 shadow-md">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background Track */}
              <circle
                cx="20"
                cy="20"
                r={radius}
                className="stroke-slate-100 fill-transparent"
                strokeWidth="3.5"
              />
              {/* Active Indicator */}
              <motion.circle
                cx="20"
                cy="20"
                r={radius}
                className={`fill-transparent ${
                  timer.current <= 10 ? 'stroke-rose-500' : 'stroke-sky-500'
                }`}
                strokeWidth="3.5"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </svg>
            <span className={`absolute text-xs font-black ${
              timer.current <= 10 ? 'text-rose-600 animate-pulse' : 'text-slate-700'
            }`}>
              {timer.current}s
            </span>
          </div>
          <span className="text-xs font-bold text-slate-500 hidden md:inline">Time Remaining</span>
        </div>
      )}

      {/* Right side: Stars + Controls */}
      <div className="flex items-center gap-3">
        {/* Star Counter */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200/60 px-4 py-2 rounded-full shadow-md">
          <motion.div
            animate={animateStar ? { scale: [1, 1.4, 0.9, 1.1, 1], rotate: [0, 15, -15, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            <Star className="w-6 h-6 fill-amber-400 stroke-amber-500 drop-shadow-sm" />
          </motion.div>
          <div className="flex flex-col items-start leading-none">
            <span className="text-amber-700 font-black text-base">
              {stars}
            </span>
            {totalStars > 0 && (
              <span className="text-[10px] text-amber-600/70 font-semibold mt-0.5">
                Total: {totalStars}
              </span>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-1.5">
          {onPause && (
            <button
              onClick={onPause}
              className="p-2.5 bg-white/95 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-full border border-slate-200 shadow-sm transition-all hover:scale-105 active:scale-95"
              title="Pause Game"
            >
              <Pause className="w-4 h-4 fill-current stroke-current" />
            </button>
          )}
          {onQuit && (
            <button
              onClick={onQuit}
              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 rounded-full border border-rose-100 shadow-sm transition-all hover:scale-105 active:scale-95"
              title="Quit Game"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
