import React from 'react';
import { motion } from 'framer-motion';

// Sparky Skin - Cute Fox Mascot
const SparkyMascot = ({ stateAnimation }) => (
  <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg">
    {/* Ears */}
    <motion.path 
      d="M 50 70 L 30 20 L 80 50 Z" 
      fill="#F97316" stroke="#1E293B" strokeWidth="6" strokeLinejoin="round"
      animate={{ rotate: stateAnimation === 'happy' ? [0, -10, 0] : 0 }}
      transition={{ repeat: Infinity, duration: 1.5 }}
    />
    <motion.path 
      d="M 150 70 L 170 20 L 120 50 Z" 
      fill="#F97316" stroke="#1E293B" strokeWidth="6" strokeLinejoin="round"
      animate={{ rotate: stateAnimation === 'happy' ? [0, 10, 0] : 0 }}
      transition={{ repeat: Infinity, duration: 1.5 }}
    />
    <path d="M 45 60 L 35 30 L 65 48 Z" fill="#FECDD3" />
    <path d="M 155 60 L 165 30 L 135 48 Z" fill="#FECDD3" />

    {/* Tail */}
    <motion.path 
      d="M 140 140 C 180 150, 190 100, 170 80 C 150 70, 140 110, 140 140 Z" 
      fill="#EA580C" stroke="#1E293B" strokeWidth="6" strokeLinejoin="round"
      animate={{ rotate: [0, 15, -15, 0] }}
      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      style={{ originX: "140px", originY: "140px" }}
    />
    <path d="M 165 95 C 175 90, 185 85, 170 80 C 158 75, 153 85, 165 95 Z" fill="#FFFFFF" />

    {/* Body */}
    <rect x="60" y="100" width="80" height="70" rx="35" fill="#F97316" stroke="#1E293B" strokeWidth="6" />
    <rect x="75" y="115" width="50" height="50" rx="25" fill="#FFF" />

    {/* Paws */}
    <circle cx="75" cy="170" r="14" fill="#EA580C" stroke="#1E293B" strokeWidth="5" />
    <circle cx="125" cy="170" r="14" fill="#EA580C" stroke="#1E293B" strokeWidth="5" />

    {/* Face/Head */}
    <motion.circle 
      cx="100" cy="90" r="50" 
      fill="#F97316" stroke="#1E293B" strokeWidth="6"
      animate={{ 
        y: stateAnimation === 'listening' ? [0, -3, 0] : 0,
        scaleY: stateAnimation === 'listening' ? [1, 1.03, 1] : 1
      }}
      transition={{ repeat: Infinity, duration: 1.8 }}
    >
    </motion.circle>
    {/* Cheeks */}
    <path d="M 50 95 C 60 110, 70 105, 80 95 Z" fill="#FFF" />
    <path d="M 150 95 C 140 110, 130 105, 120 95 Z" fill="#FFF" />
    <circle cx="62" cy="100" r="8" fill="#F472B6" opacity="0.6" />
    <circle cx="138" cy="100" r="8" fill="#F472B6" opacity="0.6" />

    {/* Eyes */}
    {stateAnimation === 'happy' ? (
      <>
        <path d="M 72 88 Q 80 80 88 88" fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
        <path d="M 112 88 Q 120 80 128 88" fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
      </>
    ) : stateAnimation === 'sad' ? (
      <>
        <path d="M 72 82 Q 80 90 88 82" fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
        <path d="M 112 82 Q 120 90 128 82" fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
      </>
    ) : (
      <>
        {/* Blinking eyes */}
        <motion.ellipse 
          cx="80" cy="85" rx="6" ry="6" fill="#1E293B" 
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ repeat: Infinity, duration: 3, repeatDelay: 2 }}
        />
        <motion.ellipse 
          cx="120" cy="85" rx="6" ry="6" fill="#1E293B" 
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ repeat: Infinity, duration: 3, repeatDelay: 2 }}
        />
        {/* Eye highlights */}
        <circle cx="78" cy="83" r="2" fill="#FFF" />
        <circle cx="118" cy="83" r="2" fill="#FFF" />
      </>
    )}

    {/* Nose */}
    <polygon points="96,96 104,96 100,102" fill="#1E293B" stroke="#1E293B" strokeWidth="2" strokeLinejoin="round" />

    {/* Mouth */}
    {stateAnimation === 'happy' ? (
      <path d="M 92 105 Q 100 120 108 105" fill="#E11D48" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    ) : stateAnimation === 'sad' ? (
      <path d="M 94 112 Q 100 105 106 112" fill="none" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    ) : stateAnimation === 'listening' ? (
      <motion.ellipse 
        cx="100" cy="110" rx="6" ry="8" fill="#E11D48" stroke="#1E293B" strokeWidth="4"
        animate={{ scaleY: [0.6, 1.2, 0.6] }}
        transition={{ repeat: Infinity, duration: 0.4 }}
      />
    ) : (
      <path d="M 94 106 Q 100 112 106 106" fill="none" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    )}
  </svg>
);

