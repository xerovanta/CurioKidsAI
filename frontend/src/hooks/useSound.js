import { useCallback, useRef } from 'react';

const SOUND_URLS = {
  flip: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav', // card flip wav
  correct: 'https://assets.mixkit.co/active_storage/sfx/911/911-84.wav', // success chime
  wrong: 'https://assets.mixkit.co/active_storage/sfx/2648/2648-84.wav', // buzzer
  win: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-84.wav', // success trumpet
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav' // cute click
};

export function useSound() {
  const audioRefs = useRef({});

  // Lazily loads and plays a sound
  const playSound = useCallback((soundName) => {
    try {
      const url = SOUND_URLS[soundName];
      if (!url) return;

      // Create Audio instance if not already cached
      if (!audioRefs.current[soundName]) {
        const audio = new Audio(url);
        audio.volume = 0.55; // comfortable level for kids
        audioRefs.current[soundName] = audio;
      }

      const audio = audioRefs.current[soundName];
      audio.currentTime = 0; // Rewind to start
      
      // Handle play promise catching standard browser auto-play blocker warnings
      audio.play().catch(err => {
        console.log(`🔊 Sound play blocked by browser policy: ${soundName}`);
      });
    } catch (e) {
      console.warn(`🔊 Failed to play sound: ${soundName}`, e);
    }
  }, []);

  return {
    playFlip: () => playSound('flip'),
    playCorrect: () => playSound('correct'),
    playWrong: () => playSound('wrong'),
    playWin: () => playSound('win'),
    playClick: () => playSound('click')
  };
}
