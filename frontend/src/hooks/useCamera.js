import { useState, useEffect, useCallback } from 'react';

export function useCamera() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  const startCamera = useCallback(async (videoElement) => {
    if (!videoElement) return;

    // If stream is already active, do nothing
    if (stream) return;

    try {
      setError(null);
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setHasPermission(true);

      if ('srcObject' in videoElement) {
        videoElement.srcObject = mediaStream;
      } else {
        videoElement.src = window.URL.createObjectURL(mediaStream);
      }
      
      videoElement.play().catch(e => {
        console.warn("Video play interrupted:", e);
      });
      
    } catch (err) {
      console.error("Camera access failed:", err);
      setError(err.name === 'NotAllowedError' 
        ? 'Camera permission denied. Please allow camera access in your browser settings to play.' 
        : 'Could not activate camera. Please verify it is not in use by another app.');
      setHasPermission(false);
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return {
    stream,
    error,
    hasPermission,
    startCamera,
    stopCamera
  };
}