// Rocky Skin - Playful Little Dino (Unlocks at Level 3)
const RockyMascot = ({ stateAnimation }) => (
  <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg">
    {/* Dino Spikes */}
    <path d="M 100 30 L 115 15 L 110 32 Z" fill="#10B981" stroke="#1E293B" strokeWidth="5" />
    <path d="M 125 40 L 142 30 L 133 46 Z" fill="#10B981" stroke="#1E293B" strokeWidth="5" />
    <path d="M 142 55 L 160 50 L 148 65 Z" fill="#10B981" stroke="#1E293B" strokeWidth="5" />

    {/* Tail */}
    <motion.path 
      d="M 135 145 C 175 160, 195 130, 180 100 L 160 115 C 150 120, 140 135, 135 145 Z" 
      fill="#06B6D4" stroke="#1E293B" strokeWidth="6" strokeLinejoin="round"
      animate={{ rotate: [0, -10, 15, 0] }}
      transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
      style={{ originX: "135px", originY: "145px" }}
    />
    <path d="M 175 115 L 188 105 L 178 122 Z" fill="#10B981" stroke="#1E293B" strokeWidth="4" />

    {/* Body */}
    <rect x="55" y="95" width="90" height="75" rx="38" fill="#06B6D4" stroke="#1E293B" strokeWidth="6" />
    <rect x="70" y="112" width="60" height="50" rx="15" fill="#E0F7FA" />

    {/* Paws */}
    <circle cx="70" cy="172" r="14" fill="#0891B2" stroke="#1E293B" strokeWidth="5" />
    <circle cx="130" cy="172" r="14" fill="#0891B2" stroke="#1E293B" strokeWidth="5" />

    {/* Head */}
    <motion.circle 
      cx="95" cy="80" r="48" 
      fill="#06B6D4" stroke="#1E293B" strokeWidth="6"
      animate={{ 
        y: stateAnimation === 'listening' ? [0, -2, 0] : 0,
        scaleY: stateAnimation === 'listening' ? [1, 1.02, 1] : 1
      }}
      transition={{ repeat: Infinity, duration: 2 }}
    />

    {/* Cheeks */}
    <circle cx="60" cy="90" r="7" fill="#F472B6" opacity="0.6" />
    <circle cx="130" cy="90" r="7" fill="#F472B6" opacity="0.6" />

    {/* Eyes */}
    {stateAnimation === 'happy' ? (
      <>
        <path d="M 68 78 Q 76 70 84 78" fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
        <path d="M 106 78 Q 114 70 122 78" fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
      </>
    ) : stateAnimation === 'sad' ? (
      <>
        <path d="M 68 74 Q 76 82 84 74" fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
        <path d="M 106 74 Q 114 82 122 74" fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />
      </>
    ) : (
      <>
        <motion.ellipse 
          cx="76" cy="76" rx="7" ry="7" fill="#1E293B" 
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ repeat: Infinity, duration: 3.5, repeatDelay: 1.5 }}
        />
        <motion.ellipse 
          cx="114" cy="76" rx="7" ry="7" fill="#1E293B" 
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ repeat: Infinity, duration: 3.5, repeatDelay: 1.5 }}
        />
        <circle cx="73" cy="73" r="2" fill="#FFF" />
        <circle cx="111" cy="73" r="2" fill="#FFF" />
      </>
    )}

    {/* Mouth */}
    {stateAnimation === 'happy' ? (
      <path d="M 88 95 Q 95 110 102 95" fill="#E11D48" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    ) : stateAnimation === 'sad' ? (
      <path d="M 90 100 Q 95 94 100 100" fill="none" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    ) : stateAnimation === 'listening' ? (
      <motion.ellipse 
        cx="95" cy="98" rx="5" ry="8" fill="#E11D48" stroke="#1E293B" strokeWidth="4"
        animate={{ scaleY: [0.6, 1.2, 0.6] }}
        transition={{ repeat: Infinity, duration: 0.4 }}
      />
    ) : (
      <path d="M 88 94 Q 95 100 102 94" fill="none" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    )}
  </svg>
);

