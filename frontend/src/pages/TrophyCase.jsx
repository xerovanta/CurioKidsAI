import React from 'react';
import { motion } from 'framer-motion';
import { Award, Star, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Mascot from '../components/Mascot';

export default function TrophyCase() {
  const { childProfile } = useAuth();
  
  const profile = childProfile || {
    stars: 0,
    level: 1,
    badges: [],
    unlockedCompanions: ['sparky'],
    gamesStats: {
      memoryMatchPuzzles: 0,
      wordRepeatWords: 0,
      airDrawShapes: 0,
      alphabetGrabLetters: 0
    }
  };

  const badgeLibrary = [
    { id: 'word-wizard', title: 'Word Wizard', desc: 'Pronounce 50 correct words in Word Repeat!', icon: '🗣️', color: 'bg-curio-purple', stat: 'wordRepeatWords', target: 50 },
    { id: 'memory-master', title: 'Memory Master', desc: 'Complete 20 Memory Match puzzles!', icon: '🧩', color: 'bg-curio-orange', stat: 'memoryMatchPuzzles', target: 20 },
    { id: 'air-artist', title: 'Air Artist', desc: 'Draw 10 shapes in AirDraw Adventure!', icon: '🎨', color: 'bg-curio-pink', stat: 'airDrawShapes', target: 10 },
    { id: 'letter-champion', title: 'Letter Champion', desc: 'Grab 30 correct letters in Alphabet Grab!', icon: '🎈', color: 'bg-curio-blue', stat: 'alphabetGrabLetters', target: 30 },
    { id: 'level-2', title: 'Curio Cadet', desc: 'Reach Level 2!', icon: '🥈', color: 'bg-indigo-400' },
    { id: 'level-3', title: 'Rocky Friend', desc: 'Reach Level 3 & Unlock Rocky Dino!', icon: '🦖', color: 'bg-emerald-400' },
    { id: 'level-5', title: 'Ziggy Friend', desc: 'Reach Level 5 & Unlock Ziggy Alien!', icon: '👽', color: 'bg-fuchsia-400' },
  ];

  return (
    <div className="space-y-8 pb-12">
      
      {/* Page Header */}
      <section className="text-center max-w-2xl mx-auto space-y-1">
        <span className="text-5xl animate-float inline-block filter drop-shadow">🏆</span>
        <h2 className="text-2xl sm:text-3xl font-black text-glow-purple tracking-tight">
          My Star & Trophy Cabinet
        </h2>
        <p className="text-slate-500 font-bold text-xs sm:text-sm">
          Check out your awesome milestones and unlocked companion buddies!
        </p>
      </section>

      {/* Summary Score banner */}
      <div className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg max-w-md mx-auto flex items-center justify-around text-center select-none">
        <div>
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider block">Level</span>
          <span className="text-4xl font-black text-curio-purple block">{profile.level}</span>
        </div>
        <div className="w-1 h-10 bg-slate-200 rounded-full" />
        <div>
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider block">Total Stars</span>
          <span className="text-4xl font-black text-curio-yellow-dark flex items-center justify-center gap-0.5 leading-none">
            <Star className="w-6 h-6 fill-curio-yellow text-curio-yellow-dark" />
            {profile.stars}
          </span>
        </div>
        <div className="w-1 h-10 bg-slate-200 rounded-full" />
        <div>
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider block">Trophies</span>
          <span className="text-4xl font-black text-curio-pink block">{profile.badges.length}</span>
        </div>
      </div>

      {/* Trophies Grid */}
      <section className="space-y-6">
        <h3 className="text-xl font-black text-curio-slate flex items-center justify-center gap-2">
          <Award className="w-5 h-5 text-curio-pink" /> 
          Completed Achievements
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {badgeLibrary.map((badge, idx) => {
            const isUnlocked = profile.badges.includes(badge.id) || 
                              (badge.id === 'level-2' && profile.level >= 2) ||
                              (badge.id === 'level-3' && profile.level >= 3) ||
                              (badge.id === 'level-5' && profile.level >= 5);
            
            // Calculate progress for specific statistics
            const currentStatVal = badge.stat && profile.gamesStats ? (profile.gamesStats[badge.stat] || 0) : 0;
            const progressPercent = badge.target ? Math.min(100, Math.round((currentStatVal / badge.target) * 100)) : 0;

            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-5 rounded-4xl border-3 text-center flex flex-col items-center justify-between relative overflow-hidden transition ${
                  isUnlocked 
                    ? 'bg-white border-white/60 shadow-lg hover:-translate-y-1' 
                    : 'bg-white/40 border-transparent opacity-65 select-none'
                }`}
              >
                {/* Lock or unlock check overlay */}
                <div className="absolute top-3.5 right-3.5">
                  {isUnlocked ? (
                    <CheckCircle2 className="w-4 h-4 text-curio-green fill-curio-green/10" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-300" />
                  )}
                </div>

                {/* Circular Glassmorphism Medal */}
                <div className={`w-16 h-16 rounded-full border-3 flex items-center justify-center text-3xl shadow-md mb-4 ${
                  isUnlocked ? `${badge.color} border-white` : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  {badge.icon}
                </div>

                <div className="space-y-1 flex-grow w-full">
                  <h4 className={`font-black text-sm text-curio-slate ${!isUnlocked && 'text-slate-400'}`}>
                    {badge.title}
                  </h4>
                  <p className="text-slate-400 text-[10px] font-bold px-2 leading-snug">
                    {badge.desc}
                  </p>
                </div>

                {/* Progress bar overlay for locked badges */}
                {badge.target && !isUnlocked && (
                  <div className="w-full mt-3 space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-black text-slate-400">
                      <span>Progress</span>
                      <span>{currentStatVal} / {badge.target}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden p-0.5">
                      <div className="h-full bg-curio-purple rounded-full" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                )}

                {/* Unlocked check label */}
                <div className="w-full mt-4 pt-3 border-t border-slate-100/50">
                  {isUnlocked ? (
                    <span className="text-[10px] font-black text-curio-green uppercase tracking-wider">
                      🎖️ Unlocked!
                    </span>
                  ) : (
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      🔒 Locked
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Companion unlocks display */}
      <section className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg space-y-4 max-w-3xl mx-auto">
        <h3 className="text-xl font-black text-curio-slate text-center flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-curio-purple" /> 
          My Unlocked Companions
        </h3>
        
        <div className="flex flex-col sm:flex-row items-center justify-around gap-6 select-none">
          <div className="flex flex-col items-center p-3 text-center">
            <Mascot skin="sparky" state="idle" className="w-20 h-20 drop-shadow" />
            <span className="font-black text-xs text-curio-slate mt-1.5">Sparky Fox</span>
            <span className="text-[10px] text-curio-green font-black uppercase mt-0.5">Active Buddy</span>
          </div>

          <div className={`flex flex-col items-center p-3 text-center transition ${profile.level < 3 ? 'opacity-35' : ''}`}>
            <Mascot skin="rocky" state="idle" className="w-20 h-20 drop-shadow" />
            <span className="font-black text-xs text-curio-slate mt-1.5">Rocky Dino</span>
            <span className={`text-[10px] font-black uppercase mt-0.5 ${profile.level >= 3 ? 'text-curio-blue' : 'text-slate-400'}`}>
              {profile.level >= 3 ? '🎉 Unlocked!' : 'Level 3 Reward'}
            </span>
          </div>

          <div className={`flex flex-col items-center p-3 text-center transition ${profile.level < 5 ? 'opacity-35' : ''}`}>
            <Mascot skin="ziggy" state="idle" className="w-20 h-20 drop-shadow" />
            <span className="font-black text-xs text-curio-slate mt-1.5">Ziggy Alien</span>
            <span className={`text-[10px] font-black uppercase mt-0.5 ${profile.level >= 5 ? 'text-curio-pink' : 'text-slate-400'}`}>
              {profile.level >= 5 ? '🎉 Unlocked!' : 'Level 5 Reward'}
            </span>
          </div>
        </div>
      </section>

    </div>
  );
}
