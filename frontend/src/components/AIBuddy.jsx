import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Mic } from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';
import Mascot from './Mascot';

export default function AIBuddy({ 
  skin = 'sparky', 
  state = 'idle', 
  text = 'Hello, adventurer! Are you ready to play?', 
  onSpeechRecognized = null,
  listenWords = [], // Target words to trigger matching
  isListeningActive = false
}) {
  const { speak, cancelAllSpeech, startListening, stopListening, isListening, recognitionError } = useSpeech();
  const [mute, setMute] = useState(false);
  const [buddyState, setBuddyState] = useState(state);

  // Sync internal mascot animation state
  useEffect(() => {
    setBuddyState(state);
  }, [state]);

  // Speak when text changes
  useEffect(() => {
    if (text && !mute) {
      setBuddyState('listening');
      cancelAllSpeech(); // CLEAR the speech queue and active speech synthesis immediately!
      speak(text, () => {
        setBuddyState(isListeningActive ? 'listening' : 'idle');
      });
    }
  }, [text, mute]);

  // Handle listening triggers
  useEffect(() => {
    if (isListeningActive && onSpeechRecognized) {
      setBuddyState('listening');
      startListening((result) => {
        console.log("🗣️ Speech recognized:", result);
        onSpeechRecognized(result);
      });
    } else {
      stopListening();
      if (buddyState === 'listening') {
        setBuddyState('idle');
      }
    }

    return () => {
      stopListening();
    };
  }, [isListeningActive, onSpeechRecognized, startListening, stopListening]);

  // Cancel speech on unmount (sudden game exit)
  useEffect(() => {
    return () => {
      cancelAllSpeech();
    };
  }, [cancelAllSpeech]);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 p-4 max-w-2xl mx-auto select-none">
      
      {/* Buddy Mascot Graphic */}
      <div className="relative shrink-0">
        <Mascot skin={skin} state={buddyState} className="w-36 h-36 md:w-44 md:h-44 drop-shadow-lg" />
        
        {/* Listen status glowing ring */}
        {isListening && (
          <motion.div 
            className="absolute -inset-2 border-4 border-curio-pink rounded-full pointer-events-none"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />
        )}
      </div>

      {/* Speech Bubble Container */}
      <div className="flex-grow w-full space-y-3 relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={text}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border-3 border-white shadow-lg relative speech-bubble-tail min-h-[90px] flex items-center justify-center"
          >
            <p className="text-curio-slate font-black text-base md:text-lg text-center leading-normal px-2">
              {text}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Audio / Mic Control utility row */}
        <div className="flex justify-center sm:justify-start items-center gap-3 px-3">
          {/* Mute Button */}
          <button
            onClick={() => setMute(!mute)}
            className={`p-2 rounded-2xl border-2 border-white shadow-md transition active:scale-95 cursor-pointer ${
              mute ? 'bg-red-50 text-red-500' : 'bg-curio-purple-light text-curio-purple'
            }`}
            title={mute ? "Unmute Buddy" : "Mute Buddy"}
          >
            {mute ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Listening indicator */}
          {isListening && (
            <div className="flex items-center gap-1.5 bg-curio-pink/10 text-curio-pink px-3.5 py-1.5 rounded-2xl border border-curio-pink text-[10px] font-black uppercase tracking-wider animate-pulse">
              <Mic className="w-3 h-3 fill-curio-pink" />
              <span>Listening...</span>
            </div>
          )}

          {recognitionError && (
            <span className="text-red-500 text-[10px] font-bold animate-wiggle">
              ⚠️ {recognitionError}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
