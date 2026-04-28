import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export function useHandTracking(videoRef) {
  const [handData, setHandData] = useState([]); 
  const [isReady, setIsReady] = useState(false);
  const landmarkerRef = useRef(null);
  const requestRef = useRef();
  
  // Multi-hand state tracking
  const handStatesRef = useRef([
    { isPinched: false, time: 0, snapCount: 0, lastTriggerTime: 0 },
    { isPinched: false, time: 0, snapCount: 0, lastTriggerTime: 0 }
  ]);

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
        numHands: 2
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
        const hands = results.landmarks.map((landmarks, index) => {
          const x = landmarks.reduce((acc, l) => acc + l.x, 0) / landmarks.length;
          const y = landmarks.reduce((acc, l) => acc + l.y, 0) / landmarks.length;
          
          const dx = landmarks[0].x - landmarks[12].x;
          const dy = landmarks[0].y - landmarks[12].y;
          const dz = landmarks[0].z - landmarks[12].z;
          const scale = Math.sqrt(dx * dx + dy * dy + dz * dz) * 2;

          const isFist = landmarks[8].y > landmarks[6].y && 
                         landmarks[12].y > landmarks[10].y && 
                         landmarks[16].y > landmarks[14].y && 
                         landmarks[20].y > landmarks[18].y;

          // Advanced Snap Detection
          const thumbTip = landmarks[4];
          const middleTip = landmarks[12];
          const indexTip = landmarks[8];
          const indexMCP = landmarks[6];
          
          // Must have index finger extended (not curled) to be a snap
          const isIndexCurled = indexTip.y > indexMCP.y;
          
          const dist = Math.sqrt(
            Math.pow(thumbTip.x - middleTip.x, 2) +
            Math.pow(thumbTip.y - middleTip.y, 2)
          );

          const now = performance.now();
          const state = handStatesRef.current[index] || { isPinched: false, time: 0, snapCount: 0, lastTriggerTime: 0 };
          
          // 1. Start Pinch (Generous distance, but index must be open)
          if (dist < 0.05 && !isIndexCurled) {
            if (!state.isPinched) {
              state.isPinched = true;
              state.time = now;
            }
          } 
          // 2. Detect Quick Release
          else if (dist > 0.08) {
            if (state.isPinched) {
              const duration = now - state.time;
              // Wider duration window for reliability (30ms to 450ms)
              if (duration > 30 && duration < 450) {
                // Cooldown: Prevent multiple triggers within 500ms
                if (now - (state.lastTriggerTime || 0) > 500) {
                  state.snapCount += 1;
                  state.lastTriggerTime = now;
                }
              }
              state.isPinched = false;
            }
          }
          handStatesRef.current[index] = state;
          
          const handedness = results.handednesses?.[index]?.[0]?.categoryName || 'Unknown';

          return { x, y, scale, isFist, snapCount: state.snapCount, handedness };
        });
        setHandData(hands);
      } else {
        setHandData([]);
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
