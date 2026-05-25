import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Mic, AlertCircle, RefreshCw, Check, Sparkles, Volume2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useSpeech } from '../hooks/useSpeech';
import AIBuddy from '../components/AIBuddy';
import { doc, collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';

export default function PronunciationPractice({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission } = useAuth();
  
  const { speak, startListening, stopListening, isListening, recognitionError } = useSpeech();

  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);

  const [targetWord, setTargetWord] = useState('');
  const [matchingActive, setMatchingActive] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [verbalSpokenInput, setVerbalSpokenInput] = useState('');

  const vocabularyPool = [
    { word: 'rainbow', emoji: '🌈', syllables: 'rain-bow' },
    { word: 'sunshine', emoji: '☀️', syllables: 'sun-shine' },
    { word: 'bubble', emoji: '🧼', syllables: 'bub-ble' },
    { word: 'curious', emoji: '🧠', syllables: 'cu-ri-ous' },
    { word: 'adventure', emoji: '🎒', syllables: 'ad-ven-ture' },
    { word: 'elephant', emoji: '🐘', syllables: 'el-e-phant' },
  ];

  useEffect(() => {
    pickNewWord();
    
    return () => {
      stopListening();
    };
  }, []);

  const pickNewWord = () => {
    const nextItem = vocabularyPool[Math.floor(Math.random() * vocabularyPool.length)];
    setTargetWord(nextItem);
    setVerbalSpokenInput('');
    
    setBuddyText(`Repeat after me! Say "${nextItem.word}"! 🗣️ ${nextItem.emoji}`);
    setBuddyState('idle');
    setMatchingActive(true);
  };

  const logInteractionTelemetry = async (success, spoken) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'pronunciation-practice',
      success,
      target: targetWord.word,
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
      console.log("📝 Offline Telemetry Logged:", logData);
    }
  };

  // Start micro listening triggers
  const handleMicListenTrigger = () => {
    if (!matchingActive) return;

    setBuddyState('listening');
    setBuddyText("I am listening... Speak now! 🎙️");
    
    startListening((spokenResult) => {
      setVerbalSpokenInput(spokenResult);
      
      const cleanSpoken = spokenResult.toLowerCase().trim();
      const target = targetWord.word.toLowerCase().trim();

      if (cleanSpoken.includes(target) || target.includes(cleanSpoken)) {
        handleCorrectAnswer(spokenResult);
      } else {
        setBuddyState('sad');
        setBuddyText(`Hmm, I heard something like "${spokenResult}". Let's try again! Speak clear like: ${targetWord.syllables}!`);
        logInteractionTelemetry(false, spokenResult);
        setTimeout(() => {
          setBuddyState('idle');
          setBuddyText(`Can you repeat: "${targetWord.word}"?`);
        }, 4000);
      }
    });
  };

  const handleCorrectAnswer = async (spokenValue) => {
    setMatchingActive(false);
    setBuddyState('happy');
    setBuddyText(`Incredible! You said "${targetWord.word}" perfectly! ${targetWord.emoji} You are a star speaker!`);
    setScore(prev => prev + 1);

    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 }
    });

    await awardStars(5);
    await incrementMission(2); // star missions

    await logInteractionTelemetry(true, spokenValue);

    setTimeout(() => {
      pickNewWord();
    }, 4500);
  };

  // Sandbox tap verification
  const handleSandboxClick = (word) => {
    if (!matchingActive) return;
    
    if (word === targetWord.word) {
      handleCorrectAnswer(word);
    } else {
      setBuddyState('sad');
      setBuddyText(`No, that is ${word}, but we want to practice ${targetWord.word}! Tap the matching card!`);
      logInteractionTelemetry(false, word);
      setTimeout(() => {
        setBuddyState('idle');
        setBuddyText(`Can you find: "${targetWord.word}"?`);
      }, 3000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Game Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-4 border-curio-slate shadow-playful">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🗣️</span>
          <div>
            <h3 className="text-xl font-black text-curio-slate">Word Repeat Quest</h3>
            <p className="text-xs font-semibold text-slate-400">Speak clearly and build awesome vocabulary!</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-curio-purple text-white px-3 py-1 rounded-full text-sm font-bold border-2 border-curio-slate flex items-center gap-1 shadow-playful">
            <Star className="w-4 h-4 fill-white" />
            <span>Spoken: {score}</span>
          </div>

          <button 
            onClick={onBack}
            className="bg-slate-100 hover:bg-slate-200 border-2 border-curio-slate text-curio-slate font-extrabold px-3 py-1.5 rounded-2xl text-xs uppercase cursor-pointer"
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
        
        {/* Interaction Pane */}
        <div className="lg:col-span-2 bg-white p-6 rounded-4xl border-4 border-curio-slate shadow-playful-purple flex flex-col items-center justify-center min-h-[350px] relative">
          
          {sandboxMode ? (
            /* Digital matching selector sandbox */
            <div className="flex flex-col items-center justify-center w-full h-full py-6 space-y-6">
              <div className="text-center space-y-1">
                <span className="text-5xl block animate-bounce-slow">🧩</span>
                <h4 className="font-extrabold text-curio-slate text-lg uppercase">Vocabulary Sandbox</h4>
                <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">
                  Microphone is disabled. Tap on the correct word matching the buddy's request to complete!
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-4 w-full max-w-md">
                {vocabularyPool.map((item) => (
                  <button
                    key={item.word}
                    onClick={() => handleSandboxClick(item.word)}
                    className="p-4 bg-white hover:bg-curio-purple-light border-4 border-curio-slate rounded-3xl flex flex-col items-center transition duration-150 transform hover:scale-105 active:scale-95 shadow-playful-purple"
                  >
                    <span className="text-3xl">{item.emoji}</span>
                    <span className="text-xs font-black text-curio-slate mt-1 capitalize">{item.word}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Microphone Activation view */
            <div className="flex flex-col items-center justify-center space-y-8 py-8 w-full max-w-md">
              <div className="text-center space-y-2">
                <div className="text-7xl animate-float block">🎙️</div>
                <h4 className="font-black text-lg text-curio-slate">Tap and Repeat!</h4>
                <p className="text-xs text-slate-400 font-semibold leading-normal">
                  Tap the microphone bubble, wait for the chime, and pronounce the target word!
                </p>
              </div>

              {/* Large bouncy Mic button */}
              <motion.button
                onClick={handleMicListenTrigger}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-28 h-28 rounded-full border-4 border-curio-slate shadow-playful flex items-center justify-center cursor-pointer transition ${
                  isListening 
                    ? 'bg-curio-pink animate-pulse text-white shadow-playful-pink' 
                    : 'bg-curio-purple hover:bg-curio-purple-dark text-white shadow-playful-purple'
                }`}
              >
                <Mic className="w-12 h-12" />
              </motion.button>

              {recognitionError && (
                <div className="bg-red-50 border-2 border-red-300 text-red-600 px-4 py-2.5 rounded-2xl text-xs font-bold text-center animate-wiggle">
                  ⚠️ Mic Error: {recognitionError}
                </div>
              )}
            </div>
          )}

          {/* Toggle Sandbox */}
          <button
            onClick={() => {
              const nextMode = !sandboxMode;
              setSandboxMode(nextMode);
              stopListening();
            }}
            className="mt-4 text-xs font-black text-curio-purple hover:underline bg-slate-100 hover:bg-slate-200 border-2 border-curio-slate px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-playful cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{sandboxMode ? "Use Active Microphone" : "Switch to Button Sandbox"}</span>
          </button>

        </div>

        {/* Right Pane Target Visualizer */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-4xl border-4 border-curio-slate shadow-playful-pink text-center space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Speak Target</h4>
            
            <div className="flex justify-center">
              <motion.div 
                className="w-24 h-24 rounded-full border-4 border-curio-slate shadow-playful bg-curio-purple-light flex items-center justify-center text-5xl"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {targetWord.emoji || '💬'}
              </motion.div>
            </div>

            <h5 className="text-2xl font-black uppercase text-curio-slate tracking-wider">
              {targetWord.word || 'Loading...'}
            </h5>

            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Syllables Break</span>
              <span className="text-sm font-bold text-curio-slate italic">{targetWord.syllables}</span>
            </div>
          </div>

          {!sandboxMode && (
            <div className="bg-white p-5 rounded-4xl border-4 border-curio-slate shadow-playful space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                🎙️ Mic Transcript Feed
              </h4>

              {verbalSpokenInput ? (
                <div className="space-y-2 text-xs font-semibold text-slate-600">
                  <p>🔹 Buddy Heard: <strong className="text-curio-slate text-sm">"{verbalSpokenInput}"</strong></p>
                  
                  <div className={`p-2 rounded-xl border-2 text-center text-xs font-bold ${
                    verbalSpokenInput.toLowerCase().trim().includes(targetWord.word) 
                      ? 'bg-curio-green/10 border-curio-green text-curio-green'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    {verbalSpokenInput.toLowerCase().trim().includes(targetWord.word) 
                      ? "🎉 EXCELLENT PRONUNCIATION!" 
                      : "🔍 Spoken input mismatch"}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-4">
                  Microphone stream waiting...
                </p>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
