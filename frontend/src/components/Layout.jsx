import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Gamepad2, Trophy, Lock, Star, Flame, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { childProfile, currentUser } = useAuth();
  
  const [showGateModal, setShowGateModal] = useState(false);
  const [gateQuestion, setGateQuestion] = useState({ q: '', a: 0 });
  const [gateAnswer, setGateAnswer] = useState('');
  const [gateError, setGateError] = useState(false);

  // Math security gate so small children don't access parent dashboard
  const handleParentClick = (e) => {
    e.preventDefault();
    if (currentUser && !currentUser.isAnonymous) {
      // Parent is already authenticated, go directly
      navigate('/dashboard');
      return;
    }

    // Generate simple validation math question
    const num1 = Math.floor(Math.random() * 8) + 8; // 8-15
    const num2 = Math.floor(Math.random() * 7) + 3;  // 3-9
    setGateQuestion({
      q: `Only parents can pass! What is ${num1} + ${num2}?`,
      a: num1 + num2
    });
    setGateAnswer('');
    setGateError(false);
    setShowGateModal(true);
  };

  const handleGateSubmit = (e) => {
    e.preventDefault();
    if (parseInt(gateAnswer) === gateQuestion.a) {
      setShowGateModal(false);
      // Pass math gate! Send to parent dashboard login screen
      navigate('/parent-login');
    } else {
      setGateError(true);
      setGateAnswer('');
    }
  };

  const menuItems = [
    { path: '/', label: 'Home', icon: Home, color: 'text-curio-purple', bg: 'bg-curio-purple/15' },
    { path: '/learning-room', label: 'Play', icon: Gamepad2, color: 'text-curio-pink', bg: 'bg-curio-pink/15' },
    { path: '/trophy-case', label: 'My Stars', icon: Trophy, color: 'text-curio-yellow', bg: 'bg-curio-yellow/15' },
  ];

  return (
    <div className="relative flex flex-col min-h-screen pb-32 bg-[#EAF8FF] font-kids text-curio-slate select-none overflow-x-hidden">
      
      {/* ================= MAGICAL CARTOON SCENERY BACKDROP ================= */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        
        {/* Animated Drifting Clouds */}
        <div className="absolute inset-x-0 top-12 h-40">
          <div 
            className="absolute top-4 w-32 h-16 bg-white/70 rounded-full blur-[1px] opacity-75"
            style={{
              animation: 'drift 55s linear infinite',
              left: '-10%',
              boxShadow: '20px 20px 0 0 rgba(255,255,255,0.9), -15px 10px 0 5px rgba(255,255,255,0.8)'
            }}
          />
          <div 
            className="absolute top-16 w-24 h-12 bg-white/60 rounded-full blur-[1.5px] opacity-60"
            style={{
              animation: 'drift 75s linear infinite',
              animationDelay: '12s',
              left: '-15%',
              boxShadow: '15px 15px 0 0 rgba(255,255,255,0.8), -10px 8px 0 3px rgba(255,255,255,0.7)'
            }}
          />
          <div 
            className="absolute top-8 w-40 h-20 bg-white/80 rounded-full blur-[0.5px] opacity-80"
            style={{
              animation: 'drift 45s linear infinite',
              animationDelay: '28s',
              left: '-20%',
              boxShadow: '30px 24px 0 0 rgba(255,255,255,0.95), -20px 15px 0 8px rgba(255,255,255,0.85)'
            }}
          />
        </div>

        {/* Dynamic Custom Keyframes for Drifting Clouds injected locally */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes drift {
            0% { transform: translateX(-15vw); }
            100% { transform: translateX(115vw); }
          }
        `}} />

        {/* Overlapping Rolling Hills Layer (Bottom half) */}
        <div className="absolute inset-x-0 bottom-0 h-64 sm:h-80 md:h-[400px]">
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full h-full" preserveAspectRatio="none">
            {/* Far Background Hills (Teal/Green) */}
            <path d="M0,220 C360,290 720,170 1080,250 C1260,290 1380,270 1440,230 L1440,320 L0,320 Z" fill="#37D67A" opacity="0.35" />
            
            {/* Midground Hills (Light Playful Green) */}
            <path d="M0,250 C240,190 480,280 720,220 C960,160 1200,260 1440,240 L1440,320 L0,320 Z" fill="#4ADE80" opacity="0.6" />
            
            {/* Foreground Hills (Vibrant Grassy Green) */}
            <path d="M0,280 C320,240 640,310 960,250 C1280,190 1380,290 1440,270 L1440,320 L0,320 Z" fill="#22C55E" />
          </svg>
        </div>

        {/* Cute Windmill (Bottom Left Hilltop) */}
        <div className="absolute left-[8%] bottom-36 sm:bottom-48 md:bottom-64 w-12 sm:w-16 h-24 flex items-center justify-center">
          <svg viewBox="0 0 100 150" className="w-full h-full opacity-80">
            {/* Base tower */}
            <polygon points="40,140 60,140 55,50 45,50" fill="#E2E8F0" stroke="#1E293B" strokeWidth="4" />
            <polygon points="43,50 57,50 50,20" fill="#EF4444" stroke="#1E293B" strokeWidth="4" />
            {/* Rotating sails */}
            <g className="animate-[spin_18s_linear_infinite] origin-[50px_50px]">
              <circle cx="50" cy="50" r="6" fill="#F59E0B" stroke="#1E293B" strokeWidth="4" />
              <line x1="50" y1="50" x2="50" y2="5" stroke="#1E293B" strokeWidth="5" strokeLinecap="round" />
              <polygon points="47,15 53,15 50,5" fill="#3B82F6" stroke="#1E293B" strokeWidth="2" />
              
              <line x1="50" y1="50" x2="50" y2="95" stroke="#1E293B" strokeWidth="5" strokeLinecap="round" />
              <polygon points="47,85 53,85 50,95" fill="#3B82F6" stroke="#1E293B" strokeWidth="2" />
              
              <line x1="50" y1="50" x2="95" y2="50" stroke="#1E293B" strokeWidth="5" strokeLinecap="round" />
              <polygon points="85,47 85,53 95,50" fill="#3B82F6" stroke="#1E293B" strokeWidth="2" />
              
              <line x1="50" y1="50" x2="5" y2="50" stroke="#1E293B" strokeWidth="5" strokeLinecap="round" />
              <polygon points="15,47 15,53 5,50" fill="#3B82F6" stroke="#1E293B" strokeWidth="2" />
            </g>
          </svg>
        </div>

        {/* Fluffy cartoon tree (Bottom Right Foreground) */}
        <div className="absolute right-[5%] bottom-28 sm:bottom-36 md:bottom-48 w-24 sm:w-36 h-40 flex items-center justify-center">
          <svg viewBox="0 0 120 180" className="w-full h-full opacity-90 drop-shadow-lg">
            {/* Trunk */}
            <path d="M52,180 L68,180 L64,120 L56,120 Z" fill="#78350F" stroke="#1E293B" strokeWidth="4" />
            {/* Branches */}
            <path d="M58,135 L42,120 M62,130 L74,115" stroke="#78350F" strokeWidth="4" strokeLinecap="round" />
            {/* Fluffy foliage circles */}
            <circle cx="60" cy="85" r="32" fill="#15803D" stroke="#1E293B" strokeWidth="4" />
            <circle cx="45" cy="70" r="24" fill="#16A34A" stroke="#1E293B" strokeWidth="4" />
            <circle cx="75" cy="72" r="26" fill="#16A34A" stroke="#1E293B" strokeWidth="4" />
            <circle cx="60" cy="55" r="28" fill="#22C55E" stroke="#1E293B" strokeWidth="4" />
            
            {/* Perched little blue bird! */}
            <g className="animate-float" style={{ transformOrigin: '40px 105px' }}>
              {/* Body */}
              <circle cx="42" cy="108" r="9" fill="#38B6FF" stroke="#1E293B" strokeWidth="3" />
              {/* Wing */}
              <path d="M38,108 C36,112 40,114 42,112 Z" fill="#1E9DFF" stroke="#1E293B" strokeWidth="2.5" />
              {/* Eye */}
              <circle cx="45" cy="106" r="1.5" fill="#000000" />
              {/* Beak */}
              <polygon points="49,106 53,108 49,110" fill="#FF9F1C" stroke="#1E293B" strokeWidth="1.5" />
            </g>
          </svg>
        </div>

        {/* Small lovely flowers dotting the field */}
        <div className="absolute left-[30%] bottom-8 w-6 h-6 flex items-center justify-center">
          <svg viewBox="0 0 30 30" className="w-full h-full text-red-400 fill-current animate-pulse-soft"><circle cx="15" cy="15" r="5" fill="#FF9F1C" stroke="#1E293B" strokeWidth="2"/><path d="M15,5 C10,5 5,10 5,15 C5,20 10,25 15,25 C20,25 25,20 25,15 C25,10 20,5 15,5 Z" opacity="0.3"/></svg>
        </div>
        <div className="absolute right-[25%] bottom-14 w-8 h-8 flex items-center justify-center">
          <svg viewBox="0 0 30 30" className="w-full h-full text-purple-400 fill-current animate-float"><circle cx="15" cy="15" r="5" fill="#FF9F1C" stroke="#1E293B" strokeWidth="2"/><path d="M15,5 C10,5 5,10 5,15 C5,20 10,25 15,25 C20,25 25,20 25,15 C25,10 20,5 15,5 Z" opacity="0.3"/></svg>
        </div>

      </div>

      {/* ================= FLOATING GLASS TOP STATUS NAVIGATION ================= */}
      <header className="relative z-40 w-[calc(100%-2rem)] max-w-5xl mx-4 sm:mx-auto mt-4 mb-2 bg-white/70 backdrop-blur-md border-3 border-white/60 shadow-[0_8px_32px_rgba(31,38,135,0.06)] rounded-full px-6 py-3.5 flex items-center justify-between transition-all duration-300">
        
        {/* Magical child Logo */}
        <Link to="/" className="flex items-center gap-2 group transform hover:scale-105 active:scale-95 duration-150">
          <span className="text-3xl animate-bounce-slow filter drop-shadow">🎒</span>
          <span className="text-xl sm:text-2xl font-black text-curio-slate tracking-tight flex items-center gap-1 leading-none font-kids text-glow-purple">
            Curio<span className="text-curio-pink">Kids</span>
            <span className="bg-bubblegum-gradient text-white px-2 py-0.5 text-xs rounded-full border-2 border-curio-slate shadow-playful font-black tracking-normal scale-95">AI</span>
          </span>
        </Link>

        {/* Child Profile Metrics Pill Panel */}
        {childProfile && (
          <div className="flex items-center gap-2 sm:gap-3.5">
            
            {/* Level capsule badge */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-curio-purple text-white px-3.5 py-1 rounded-full text-xs sm:text-sm font-black border-2 border-curio-slate shadow-playful flex items-center gap-1"
            >
              <span className="opacity-80">LVL</span>
              <span className="text-base">{childProfile.level}</span>
            </motion.div>

            {/* Stars capsule badge */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/trophy-case')}
              className="bg-curio-yellow hover:bg-curio-yellow-dark text-curio-slate-dark px-3.5 py-1 rounded-full text-xs sm:text-sm font-black border-2 border-curio-slate shadow-playful flex items-center gap-1 cursor-pointer"
            >
              <Star className="w-4 h-4 fill-curio-yellow-dark text-curio-yellow-dark" />
              <span>{childProfile.stars}</span>
            </motion.div>

            {/* Flame streak capsule badge */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-curio-orange text-white px-3.5 py-1 rounded-full text-xs sm:text-sm font-black border-2 border-curio-slate shadow-playful flex items-center gap-1"
            >
              <Flame className="w-4 h-4 fill-white text-white animate-pulse" />
              <span>{childProfile.streak}</span>
            </motion.div>
          </div>
        )}

        {/* Parents Lock Area */}
        <button 
          onClick={handleParentClick}
          className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-500 hover:text-curio-slate px-4 py-1.5 rounded-full text-xs sm:text-sm font-black uppercase border-2 border-curio-slate cursor-pointer transition transform hover:scale-105 active:scale-95 shadow-playful"
        >
          <Lock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Parents</span>
        </button>
      </header>

      {/* ================= MAIN SCREEN ADVENTURE ROUTER VIEWPORT ================= */}
      <main className="relative z-10 flex-grow w-full max-w-5xl px-4 py-4 mx-auto">
        {children}
      </main>

      {/* ================= FLOATING GLASS BOTTOM NAVIGATION PILL ================= */}
      <nav className="fixed bottom-5 left-1/2 transform -translate-x-1/2 z-40 max-w-md w-[calc(100%-2.5rem)] bg-white/75 backdrop-blur-lg border-3 border-white/60 py-2.5 px-6 rounded-full shadow-[0_12px_36px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-around">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className="relative flex flex-col items-center p-1.5 group select-none"
              >
                <div className={`p-2 rounded-2xl transition duration-300 border-2 ${
                  isActive 
                    ? `bg-curio-slate text-white border-curio-slate transform -translate-y-1.5 shadow-playful` 
                    : `bg-transparent text-slate-500 border-transparent group-hover:scale-110 group-hover:text-curio-slate`
                }`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${
                  isActive ? 'text-curio-slate' : 'text-slate-400 group-hover:text-curio-slate'
                }`}>
                  {item.label}
                </span>
                
                {isActive && (
                  <motion.div 
                    layoutId="activeTabIndicator" 
                    className="absolute -bottom-1 w-8 h-1 bg-curio-slate rounded-full" 
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ================= PARENT MODE GATE MODAL ================= */}
      <AnimatePresence>
        {showGateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-curio-slate/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white p-6 rounded-4xl border-4 border-curio-slate shadow-[0_12px_0_0_#1E293B]"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-curio-slate flex items-center gap-1 leading-none font-kids">
                  <Lock className="w-5 h-5 text-curio-purple" />
                  Parent Lock Gate
                </h3>
                <button 
                  onClick={() => setShowGateModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-full border border-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-slate-500 mb-4 text-xs sm:text-sm font-semibold leading-relaxed">
                Only parents can unlock this section! Solve this simple math problem to pass:
              </p>

              <form onSubmit={handleGateSubmit} className="space-y-4">
                <div className="bg-[#EAF8FF] p-4 rounded-2xl border-2 border-curio-slate text-center text-xl font-black text-curio-purple">
                  {gateQuestion.q}
                </div>

                <div>
                  <input 
                    type="number" 
                    placeholder="Enter answer"
                    value={gateAnswer}
                    onChange={(e) => setGateAnswer(e.target.value)}
                    className="w-full text-center px-4 py-3 rounded-2xl border-4 border-curio-slate text-xl font-black focus:outline-none focus:ring-4 focus:ring-curio-purple/20 bg-white"
                    autoFocus
                  />
                  {gateError && (
                    <p className="text-red-500 text-xs font-black mt-1 text-center animate-wiggle">
                      ❌ Oops! That's incorrect. Try again!
                    </p>
                  )}
                </div>

                <button 
                  type="submit"
                  className="w-full bg-curio-purple hover:bg-curio-purple-dark text-white font-black py-4 px-6 rounded-2xl border-4 border-curio-slate shadow-playful-purple hover:translate-y-0.5 hover:shadow-none transition duration-150 text-center uppercase tracking-wider text-sm cursor-pointer"
                >
                  Confirm & Unlock
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
