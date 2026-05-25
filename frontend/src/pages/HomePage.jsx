import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Star, Trophy, Gamepad2, Award, Sparkles, ChevronRight, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Mascot from '../components/Mascot';

export default function HomePage() {
  const navigate = useNavigate();
  const { childProfile, updateCustomization } = useAuth();
  const [mascotState, setMascotState] = useState('idle');

  // Fallback default profile if not loaded
  const profile = childProfile || {
    level: 1,
    stars: 0,
    streak: 1,
    avatar: '🦊',
    companion: 'sparky',
    unlockedCompanions: ['sparky'],
    dailyMissions: [
      { id: 1, text: 'Complete a Memory Match puzzle', game: 'memory-match', target: 1, current: 0, completed: false, starsReward: 5 },
      { id: 2, text: 'Earn 10 stars today', target: 10, current: 0, completed: false, starsReward: 10 },
    ],
    gamesStars: {
      'memory-match': 0,
      'word-repeat': 0,
      'air-draw': 0,
      'alphabet-grab': 0
    }
  };

  const avatars = ['🦊', '🐻', '🐸', '🦄', '🦖', '🦁', '🦉', '🐱'];
  const categories = [
    { label: 'All Games', emoji: '🎮', active: true },
    { label: 'Logic', emoji: '🐻' },
    { label: 'Creativity', emoji: '🎨' },
    { label: 'Animals', emoji: '🦖' },
    { label: 'Letters', emoji: '🔤' }
  ];

  // Exactly four active games
  const directGamesList = [
    { 
      id: 'memory-match', 
      title: 'Memory Match', 
      desc: 'Flip and match card animal pairs!', 
      emoji: '🧩', 
      color: 'from-curio-orange/80 to-amber-400',
      difficulty: 'Medium',
      starsMax: 30,
      bg: 'bg-curio-orange-light'
    },
    { 
      id: 'word-repeat', 
      title: 'Word Repeat', 
      desc: 'Speak simple target spelling words aloud!', 
      emoji: '🗣️', 
      color: 'from-curio-purple/80 to-indigo-400',
      difficulty: 'Easy',
      starsMax: 20,
      bg: 'bg-curio-purple-light'
    },
    { 
      id: 'air-draw', 
      title: 'AirDraw Adventure', 
      desc: 'Pinch and draw shapes in the air with hand AI!', 
      emoji: '✨', 
      color: 'from-curio-pink/80 to-fuchsia-400',
      difficulty: 'Hard',
      starsMax: 40,
      bg: 'bg-curio-pink-light'
    },
    { 
      id: 'alphabet-grab', 
      title: 'Alphabet Grab', 
      desc: 'Grab floating letters in the air using gestures!', 
      emoji: '🎈', 
      color: 'from-curio-blue/80 to-sky-400',
      difficulty: 'Medium',
      starsMax: 35,
      bg: 'bg-curio-blue-light'
    }
  ];

  const handleMascotTap = () => {
    setMascotState('happy');
    const prompts = [
      "Let's play Memory Match or Word Repeat! 🧩🗣️",
      "Wow! You have collected so many stars! ⭐️",
      "Reach Level 3 to unlock Rocky the Dino! 🦖",
      "Let's draw shapes in the air using your camera! ✨"
    ];
    const speech = new SpeechSynthesisUtterance(prompts[Math.floor(Math.random() * prompts.length)]);
    speech.rate = 1.05;
    speech.pitch = 1.25;
    window.speechSynthesis.speak(speech);
    setTimeout(() => setMascotState('idle'), 2000);
  };

  const getLevelProgress = () => {
    const starProgress = profile.stars % 50;
    return (starProgress / 50) * 100;
  };

  const selectCompanion = (skin) => {
    if (profile.unlockedCompanions.includes(skin)) {
      updateCustomization('companion', skin);
      setMascotState('happy');
      setTimeout(() => setMascotState('idle'), 1000);
    }
  };

  const launchDirectGame = (gameId) => {
    navigate(`/learning-room?game=${gameId}`);
  };

  return (
    <div className="space-y-8 pb-12 relative">
      
      {/* ================= STUNNING BANNER BANNER ================= */}
      <section className="bg-white/70 backdrop-blur-md rounded-4xl p-6 border-3 border-white/60 shadow-[0_12px_36px_rgba(0,0,0,0.06)] flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
        {/* Soft floating background light */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-curio-yellow-light/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-curio-blue-light/35 rounded-full blur-3xl" />
        
        {/* Mascot Avatar Interaction Bubble */}
        <div 
          onClick={handleMascotTap}
          className="cursor-pointer relative transform transition duration-150 hover:scale-105 active:scale-95 z-10 select-none group shrink-0"
        >
          <Mascot skin={profile.companion} state={mascotState} className="w-36 h-36 drop-shadow-md" />
          <div className="absolute -bottom-2 right-4 bg-curio-pink hover:bg-curio-pink-dark text-white px-3 py-1 rounded-full text-xs font-black border-2 border-white shadow-lg flex items-center gap-1 animate-float">
            <Sparkles className="w-3.5 h-3.5 fill-white" />
            <span>Tap me!</span>
          </div>
        </div>

        {/* Level bar progress & Call-to-action */}
        <div className="flex-grow space-y-4 text-center md:text-left z-10 w-full">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-black text-curio-slate tracking-tight">
              Hey there, Adventurer! <span className="inline-block animate-wiggle">👋</span>
            </h2>
            <p className="text-slate-500 font-bold text-sm">
              Let's play some amazing voice & camera games and collect stars!
            </p>
          </div>

          {/* Bouncy Progress tracking bar */}
          <div className="space-y-1.5 max-w-md mx-auto md:mx-0">
            <div className="flex justify-between items-center text-xs font-black text-slate-400 uppercase tracking-wider">
              <span>LEVEL {profile.level}</span>
              <span>{profile.stars % 50} / 50 Stars for Level UP</span>
            </div>
            <div className="h-6 w-full bg-slate-100/60 rounded-full border-2 border-white p-0.5 shadow-inner">
              <motion.div 
                className="h-full bg-bubblegum-gradient rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${getLevelProgress()}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Continue Adventure Button */}
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/learning-room')}
            className="bg-curio-purple hover:bg-curio-purple-dark text-white font-black py-3 px-6 rounded-2xl border-3 border-curio-purple-dark shadow-playful-purple hover:shadow-none hover:translate-y-0.5 transition duration-150 flex items-center gap-2 mx-auto md:mx-0 text-sm uppercase tracking-wider cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Continue Adventure</span>
          </motion.button>
        </div>
      </section>

      {/* ================= EXPLORE CATEGORIES SLIDER ================= */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
        {categories.map((cat, i) => (
          <button 
            key={i}
            className={`px-4 py-2.5 rounded-full border-2 text-xs font-black flex items-center gap-2 shrink-0 transition duration-150 transform hover:scale-105 active:scale-95 cursor-pointer shadow-playful ${
              cat.active 
                ? 'bg-curio-slate text-white border-curio-slate shadow-slate-300' 
                : 'bg-white text-slate-500 border-white hover:border-slate-200'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ================= DIRECT PLAY CARDS GRID ================= */}
      <section className="space-y-4">
        <h3 className="text-xl font-black text-curio-slate flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-curio-pink" /> 
          Quick Play Roster! 🎮
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {directGamesList.map((game, idx) => {
            const gameStars = profile.gamesStars?.[game.id] || 0;
            const progressPercent = Math.min(100, Math.round((gameStars / game.starsMax) * 100));

            return (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.04 }}
                onClick={() => launchDirectGame(game.id)}
                className={`bg-white rounded-3xl border-3 border-white/60 p-5 flex flex-col justify-between items-start transition duration-150 cursor-pointer shadow-lg hover:shadow-xl relative overflow-hidden`}
              >
                {/* Floating bubble background details */}
                <div className={`absolute -right-6 -bottom-6 w-20 h-20 rounded-full opacity-10 bg-gradient-to-tr ${game.color}`} />
                
                <div className="space-y-4 w-full z-10">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-4xl p-2.5 bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-center justify-center">
                      {game.emoji}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      game.difficulty === 'Easy' 
                        ? 'bg-curio-green/10 border-curio-green text-curio-green' 
                        : (game.difficulty === 'Medium' ? 'bg-curio-yellow/10 border-curio-yellow text-curio-yellow-dark' : 'bg-curio-pink/10 border-curio-pink text-curio-pink')
                    }`}>
                      {game.difficulty}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-base font-black text-curio-slate leading-tight">{game.title}</h4>
                    <p className="text-[11px] font-bold text-slate-400 leading-normal">
                      {game.desc}
                    </p>
                  </div>
                </div>

                <div className="w-full mt-4 space-y-2 z-10">
                  {/* Game Specific Stars progress */}
                  <div className="flex justify-between items-center text-[10px] font-black text-slate-400">
                    <span className="flex items-center gap-0.5 text-curio-yellow-dark font-black">
                      <Star className="w-3.5 h-3.5 fill-curio-yellow text-curio-yellow-dark" />
                      <span>{gameStars} Stars</span>
                    </span>
                    <span>{progressPercent}% Complete</span>
                  </div>

                  {/* Visual progress bar */}
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
                    <div 
                      className={`h-full bg-gradient-to-r ${game.color} rounded-full`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ================= IN-GAME AVATARS & MISSIONS GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Customization Area */}
        <section className="lg:col-span-2 space-y-6">
          {/* Select Avatar card */}
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg space-y-4">
            <h3 className="text-lg font-black text-curio-slate flex items-center gap-2">
              <span className="text-2xl animate-bounce-slow">🎨</span> Select Your Avatar
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {avatars.map((av) => (
                <button
                  key={av}
                  onClick={() => updateCustomization('avatar', av)}
                  className={`text-3xl p-2.5 rounded-2xl border-2 transition duration-150 transform hover:scale-110 active:scale-95 cursor-pointer ${
                    profile.avatar === av
                      ? 'bg-curio-purple border-curio-purple text-white shadow-lg'
                      : 'bg-white border-slate-100 hover:border-slate-300'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Select Mascot Buddy Companions */}
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg space-y-4">
            <h3 className="text-lg font-black text-curio-slate flex items-center gap-2">
              <span className="text-2xl">🦊</span> Unlock & Select Buddies
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Sparky Fox */}
              <div 
                onClick={() => selectCompanion('sparky')}
                className={`p-4 rounded-3xl border-3 transition duration-150 cursor-pointer flex flex-col items-center shadow ${
                  profile.companion === 'sparky'
                    ? 'bg-white border-curio-yellow shadow-lg scale-102'
                    : 'bg-white/40 border-transparent hover:border-slate-200'
                }`}
              >
                <Mascot skin="sparky" state="idle" className="w-16 h-16 drop-shadow" />
                <h4 className="font-black text-xs text-curio-slate mt-2">Sparky Fox</h4>
                <span className="text-[10px] bg-curio-green text-white px-2 py-0.5 rounded-full font-black mt-1">
                  Active
                </span>
              </div>

              {/* Rocky Dino */}
              {profile.unlockedCompanions.includes('rocky') || profile.level >= 3 ? (
                <div 
                  onClick={() => selectCompanion('rocky')}
                  className={`p-4 rounded-3xl border-3 transition duration-150 cursor-pointer flex flex-col items-center shadow ${
                    profile.companion === 'rocky'
                      ? 'bg-white border-curio-blue shadow-lg scale-102'
                      : 'bg-white/40 border-transparent hover:border-slate-200'
                  }`}
                >
                  <Mascot skin="rocky" state="idle" className="w-16 h-16 drop-shadow" />
                  <h4 className="font-black text-xs text-curio-slate mt-2">Rocky Dino</h4>
                  <span className="text-[10px] bg-curio-blue text-white px-2 py-0.5 rounded-full font-black mt-1">
                    Unlocked
                  </span>
                </div>
              ) : (
                <div className="p-4 rounded-3xl border-3 border-dashed border-slate-200 bg-white/30 flex flex-col items-center justify-center opacity-60 select-none text-center">
                  <span className="text-3xl">🔒</span>
                  <h4 className="font-black text-xs text-slate-400 mt-2">Rocky Dino</h4>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                    Unlocks at Level 3
                  </p>
                </div>
              )}

              {/* Ziggy Alien */}
              {profile.unlockedCompanions.includes('ziggy') || profile.level >= 5 ? (
                <div 
                  onClick={() => selectCompanion('ziggy')}
                  className={`p-4 rounded-3xl border-3 transition duration-150 cursor-pointer flex flex-col items-center shadow ${
                    profile.companion === 'ziggy'
                      ? 'bg-white border-curio-pink shadow-lg scale-102'
                      : 'bg-white/40 border-transparent hover:border-slate-200'
                  }`}
                >
                  <Mascot skin="ziggy" state="idle" className="w-16 h-16 drop-shadow" />
                  <h4 className="font-black text-xs text-curio-slate mt-2">Ziggy Jelly</h4>
                  <span className="text-[10px] bg-curio-pink text-white px-2 py-0.5 rounded-full font-black mt-1">
                    Unlocked
                  </span>
                </div>
              ) : (
                <div className="p-4 rounded-3xl border-3 border-dashed border-slate-200 bg-white/30 flex flex-col items-center justify-center opacity-60 select-none text-center">
                  <span className="text-3xl">🔒</span>
                  <h4 className="font-black text-xs text-slate-400 mt-2">Ziggy Jelly</h4>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                    Unlocks at Level 5
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Daily Mission checklist */}
        <section className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg space-y-4 h-fit">
          <h3 className="text-lg font-black text-curio-slate flex items-center gap-2">
            <span className="text-2xl animate-float">🔥</span> Daily Missions
          </h3>
          <div className="space-y-4">
            {profile.dailyMissions.map((mission) => (
              <div 
                key={mission.id} 
                className={`p-4 rounded-2xl border-2 flex items-start gap-3 relative overflow-hidden transition-all duration-150 ${
                  mission.completed 
                    ? 'bg-curio-green/10 border-curio-green/30' 
                    : 'bg-white border-slate-100 shadow-sm'
                }`}
              >
                <div className="mt-0.5 select-none">
                  {mission.completed ? (
                    <span className="text-xl text-curio-green animate-bounce-slow">✅</span>
                  ) : (
                    <div className="w-5 h-5 border-2 border-slate-300 rounded bg-slate-50" />
                  )}
                </div>
                <div className="flex-grow space-y-1 w-full overflow-hidden">
                  <p className={`font-black text-xs text-curio-slate leading-snug ${mission.completed ? 'line-through opacity-60' : ''}`}>
                    {mission.text}
                  </p>
                  
                  {/* Mini progress tracker */}
                  <div className="flex justify-between items-center text-[10px] font-black text-slate-400">
                    <div className="w-2/3 h-1.5 bg-slate-100 border border-slate-200/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${mission.completed ? 'bg-curio-green' : 'bg-curio-yellow'}`}
                        style={{ width: `${(mission.current / mission.target) * 100}%` }}
                      />
                    </div>
                    <span>{mission.current} / {mission.target}</span>
                  </div>

                  <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-curio-yellow-dark">
                    <Star className="w-3 h-3 fill-curio-yellow" />
                    +{mission.starsReward} Stars
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

    </div>
  );
}
