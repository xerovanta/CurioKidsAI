import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Mic, AlertCircle, RefreshCw, Sparkles, Volume2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useSpeech } from '../hooks/useSpeech';
import AIBuddy from '../components/AIBuddy';
import { doc, collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';

const WORD_POOL = [
  { word: 'apple', emoji: '🍎' },
  { word: 'cat', emoji: '🐱' },
  { word: 'dog', emoji: '🐶' },
  { word: 'sun', emoji: '☀️' },
  { word: 'moon', emoji: '🌙' },
  { word: 'star', emoji: '⭐️' },
  { word: 'fish', emoji: '🐟' },
  { word: 'bird', emoji: '🐦' },
  { word: 'cake', emoji: '🍰' },
  { word: 'ball', emoji: '⚽' },
  { word: 'book', emoji: '📖' },
  { word: 'tree', emoji: '🌳' },
  { word: 'house', emoji: '🏠' },
  { word: 'car', emoji: '🚗' },
  { word: 'hat', emoji: '🎩' },
  { word: 'bear', emoji: '🐻' },
  { word: 'duck', emoji: '🦆' },
  { word: 'frog', emoji: '🐸' }
];

export default function WordRepeat({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission, incrementStat } = useAuth();
  
  // Custom Speech hook: speaks target word and listens to mic
  const { speak, startListening, stopListening, isListening, recognitionError } = useSpeech();

  // Game states
  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);
  const [localStreak, setLocalStreak] = useState(0); // tracks 10 in a row
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const currentItem = WORD_POOL[activeWordIndex % WORD_POOL.length];

  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [matchingActive, setMatchingActive] = useState(true);
  const [sandboxMode, setSandboxMode] = useState(false);

  // Initialize and speak target word on mount / change
  useEffect(() => {
    setSpokenTranscript('');
    setMatchingActive(true);
    setBuddyState('idle');
    setBuddyText(`Let's repeat the word! Say: "${currentItem.word.toUpperCase()}"! 🗣️`);
    
    // Auto speak the target word to guide the child
    const delaySpeech = setTimeout(() => {
      speak(currentItem.word);
    }, 600);

    return () => {
      clearTimeout(delaySpeech);
      stopListening();
    };
  }, [activeWordIndex, currentItem, speak, stopListening]);

  const handleSpeakItem = () => {
    speak(currentItem.word);
  };

  // Start micro speech recognition listener
  const handleStartMicListen = () => {
    if (!matchingActive) return;

    setBuddyState('listening');
    setBuddyText(`Listening for: "${currentItem.word.toUpperCase()}"... Speak now! 🎙️`);
    
    startListening(async (spokenResult) => {
      setSpokenTranscript(spokenResult);
      
      const cleanSpoken = spokenResult.toLowerCase().trim();
      const target = currentItem.word.toLowerCase().trim();

      // Check if spoken text contains the target word
      if (cleanSpoken.includes(target) || target.includes(cleanSpoken)) {
        await handleCorrectAnswer(spokenResult);
      } else {
        setBuddyState('sad');
        setBuddyText(`Hmm, I heard "${spokenResult}". Let's try again! Speak clear: "${currentItem.word}"! 🦖`);
        setLocalStreak(0); // reset local streak on incorrect pronunciation
        await logSpeechTelemetry(false, spokenResult);
        setTimeout(() => {
          setBuddyState('idle');
          setBuddyText(`Repeat: "${currentItem.word.toUpperCase()}"! Tap mic to try again!`);
        }, 4000);
      }
    });
  };

  const handleCorrectAnswer = async (spokenValue) => {
    setMatchingActive(false);
    setBuddyState('happy');
    
    const nextStreak = localStreak + 1;
    setLocalStreak(nextStreak);

    let isStreakBonus = nextStreak === 10;
    let starsGained = 1; // +1 star per correct word

    if (isStreakBonus) {
      starsGained += 5; // +5 bonus stars on 10 correct words in a row!
      setBuddyText(`🔥 AMAZING! 10-WORD STREAK! You said "${currentItem.word.toUpperCase()}" perfectly and earned +5 BONUS stars! 👑`);
      setLocalStreak(0); // reset streak counter
    } else {
      setBuddyText(`Incredible! You said "${currentItem.word.toUpperCase()}" perfectly! ${currentItem.emoji} Here is a star!`);
    }
    
    setScore(prev => prev + 1);

    confetti({
      particleCount: isStreakBonus ? 120 : 60,
      spread: isStreakBonus ? 80 : 50,
      origin: { y: 0.6 }
    });

    // Award Stars (+1 star or +6 with streak bonus)
    await awardStars(starsGained, 'word-repeat');
    
    // Increment persistent statistics
    await incrementStat('wordRepeatWords', 1);
    await incrementMission(1); // updates streak / daily missions

    await logSpeechTelemetry(true, spokenValue);

    // Auto-advance to next word after 2.5 seconds
    setTimeout(() => {
      advanceWord();
    }, 2800);
  };

  const advanceWord = () => {
    setActiveWordIndex(prev => prev + 1);
  };

  // Sandbox bubble clicks fallback
  const handleSandboxClick = async (word) => {
    if (!matchingActive) return;
    
    if (word === currentItem.word) {
      await handleCorrectAnswer(word);
    } else {
      setBuddyState('sad');
      setBuddyText(`Oops! That's ${word}, but we want to practice saying ${currentItem.word}! Tap the matching bubble!`);
      setLocalStreak(0); // reset streak
      await logSpeechTelemetry(false, word);
      setTimeout(() => {
        setBuddyState('idle');
        setBuddyText(`Tap the bubble for: "${currentItem.word.toUpperCase()}"!`);
      }, 3000);
    }
  };

  const logSpeechTelemetry = async (success, spoken) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'word-repeat-simple',
      success,
      target: currentItem.word,
      detected: spoken || 'none',
      emotion: success ? 'happy' : 'neutral'
    };

    if (isValidConfig && db && currentUser) {
      try {
        await addDoc(collection(db, 'interactions', currentUser.uid, 'logs'), logData);
      } catch (err) {
        console.error("Firestore logging failed:", err);
      }
    } else {
      console.log("📝 Offline Speech Telemetry Logged:", logData);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Game Header */}
      <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-4 rounded-3xl border-3 border-white/60 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🗣️✨</span>
          <div>
            <h3 className="text-base font-black text-curio-slate">Word Repeat Room</h3>
            <p className="text-[10px] font-bold text-slate-400">Pronounce spelling words into your mic!</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-curio-yellow text-curio-slate-dark px-3.5 py-1 rounded-full text-xs font-black border-2 border-curio-slate flex items-center gap-1 shadow">
            <Star className="w-3.5 h-3.5 fill-curio-yellow text-curio-yellow-dark" />
            <span>Spoken: {score}</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interaction Panel */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg flex flex-col items-center justify-center min-h-[350px] relative select-none">
          
          {sandboxMode ? (
            /* Button Sandbox matching fallback */
            <div className="flex flex-col items-center justify-center w-full h-full py-6 space-y-6">
              <div className="text-center space-y-1">
                <span className="text-5xl block animate-bounce-slow">🧩</span>
                <h4 className="font-black text-curio-slate text-lg uppercase">Sandbox Matching</h4>
                <p className="text-xs text-slate-400 font-bold max-w-xs mx-auto">
                  Microphone is disabled. Click the matching bubble card representing your buddy's requested word!
                </p>
              </div>

              {/* Scrambled simple target options */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-4 w-full max-w-lg">
                {WORD_POOL.slice(0, 8).map((item) => (
                  <button
                    key={item.word}
                    onClick={() => handleSandboxClick(item.word)}
                    className={`p-4 bg-white hover:bg-curio-purple-light border-3 border-curio-slate rounded-3xl flex flex-col items-center transition duration-150 transform hover:scale-105 active:scale-95 shadow ${
                      !matchingActive ? 'pointer-events-none opacity-40' : ''
                    }`}
                  >
                    <span className="text-4xl">{item.emoji}</span>
                    <span className="text-xs font-black text-curio-slate mt-1.5 capitalize">{item.word}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Standard Microphone visualizer */
            <div className="flex flex-col items-center justify-center space-y-8 py-8 w-full max-w-md">
              <div className="text-center space-y-1.5 select-none">
                <div className="text-7xl animate-float block">🎙️</div>
                <h4 className="font-black text-lg text-curio-slate">Tap & Say it out loud!</h4>
                <p className="text-xs text-slate-400 font-bold leading-normal">
                  Tap the glowing microphone bubble and pronounce the word clearly!
                </p>
              </div>

              {/* Glowing, floating bouncy Mic jelly orb */}
              <motion.button
                onClick={handleStartMicListen}
                disabled={!matchingActive}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-28 h-28 rounded-full border-4 border-white shadow-lg flex items-center justify-center cursor-pointer transition ${
                  isListening 
                    ? 'bg-curio-pink animate-pulse text-white shadow-playful-pink scale-102' 
                    : 'bg-curio-purple hover:bg-curio-purple-dark text-white shadow-playful-purple'
                } disabled:opacity-40 disabled:pointer-events-none`}
              >
                <Mic className="w-12 h-12" />
              </motion.button>

              {recognitionError && (
                <div className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-2.5 rounded-2xl text-xs font-bold text-center animate-wiggle">
                  ⚠️ Microphone Error: {recognitionError}
                </div>
              )}
            </div>
          )}

          {/* Toggle Sandbox switch fallback */}
          <button
            onClick={() => {
              const nextMode = !sandboxMode;
              setSandboxMode(nextMode);
              stopListening();
            }}
            className="mt-4 text-xs font-black text-curio-purple hover:underline bg-slate-100/60 hover:bg-slate-200 border-2 border-curio-slate px-3 py-1.5 rounded-xl flex items-center gap-1 shadow cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{sandboxMode ? "Use Active Microphone" : "Switch to Button Sandbox"}</span>
          </button>

        </div>

        {/* Right Pane Target Word card */}
        <div className="space-y-6">
          
          {/* Card target */}
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-4xl border-3 border-white/60 shadow-lg text-center space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-curio-pink" />
              Target Word
            </h4>
            
            <div className="flex justify-center">
              <motion.div 
                className="w-24 h-24 rounded-full border-3 border-curio-slate shadow bg-curio-purple-light flex items-center justify-center text-5xl relative cursor-pointer group"
                onClick={handleSpeakItem}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
                whileTap={{ scale: 0.9 }}
              >
                {currentItem.emoji}
                {/* Micro speech prompt bubble */}
                <div className="absolute -bottom-1 -right-1 bg-curio-pink text-white p-1 rounded-full border border-curio-slate shadow">
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
              </motion.div>
            </div>

            <h5 className="text-2xl font-black uppercase text-curio-slate tracking-wider font-kids">
              {currentItem.word}
            </h5>

            <button
              onClick={handleSpeakItem}
              className="text-xs font-black text-slate-400 hover:text-curio-purple hover:underline flex items-center gap-1 mx-auto cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>Hear word pronunciation</span>
            </button>
          </div>

          {/* Transcript logs */}
          {!sandboxMode && (
            <div className="bg-white/70 backdrop-blur-md p-5 rounded-4xl border-3 border-white/60 shadow-lg space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                🎙️ Mic Transcript Feed
              </h4>

              {spokenTranscript ? (
                <div className="space-y-2 text-xs font-bold text-slate-500">
                  <p>🔹 Buddy Heard: <strong className="text-curio-slate text-sm">"{spokenTranscript}"</strong></p>
                  
                  <div className={`p-2 rounded-xl border-2 text-center text-[10px] font-black ${
                    spokenTranscript.toLowerCase().trim().includes(currentItem.word) 
                      ? 'bg-curio-green/10 border-curio-green text-curio-green'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    {spokenTranscript.toLowerCase().trim().includes(currentItem.word) 
                      ? "🎉 EXCELLENT PRONUNCIATION!" 
                      : "🔍 Listening for match..."}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 space-y-1">
                  <p className="text-xs text-slate-400 font-bold italic text-center">
                    Microphone stream waiting...
                  </p>
                  {localStreak > 0 && (
                    <span className="text-[10px] bg-curio-orange/10 border border-curio-orange text-curio-orange px-2 py-0.5 rounded-full font-black uppercase animate-pulse">
                      🔥 Streak: {localStreak}/10
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
