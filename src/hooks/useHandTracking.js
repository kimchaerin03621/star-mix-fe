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
          
          const wrist = landmarks[0];
          const middleMCP = landmarks[9];
          const scale = Math.sqrt(
            Math.pow(wrist.x - middleMCP.x, 2) + 
            Math.pow(wrist.y - middleMCP.y, 2)
          ) * 4;

          // Calculate average curl amount (0.0 = open, 1.0 = closed)
          const tips = [8, 12, 16, 20]; 
          let totalCurl = 0;
          tips.forEach(tipIdx => {
            const tip = landmarks[tipIdx];
            const dist = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
            const curl = Math.max(0, Math.min(1, (0.35 - dist) / 0.25));
            totalCurl += curl;
          });
          const avgCurl = totalCurl / tips.length;

          const isFist = avgCurl > 0.85;

          // Advanced Snap Detection
          const thumbTip = landmarks[4];
          const middleTip = landmarks[12];
          const indexTip = landmarks[8];
          const indexMCP = landmarks[6];
          
          const isIndexCurled = indexTip.y > indexMCP.y;
          const pinchDist = Math.sqrt(Math.pow(thumbTip.x - middleTip.x, 2) + Math.pow(thumbTip.y - middleTip.y, 2));

          const now = performance.now();
          const state = handStatesRef.current[index] || { isPinched: false, time: 0, snapCount: 0, lastTriggerTime: 0 };
          
          if (pinchDist < 0.05 && !isIndexCurled) {
            if (!state.isPinched) {
              state.isPinched = true;
              state.time = now;
            }
          } else if (pinchDist > 0.08) {
            if (state.isPinched) {
              const duration = now - state.time;
              if (duration > 30 && duration < 450) {
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

          return { x, y, scale, isFist, snapCount: state.snapCount, handedness, curlAmount: avgCurl };
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
