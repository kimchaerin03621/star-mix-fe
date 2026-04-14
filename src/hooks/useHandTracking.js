import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export function useHandTracking(videoRef) {
  const [handData, setHandData] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const landmarkerRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    async function init() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });
      landmarkerRef.current = handLandmarker;
      setIsReady(true);
    }
    init();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const detect = () => {
    if (
      videoRef.current &&
      videoRef.current.readyState >= 2 &&
      landmarkerRef.current
    ) {
      const startTimeMs = performance.now();
      const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        // Calculate average position
        const x = landmarks.reduce((acc, l) => acc + l.x, 0) / landmarks.length;
        const y = landmarks.reduce((acc, l) => acc + l.y, 0) / landmarks.length;
        
        // Calculate "scale" based on distance between wrist (0) and middle finger tip (12)
        const dx = landmarks[0].x - landmarks[12].x;
        const dy = landmarks[0].y - landmarks[12].y;
        const dz = landmarks[0].z - landmarks[12].z;
        const scale = Math.sqrt(dx * dx + dy * dy + dz * dz) * 2; // Arbitrary multiplier

        setHandData({ x, y, scale });
      } else {
        setHandData(null);
      }
    }
    requestRef.current = requestAnimationFrame(detect);
  };

  useEffect(() => {
    if (isReady) {
      detect();
    }
  }, [isReady]);

  return handData;
}
