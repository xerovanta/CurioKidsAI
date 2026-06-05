import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Star, ChevronRight, Award } from 'lucide-react';
import { LEVELS } from '../../utils/levelSystem.js';

const gradients = {
  memoryMatch: 'from-indigo-400 to-blue-500',
  wordRepeat: 'from-purple-400 to-pink-500',
  airDraw: 'from-teal-400 to-emerald-500',
  alphabetGrab: 'from-amber-400 to-orange-500',
  default: 'from-sky-400 to-indigo-500'
};

const gameIcons = {
  memoryMatch: '🧩',
  wordRepeat: '🗣️',
  airDraw: '🎨',
  alphabetGrab: '🍎'
};

export default function LevelSelect({
  gameType = 'memoryMatch',
  currentLevel = 1,
  onSelectLevel,
  gameStars = {} // { 1: 3, 2: 2, 3: 0, ... }
}) {
  const levels = LEVELS[gameType] || {};
  const gradientClass = gradients[gameType] || gradients.default;
  const gameEmoji = gameIcons[gameType] || '🎮';

  // Calculate the total stars currently earned by the player in this game
  const totalEarnedStars = Object.values(gameStars || {}).reduce((sum, stars) => sum + (stars || 0), 0);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 select-none">
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 10 }}
          className="inline-block p-4 bg-white rounded-full shadow-lg border border-slate-100 mb-3"
        >
          <span className="text-4xl" role="img" aria-label="Game Icon">
            {gameEmoji}
          </span>
        </motion.div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          Select a Level
        </h1>
        <p className="text-slate-500 text-sm font-medium mt-1">
          Collect stars to unlock harder challenges!
        </p>

        {/* Total stars status */}
        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-black text-sm px-4 py-1.5 rounded-full shadow-md mt-4">
          <Star className="w-4 h-4 fill-current stroke-amber-500" />
          <span>{totalEarnedStars} Star{totalEarnedStars !== 1 ? 's' : ''} Earned</span>
        </div>
      </div>

      {/* Grid of levels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {Object.entries(levels).map(([lvlNum, config]) => {
          const levelNum = parseInt(lvlNum, 10);
          const starsToUnlock = config.starsToUnlock || 0;
          const isUnlocked = totalEarnedStars >= starsToUnlock;
          const starsEarned = gameStars[levelNum] || 0;
          const isActive = currentLevel === levelNum;

          return (
            <motion.div
              key={levelNum}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (levelNum - 1) * 0.1 }}
              whileHover={isUnlocked ? { scale: 1.03, y: -2 } : {}}
              whileTap={isUnlocked ? { scale: 0.98 } : {}}
              onClick={() => isUnlocked && onSelectLevel(levelNum)}
              className={`relative rounded-3xl p-6 border transition-all ${
                isUnlocked
                  ? 'bg-white hover:shadow-xl border-slate-100 cursor-pointer shadow-md'
                  : 'bg-slate-50/80 border-slate-200 cursor-not-allowed shadow-none'
              }`}
            >
              {/* Top Banner (Level number / status) */}
              <div className="flex items-center justify-between mb-4">
                <span className={`text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                  isUnlocked
                    ? `bg-gradient-to-r ${gradientClass} text-white`
                    : 'bg-slate-200 text-slate-400'
                }`}>
                  Level {levelNum}
                </span>

                {!isUnlocked && (
                  <div className="flex items-center gap-1 bg-rose-50 text-rose-500 border border-rose-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    <Lock className="w-3 h-3" />
                    <span>Locked</span>
                  </div>
                )}
                {isUnlocked && starsEarned === 3 && (
                  <Award className="w-5 h-5 text-amber-500 fill-amber-100" />
                )}
              </div>

              {/* Title / details */}
              <h3 className={`text-xl font-extrabold ${
                isUnlocked ? 'text-slate-800' : 'text-slate-400'
              }`}>
                {config.name}
              </h3>

              {/* Content description based on type */}
              <p className="text-slate-400 text-xs font-semibold mt-1 mb-6">
                {gameType === 'memoryMatch' && `Pairs: ${config.pairs} • Grid: ${config.grid}`}
                {gameType === 'wordRepeat' && `Accuracy: ${config.accuracyThreshold}% • words`}
                {gameType === 'airDraw' && `Shapes: ${config.shapes.join(', ')}`}
                {gameType === 'alphabetGrab' && `Speed: ${config.speed}`}
              </p>

              {/* Footer (stars earned / unlock status) */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between mt-auto">
                {isUnlocked ? (
                  /* Earned Stars representation */
                  <div className="flex gap-1">
                    {[1, 2, 3].map((starIdx) => (
                      <Star
                        key={starIdx}
                        className={`w-5 h-5 ${
                          starsEarned >= starIdx
                            ? 'fill-amber-400 text-amber-500'
                            : 'text-slate-200 fill-transparent'
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  /* Lock Info */
                  <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                    <span>Requires {starsToUnlock} ⭐</span>
                  </div>
                )}

                {isUnlocked && (
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