// Ziggy Skin - Energetic Alien Jelly (Unlocks at Level 5)
const ZiggyMascot = ({ stateAnimation }) => (
  <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg">
    {/* Antennas */}
    <motion.g
      animate={{ rotate: [-5, 5, -5] }}
      transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      style={{ originX: "100px", originY: "70px" }}
    >
      <line x1="80" y1="40" x2="60" y2="15" stroke="#1E293B" strokeWidth="5" />
      <line x1="120" y1="40" x2="140" y2="15" stroke="#1E293B" strokeWidth="5" />
      <circle cx="56" cy="12" r="10" fill="#EC4899" stroke="#1E293B" strokeWidth="4" />
      <circle cx="144" cy="12" r="10" fill="#EC4899" stroke="#1E293B" strokeWidth="4" />
    </motion.g>

    {/* Body / Jelly-like base */}
    <motion.path 
      d="M 50 130 C 40 145, 50 170, 70 170 C 80 170, 85 160, 100 160 C 115 160, 120 170, 130 170 C 150 170, 160 145, 150 130 Z" 
      fill="#DB2777" stroke="#1E293B" strokeWidth="6" strokeLinejoin="round"
      animate={{ 
        d: [
          "M 50 130 C 40 145, 50 170, 70 170 C 80 170, 85 160, 100 160 C 115 160, 120 170, 130 170 C 150 170, 160 145, 150 130 Z",
          "M 50 130 C 42 142, 54 165, 72 165 C 82 165, 87 158, 100 158 C 113 158, 118 165, 128 165 C 146 165, 158 142, 150 130 Z",
          "M 50 130 C 40 145, 50 170, 70 170 C 80 170, 85 160, 100 160 C 115 160, 120 170, 130 170 C 150 170, 160 145, 150 130 Z"
        ]
      }}
      transition={{ repeat: Infinity, duration: 1.5 }}
    />

    {/* Head / Core body */}
    <motion.circle 
      cx="100" cy="90" r="52" 
      fill="#EC4899" stroke="#1E293B" strokeWidth="6"
      animate={{
        scaleY: stateAnimation === 'listening' ? [1, 1.05, 1] : [1, 0.97, 1],
        scaleX: [1, 1.03, 1]
      }}
      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
    />
    <ellipse cx="100" cy="115" rx="35" ry="18" fill="#FBCFE8" />

    {/* Cheeks */}
    <circle cx="62" cy="102" r="7" fill="#F472B6" opacity="0.8" />
    <circle cx="138" cy="102" r="7" fill="#F472B6" opacity="0.8" />

    {/* Eyes: Dynamic Triple Alien Eye! */}
    <g>
      {/* Left Eye */}
      <motion.circle cx="74" cy="84" r="10" fill="#FFF" stroke="#1E293B" strokeWidth="4" />
      <motion.circle 
        cx="74" cy="84" r="5" fill="#1E293B" 
        animate={{ x: stateAnimation === 'happy' ? [0, 1, -1, 0] : 0 }}
        transition={{ repeat: Infinity, duration: 2 }}
      />

      {/* Right Eye */}
      <motion.circle cx="126" cy="84" r="10" fill="#FFF" stroke="#1E293B" strokeWidth="4" />
      <motion.circle cx="126" cy="84" r="5" fill="#1E293B" />

      {/* Center Top Eye! */}
      <motion.circle 
        cx="100" cy="65" r="12" fill="#FFF" stroke="#1E293B" strokeWidth="4" 
        animate={{ scaleY: [1, 0.1, 1] }}
        transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
      />
      <circle cx="100" cy="65" r="6" fill="#1D4ED8" />
    </g>

    {/* Mouth */}
    {stateAnimation === 'happy' ? (
      <path d="M 90 102 Q 100 118 110 102" fill="#E11D48" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    ) : stateAnimation === 'sad' ? (
      <path d="M 92 108 Q 100 101 108 108" fill="none" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    ) : stateAnimation === 'listening' ? (
      <motion.ellipse 
        cx="100" cy="105" rx="6" ry="10" fill="#E11D48" stroke="#1E293B" strokeWidth="4"
        animate={{ scaleY: [0.6, 1.3, 0.6] }}
        transition={{ repeat: Infinity, duration: 0.3 }}
      />
    ) : (
      <path d="M 92 102 Q 100 108 108 102" fill="none" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    )}
  </svg>
);

export default function Mascot({ skin = 'sparky', state = 'idle', className = "w-48 h-48" }) {
  // state can be 'idle', 'happy', 'sad', 'listening'
  
  const renderMascot = () => {
    switch (skin) {
      case 'rocky':
        return <RockyMascot stateAnimation={state} />;
      case 'ziggy':
        return <ZiggyMascot stateAnimation={state} />;
      case 'sparky':
      default:
        return <SparkyMascot stateAnimation={state} />;
    }
  };

  return (
    <motion.div 
      className={`relative ${className}`}
      animate={state === 'happy' ? {
        y: [0, -15, 0],
        rotate: [0, 5, -5, 0],
        scale: [1, 1.05, 0.95, 1]
      } : {
        y: [0, -8, 0]
      }}
      transition={state === 'happy' ? {
        duration: 0.6,
        repeat: 2,
        ease: "easeInOut"
      } : {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {renderMascot()}
    </motion.div>
  );
}
