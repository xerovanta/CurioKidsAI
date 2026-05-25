import { useState, useEffect, useCallback, useRef } from 'react';

// Truly global module-scoped references to synchronize across all hook instances
const globalSpeakingRef = { current: false };
const lastSpokenTextRef = { current: '' };
const speechQueue = [];

export function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognitionError, setRecognitionError] = useState(null);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setRecognitionError(null);
      };

      rec.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
          setRecognitionError('Microphone access denied. Please enable mic permissions.');
        } else if (event.error === 'no-speech') {
          // Silent failure for no-speech
        } else {
          setRecognitionError('Voice recognition error. Please try again.');
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    } else {
      console.warn("Speech Recognition API is not supported in this browser.");
    }

    // 5. Cleanup function that cancels active speech when component unmounts
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      globalSpeakingRef.current = false;
      lastSpokenTextRef.current = '';
      speechQueue.length = 0; // empty queue
    };
  }, []);

  // Listen to vocal speech and trigger a callback
  const startListening = useCallback((onResult) => {
    if (!recognitionRef.current) {
      setRecognitionError('Speech recognition not supported on this browser (Try Google Chrome!).');
      return;
    }

    setTranscript('');
    
    recognitionRef.current.onresult = (event) => {
      const resultText = event.results[0][0].transcript.toLowerCase().trim();
      setTranscript(resultText);
      if (onResult) onResult(resultText);
    };

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn("Speech recognition already active:", e);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // already stopped
      }
    }
    setIsListening(false);
  }, []);

  // Speak text out loud using Synthesis
  const speak = useCallback((text, onEnd) => {
    if (!window.speechSynthesis) {
      if (onEnd) onEnd();
      return;
    }

    // If speaking the exact same text is already in progress, ignore repeat request
    if (globalSpeakingRef.current && lastSpokenTextRef.current === text) {
      console.log("🤐 Speech in progress for same text, ignoring repeat request.");
      return;
    }

    // If speech is already in progress with different text, push to the FIFO queue
    if (globalSpeakingRef.current) {
      console.log(`📝 Speech already in progress. Queued request: "${text}"`);
      speechQueue.push({ text, onEnd });
      return;
    }

    // Set speaking active
    globalSpeakingRef.current = true;
    lastSpokenTextRef.current = text;

    const processUtterance = (txt, callback) => {
      // Cancel active speech to clear device audio threads
      window.speechSynthesis.cancel();

      // Pacing delay (150ms) to prevent device thread collisions
      setTimeout(() => {
        let retryCount = 0;
        const MAX_RETRIES = 3;

        const attemptSpeak = () => {
          try {
            const utterance = new SpeechSynthesisUtterance(txt);
            
            // Pick playful kid-friendly voice
            const voices = window.speechSynthesis.getVoices();
            const friendlyVoice = voices.find(v => 
              v.name.includes('Google US English') || 
              v.name.includes('Samantha') || 
              v.name.includes('Zira') || 
              v.name.toLowerCase().includes('female')
            );

            if (friendlyVoice) {
              utterance.voice = friendlyVoice;
            }

            utterance.pitch = 1.35; // Cute high pitched voice
            utterance.rate = 1.0;   // Friendly conversational pacing

            const handleSpeechEnd = () => {
              globalSpeakingRef.current = false;
              if (callback) callback();
              
              // Process the next item in FIFO queue after current speech finishes
              if (speechQueue.length > 0) {
                const nextRequest = speechQueue.shift();
                console.log(`🔄 Processing queued speech: "${nextRequest.text}"`);
                globalSpeakingRef.current = true;
                lastSpokenTextRef.current = nextRequest.text;
                processUtterance(nextRequest.text, nextRequest.onEnd);
              }
            };

            utterance.onend = handleSpeechEnd;
            
            utterance.onerror = (e) => {
              console.error("Speech Synthesis error:", e.error);
              
              // Limit retries on interrupted events to max 3 attempts with 300ms delays
              if (e.error === 'interrupted' && retryCount < MAX_RETRIES) {
                retryCount++;
                console.log(`🔄 Speech interrupted! Retrying attempt ${retryCount}/${MAX_RETRIES} in 300ms...`);
                setTimeout(attemptSpeak, 300);
              } else {
                handleSpeechEnd();
              }
            };

            window.speechSynthesis.speak(utterance);
          } catch (err) {
            console.error("Speech Synthesis try-catch caught exception:", err);
            globalSpeakingRef.current = false;
            if (callback) callback();
          }
        };

        attemptSpeak();
      }, 150);
    };

    processUtterance(text, onEnd);
  }, []);

  const cancelAllSpeech = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    globalSpeakingRef.current = false;
    lastSpokenTextRef.current = '';
    speechQueue.length = 0; // empty queue
    console.log("🛑 Speech queue cleared completely!");
  }, []);

  return {
    isListening,
    transcript,
    recognitionError,
    startListening,
    stopListening,
    speak,
    cancelAllSpeech,
    isSpeechSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  };
}
