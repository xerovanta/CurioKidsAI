import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Star, AlertCircle, Compass, Volume2 } from 'lucide-react';
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

export default function AnimalSafari({ onBack }) {
  const { currentUser, childProfile, awardStars, incrementMission } = useAuth();
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  const { startCamera, stopCamera, stream, error: cameraError, hasPermission } = useCamera();

  const [loadingModel, setLoadingModel] = useState(true);
  const [buddyText, setBuddyText] = useState('');
  const [buddyState, setBuddyState] = useState('idle');
  const [score, setScore] = useState(0);
  
  const [detectedAnimal, setDetectedAnimal] = useState(null);
  const [activeDiscovery, setActiveDiscovery] = useState(true);
  const [sandboxMode, setSandboxMode] = useState(false);

  const animalsPool = [
    { label: 'teddy bear', display: 'Bear', emoji: '🐻', fact: 'Bears are excellent swimmers and can run incredibly fast, up to thirty miles per hour!' },
    { label: 'cat', display: 'Cat', emoji: '🐱', fact: 'Cats can jump up to six times their height and use their whiskers to feel the world around them!' },
    { label: 'dog', display: 'Dog', emoji: '🐶', fact: 'Dogs have an amazing sense of smell, which is at least ten thousand times better than ours!' },
    { label: 'elephant', display: 'Elephant', emoji: '🐘', fact: 'Elephants are the largest land animals in the world and use their ears to cool themselves down!' },
    { label: 'bird', display: 'Bird', emoji: '🐦', fact: 'Birds have hollow bones which make them light enough to fly easily through the skies!' },
    { label: 'zebra', display: 'Zebra', emoji: '🦓', fact: 'Every single zebra has a unique pattern of black and white stripes, just like human fingerprints!' },
    { label: 'giraffe', display: 'Giraffe', emoji: '🦒', fact: 'Giraffes have blue tongues that are very long, helping them grab delicious leaves from tall trees!' },
  ];

  useEffect(() => {
    setBuddyText("Welcome to the Animal Safari! 🦁 Hold a toy animal up to my camera, or unlock sandbox cards below!");
    setBuddyState('idle');
    
    loadCocoModel()
      .then(() => setLoadingModel(false))
      .catch(() => setLoadingModel(false));

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

  const logInteractionTelemetry = async (success, animalKey) => {
    const logData = {
      timestamp: new Date().toISOString(),
      activityType: 'animal-safari',
      success,
      target: 'any animal',
      detected: animalKey || 'none',
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

  // Animal Classification Recognition loop
  useEffect(() => {
    if (loadingModel || !stream || !videoRef.current || sandboxMode) return;

    let isScanning = false;

    const detectAnimals = async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && !isScanning) {
        isScanning = true;
        
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          if (canvas && cocoModel) {
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const predictions = await cocoModel.detect(video);
            
            // Check if any animal labels match animalsPool
            const animalLabels = animalsPool.map(a => a.label);
            const foundAnimalPrediction = predictions.find(
              p => animalLabels.includes(p.class) && p.score > 0.40
            );

            if (foundAnimalPrediction) {
              const matchedAnimal = animalsPool.find(a => a.label === foundAnimalPrediction.class);
              setDetectedAnimal(matchedAnimal);

              // Draw Box
              const [x, y, w, h] = foundAnimalPrediction.bbox;
              ctx.strokeStyle = '#10B981';
              ctx.lineWidth = 4;
              ctx.strokeRect(x, y, w, h);

              ctx.fillStyle = '#10B981';
              ctx.fillRect(x, y - 25, 120, 25);
              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 12px "Lexend", sans-serif';
              ctx.fillText(`Safari: ${matchedAnimal.display}`, x + 8, y - 8);

              // Trigger Discovery!
              if (activeDiscovery) {
                handleAnimalDiscovery(matchedAnimal);
              }
            }
          }
        } catch (e) {
          console.warn("Animal detector exception:", e);
        } finally {
          isScanning = false;
        }
      }
      
      if (stream) {
        requestRef.current = requestAnimationFrame(detectAnimals);
      }
    };

    requestRef.current = requestAnimationFrame(detectAnimals);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [loadingModel, stream, activeDiscovery, sandboxMode]);

  const handleAnimalDiscovery = async (animal) => {
    setActiveDiscovery(false);
    setBuddyState('happy');
    
    // Confetti
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });

    setBuddyText(`Wow! I see a cute ${animal.display}! 🦁 ${animal.emoji} Did you know? ${animal.fact}`);
    setScore(prev => prev + 1);

    await awardStars(5);
    await incrementMission(2); // star-milestone updates

    await logInteractionTelemetry(true, animal.label);

    // Re-activate safari guide after 8 seconds
    setTimeout(() => {
      setActiveDiscovery(true);
      setBuddyState('idle');
      setBuddyText("I am ready for the next animal! Show me another toy! 🦒");
    }, 8500);
  };

  const handleSandboxClick = (animal) => {
    handleAnimalDiscovery(animal);
  };

  return (
    <div className="space-y-6">
      
      {/* Game Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-4 border-curio-slate shadow-playful">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🦁</span>
          <div>
            <h3 className="text-xl font-black text-curio-slate">Animal Safari Guide</h3>
            <p className="text-xs font-semibold text-slate-400">Discover and learn fun wildlife facts!</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-curio-green text-white px-3 py-1 rounded-full text-sm font-bold border-2 border-curio-slate flex items-center gap-1 shadow-playful">
            <Compass className="w-4 h-4 fill-white animate-spin-slow" />
            <span>Seen: {score}</span>
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
        
        {/* Left Screen */}
        <div className="lg:col-span-2 bg-white p-4 rounded-4xl border-4 border-curio-slate shadow-playful-green flex flex-col items-center relative min-h-[350px]">
          
          {loadingModel ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-curio-green rounded-full animate-spin"></div>
              <h4 className="font-extrabold text-curio-slate">Setting up Safari Post...</h4>
              <p className="text-xs text-slate-400 font-semibold">Tuning animal classification lenses...</p>
            </div>
          ) : sandboxMode ? (
            /* Illustrated Safari Animal Cards Sandbox */
            <div className="flex flex-col items-center justify-center w-full h-full py-6 space-y-6">
              <div className="text-center space-y-1">
                <span className="text-5xl block animate-bounce-slow">🦓</span>
                <h4 className="font-extrabold text-curio-slate text-lg uppercase">Safari Catalog</h4>
                <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">
                  Camera is turned off. Tap on an animal card below to learn fun facts from your guide!
                </p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 px-4 max-w-lg w-full">
                {animalsPool.map((animal) => (
                  <button
                    key={animal.label}
                    onClick={() => handleSandboxClick(animal)}
                    className="p-4 bg-white hover:bg-curio-green-light border-4 border-curio-slate rounded-3xl flex flex-col items-center transition duration-150 transform hover:scale-105 active:scale-95 shadow-playful-green"
                  >
                    <span className="text-4xl">{animal.emoji}</span>
                    <span className="text-xs font-extrabold text-curio-slate mt-1">{animal.display}</span>
                  </button>
                ))}
              </div>
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

              {/* Camera fail recovery */}
              {(cameraError || !hasPermission) && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center space-y-4 text-white z-20">
                  <AlertCircle className="w-12 h-12 text-curio-orange" />
                  <div className="space-y-1 max-w-xs">
                    <h4 className="font-extrabold text-base">Camera Required</h4>
                    <p className="text-xs text-slate-400 leading-normal">
                      Camera access is needed to auto-detect toys. You can bypass and browse cards in Sandbox!
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSandboxMode(true);
                      stopCamera();
                    }}
                    className="bg-curio-yellow text-curio-slate-dark px-4 py-2 rounded-2xl text-xs font-black uppercase border-2 border-curio-slate shadow-playful"
                  >
                    🎮 Unlock Sandbox Catalog
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Toggle Button */}
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
              <span>{sandboxMode ? "Use Camera Mode" : "Switch to Catalog Cards"}</span>
            </button>
          )}

        </div>

        {/* Right Pane Safari logbook */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-4xl border-4 border-curio-slate shadow-playful-pink text-center space-y-3">
            <Compass className="w-10 h-10 text-curio-pink mx-auto animate-pulse" />
            <h4 className="text-base font-black text-curio-slate">Guide Notebook</h4>
            <p className="text-xs text-slate-400 font-semibold leading-normal">
              Bring any toy bear, cat, dog, elephant, bird, zebra, or giraffe inside the frame. The computer vision model will identify it and tell you a secret fact!
            </p>
          </div>

          {!sandboxMode && (
            <div className="bg-white p-5 rounded-4xl border-4 border-curio-slate shadow-playful space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                🔬 AI Lens Telemetry
              </h4>

              {detectedAnimal ? (
                <div className="space-y-2 text-xs font-semibold text-slate-600">
                  <p>🔹 Detected Class: <strong className="text-curio-slate">{detectedAnimal.display} {detectedAnimal.emoji}</strong></p>
                  <div className="bg-curio-green/10 border-2 border-curio-green/30 p-2 rounded-xl text-[10px] text-curio-green-dark">
                    🐯 Target detected successfully! Fact stream active.
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-4">
                  Scanning for wildlife...
                </p>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
