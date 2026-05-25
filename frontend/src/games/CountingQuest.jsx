import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Star, AlertCircle, Plus, Minus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useCamera } from '../hooks/useCamera';
import AIBuddy from '../components/AIBuddy';
import { doc, collection, addDoc } from 'firebase/firestore';
import { db, isValidConfig } from '../firebase';

// Helper: Load models dynamically
let cocoModel = null;
async function loadCocoModel() {
  if (cocoModel) return cocoModel;
  const tf = await import('@tensorflow/tfjs');
  await tf.ready();
  const cocoSsd = await import('@tensorflow-models/coco-ssd');
  cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  return cocoModel;
}

export default function CountingQuest({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission } = useAuth();
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  const { startCamera, stopCamera, stream, error: cameraError, hasPermission } = useCamera();

  const [loadingModel, setLoadingModel] = useState(true);
  const [targetCount, setTargetCount] = useState(0);
  const [targetItem, setTargetItem] = useState('');
  
  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);
  
  const [currentDetectionCount, setCurrentDetectionCount] = useState(0);
  const [matchingActive, setMatchingActive] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxCount, setSandboxCount] = useState(0); // for manual click counting

  const itemsPool = [
    { label: 'apple', emoji: '🍎', vocab: 'apples' },
    { label: 'banana', emoji: '🍌', vocab: 'bananas' },
    { label: 'cup', emoji: '🥤', vocab: 'cups' },
    { label: 'orange', emoji: '🍊', vocab: 'oranges' },
    { label: 'book', emoji: '📚', vocab: 'books' },
  ];

  useEffect(() => {
    pickNewTarget();
    
    loadCocoModel()
      .then(() => setLoadingModel(false))
      .catch(() => setLoadingModel(false)); // fallback gracefully

    return () => {
      stopCamera();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!loadingModel && videoRef.current && !sandboxMode) {
      startCamera(videoRef.current);
    }
  }, [loadingModel, videoRef.current, startCamera, sandboxMode]);

  const pickNewTarget = () => {
    const nextItem = itemsPool[Math.floor(Math.random() * itemsPool.length)];
    const count = Math.floor(Math.random() * 3) + 1; // 1 to 3 items (ideal for camera view)
    
    setTargetItem(nextItem);
    setTargetCount(count);
    setSandboxCount(0);
    
    setBuddyText(`Can you show me exactly ${count} ${nextItem.vocab}? ${nextItem.emoji} Hold them up!`);
    setBuddyState('idle');
    setCurrentDetectionCount(0);
    setMatchingActive(true);
  };

  const logInteractionTelemetry = async (success, countSeen) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'counting-quest',
      success,
      target: `${targetCount} ${targetItem.label}`,
      detected: `${countSeen} items`,
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

  // Object Detection Counting Loop
  useEffect(() => {
    if (loadingModel || !stream || !videoRef.current || sandboxMode) return;

    let isRunning = false;

    const detectCountingLoop = async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && !isRunning) {
        isRunning = true;
        
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          if (canvas && cocoModel) {
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const predictions = await cocoModel.detect(video);
            
            // Filter predictions by target items shown
            // e.g. if we are looking for apples, we match 'apple' coco tags
            const matchingPredictions = predictions.filter(
              p => p.class === targetItem.label && p.score > 0.40
            );

            const seenCount = matchingPredictions.length;
            setCurrentDetectionCount(seenCount);

            // Draw bounding boxes around all matches
            matchingPredictions.forEach((prediction) => {
              const [x, y, w, h] = prediction.bbox;

              ctx.strokeStyle = seenCount === targetCount ? '#10B981' : '#F59E0B';
              ctx.lineWidth = 4;
              ctx.strokeRect(x, y, w, h);

              ctx.fillStyle = seenCount === targetCount ? '#10B981' : '#F59E0B';
              ctx.fillRect(x, y - 25, 90, 25);

              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 12px "Lexend", sans-serif';
              ctx.fillText(`${targetItem.label}`, x + 8, y - 8);
            });

            // If correct matches hit!
            if (matchingActive && seenCount === targetCount) {
              handleCorrectAnswer(seenCount);
            }
          }
        } catch (e) {
          console.warn("Counting logic cycle exception:", e);
        } finally {
          isRunning = false;
        }
      }
      
      if (stream) {
        requestRef.current = requestAnimationFrame(detectCountingLoop);
      }
    };

    requestRef.current = requestAnimationFrame(detectCountingLoop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [loadingModel, stream, targetItem, targetCount, matchingActive, sandboxMode]);

  const handleCorrectAnswer = async (finalCount) => {
    setMatchingActive(false);
    setBuddyState('happy');
    setBuddyText(`Marvelous! That is exactly ${finalCount} ${targetItem.vocab}! Let's count them: ${Array.from({length: finalCount}, (_, i) => i + 1).join(', ')}! 🎉`);
    setScore(prev => prev + 1);

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    await awardStars(5);
    await incrementMission(2); // counts towards daily stars metrics

    await logInteractionTelemetry(true, finalCount);

    setTimeout(() => {
      pickNewTarget();
    }, 5000);
  };

  const handleSandboxSubmit = () => {
    if (!matchingActive) return;

    if (sandboxCount === targetCount) {
      handleCorrectAnswer(sandboxCount);
    } else {
      setBuddyState('sad');
      setBuddyText(`Hmm, you tapped ${sandboxCount} bubbles, but I asked for exactly ${targetCount} ${targetItem.vocab}! Let's try again! 🥤`);
      logInteractionTelemetry(false, sandboxCount);
      setTimeout(() => {
        setBuddyState('idle');
        setBuddyText(`Can you show me ${targetCount} ${targetItem.vocab}?`);
      }, 3000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Game Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-4 border-curio-slate shadow-playful">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🍌</span>
          <div>
            <h3 className="text-xl font-black text-curio-slate">Counting Quest</h3>
            <p className="text-xs font-semibold text-slate-400">Match the correct number of objects!</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-curio-yellow text-curio-slate-dark px-3 py-1 rounded-full text-sm font-bold border-2 border-curio-slate flex items-center gap-1 shadow-playful">
            <Star className="w-4 h-4 fill-curio-yellow text-curio-yellow-dark" />
            <span>Solved: {score}</span>
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
        
        {/* Camera feed / Sandbox panel */}
        <div className="lg:col-span-2 bg-white p-4 rounded-4xl border-4 border-curio-slate shadow-playful-yellow flex flex-col items-center relative min-h-[350px]">
          
          {loadingModel ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-curio-yellow rounded-full animate-spin"></div>
              <h4 className="font-extrabold text-curio-slate">Loading AI Bounding Eyes...</h4>
              <p className="text-xs text-slate-400 font-semibold">Tuning neural counting weights...</p>
            </div>
          ) : sandboxMode ? (
            /* Counting Sandbox clicker */
            <div className="flex flex-col items-center justify-center w-full h-full py-6 space-y-6">
              <div className="text-center space-y-1">
                <span className="text-5xl block animate-bounce-slow">{targetItem.emoji}</span>
                <h4 className="font-extrabold text-curio-slate text-lg uppercase">Tapping Sandbox</h4>
                <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">
                  Camera offline. Tap the bubbles below to place exactly **{targetCount}** items onto the screen!
                </p>
              </div>

              {/* Counter Buttons */}
              <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-3xl border-4 border-curio-slate shadow-playful">
                <button
                  onClick={() => setSandboxCount(prev => Math.max(0, prev - 1))}
                  className="bg-red-100 text-red-600 border-2 border-curio-slate p-3 rounded-2xl transition active:scale-90"
                >
                  <Minus className="w-6 h-6" />
                </button>
                <div className="text-4xl font-black text-curio-slate w-12 text-center">
                  {sandboxCount}
                </div>
                <button
                  onClick={() => setSandboxCount(prev => Math.min(10, prev + 1))}
                  className="bg-curio-green-light text-curio-green border-2 border-curio-slate p-3 rounded-2xl transition active:scale-90"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              {/* Render items dynamically */}
              <div className="flex justify-center gap-2 flex-wrap min-h-[50px]">
                {Array.from({ length: sandboxCount }).map((_, i) => (
                  <motion.span 
                    key={i} 
                    className="text-4xl"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    {targetItem.emoji}
                  </motion.span>
                ))}
              </div>

              <button
                onClick={handleSandboxSubmit}
                className="bg-curio-green text-white font-extrabold py-3.5 px-8 rounded-2xl border-2 border-curio-slate shadow-playful-green transition active:scale-95 cursor-pointer"
              >
                Submit My Count! ✅
              </button>

            </div>
          ) : (
            <div className="relative w-full h-full overflow-hidden rounded-3xl border-4 border-curio-slate bg-black flex items-center justify-center">
              
              <video 
                ref={videoRef}
                className="w-full h-auto aspect-video object-cover"
                muted
                playsInline
              />

              <canvas 
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {/* Camera access missing fallback */}
              {(cameraError || !hasPermission) && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center space-y-4 text-white z-20">
                  <AlertCircle className="w-12 h-12 text-curio-orange" />
                  <div className="space-y-1 max-w-xs">
                    <h4 className="font-extrabold text-base">Camera Required</h4>
                    <p className="text-xs text-slate-400 leading-normal">
                      We require camera access to run the COCO-SSD bounding box scanner. You can bypass and play in Sandbox Mode!
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSandboxMode(true);
                      stopCamera();
                    }}
                    className="bg-curio-yellow text-curio-slate-dark px-4 py-2 rounded-2xl text-xs font-black uppercase border-2 border-curio-slate shadow-playful"
                  >
                    🎮 Unlock Sandbox clicker
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Toggle button */}
          {!loadingModel && (
            <button
              onClick={() => {
                const nextMode = !sandboxMode;
                setSandboxMode(nextMode);
                if (nextMode) {
                  stopCamera();
                } else {
                  if (videoRef.current) startCamera(videoRef.current);
                }
              }}
              className="mt-4 text-xs font-black text-curio-purple hover:underline bg-slate-100 hover:bg-slate-200 border-2 border-curio-slate px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-playful"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{sandboxMode ? "Use Camera Mode" : "Switch to Tap Sandbox"}</span>
            </button>
          )}

        </div>

        {/* Right Pane Info */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-4xl border-4 border-curio-slate shadow-playful-pink text-center space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Challenge Target</h4>
            
            <div className="flex justify-center gap-2 items-center bg-slate-50 py-4 px-6 rounded-2xl border-2 border-slate-200 w-fit mx-auto">
              <span className="text-5xl font-black text-curio-purple">{targetCount}</span>
              <span className="text-4xl font-black text-curio-slate">✖</span>
              <span className="text-5xl">{targetItem.emoji}</span>
            </div>

            <h5 className="text-lg font-black uppercase text-curio-slate tracking-wider">
              {targetCount} {targetItem.vocab}
            </h5>
          </div>

          {!sandboxMode && (
            <div className="bg-white p-5 rounded-4xl border-4 border-curio-slate shadow-playful space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                🔬 AI Object Counter Logs
              </h4>

              <div className="space-y-3 text-xs font-semibold text-slate-600">
                <p>🔹 Targets Matching: <strong className="text-curio-slate">{targetItem.label}</strong></p>
                <p>🔹 Visible Count: <strong className="text-curio-purple text-base">{currentDetectionCount}</strong></p>

                <div className={`p-2 rounded-xl border-2 text-center text-xs font-bold ${
                  currentDetectionCount === targetCount 
                    ? 'bg-curio-green/10 border-curio-green text-curio-green animate-pulse'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  {currentDetectionCount === targetCount ? "🎉 EXACT MATCH!" : `🔍 Show exactly ${targetCount}`}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
