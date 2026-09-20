import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export function useHandTracking(videoRef, enabled = true) {
  const [handData, setHandData] = useState([]); 
  const [isReady, setIsReady] = useState(false);
  const landmarkerRef = useRef(null);
  const requestRef = useRef();
  const lastDetectTimeRef = useRef(0);
  
  // Multi-hand state tracking
  const handStatesRef = useRef([
    { isPinched: false, time: 0, snapCount: 0, lastTriggerTime: 0 },
    { isPinched: false, time: 0, snapCount: 0, lastTriggerTime: 0 }
  ]);

  useEffect(() => {
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        let handLandmarker;
        try {
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2
          });
        } catch (gpuError) {
          console.warn("MediaPipe GPU delegate failed. Falling back to CPU delegate:", gpuError);
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numHands: 2
          });
        }
        landmarkerRef.current = handLandmarker;
        setIsReady(true);
      } catch (err) {
        console.error("Failed to initialize MediaPipe HandLandmarker:", err);
      }
    }
    init();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const detect = () => {
    if (!enabled) {
      setHandData([]);
      return;
    }
    if (
      videoRef.current &&
      videoRef.current.readyState >= 2 &&
      landmarkerRef.current
    ) {
      const now = performance.now();
      // Throttle detections to ~30 FPS (every 33ms) to prevent blocking the main thread
      if (now - lastDetectTimeRef.current >= 33) {
        lastDetectTimeRef.current = now;

        const startTimeMs = now;
        let results;
        try {
          results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
        } catch (err) {
          console.warn("MediaPipe detectForVideo error caught to prevent crash:", err);
        }

        if (results && results.landmarks && results.landmarks.length > 0) {
          const hands = results.landmarks.map((landmarks, index) => {
            const x = landmarks.reduce((acc, l) => acc + l.x, 0) / landmarks.length;
            const y = landmarks.reduce((acc, l) => acc + l.y, 0) / landmarks.length;
            
            const wrist = landmarks[0];
            const middleMCP = landmarks[9];
            const scale = Math.sqrt(
              Math.pow(wrist.x - middleMCP.x, 2) + 
              Math.pow(wrist.y - middleMCP.y, 2)
            ) * 4;

            // Calculate Hand Span Area (Polygon of tips + wrist)
            // Normalizing by scale squared to make it distance-independent
            const points = [0, 4, 8, 12, 16, 20].map(idx => ({
              x: (landmarks[idx].x - wrist.x) / (scale || 1),
              y: (landmarks[idx].y - wrist.y) / (scale || 1)
            }));
            
            // Shoelace formula for area
            let area = 0;
            for (let i = 0; i < points.length; i++) {
              const j = (i + 1) % points.length;
              area += points[i].x * points[j].y;
              area -= points[j].x * points[i].y;
            }
            area = Math.abs(area) / 2;

            // Explicit Finger Extension Detection to guarantee instant release when hand is opened
            const isIndexExtended = landmarks[8].y < landmarks[6].y;
            const isMiddleExtended = landmarks[12].y < landmarks[10].y;
            const isRingExtended = landmarks[16].y < landmarks[14].y;
            const isPinkyExtended = landmarks[20].y < landmarks[18].y;
            
            let extendedCount = 0;
            if (isIndexExtended) extendedCount++;
            if (isMiddleExtended) extendedCount++;
            if (isRingExtended) extendedCount++;
            if (isPinkyExtended) extendedCount++;

            // Normalized Area Range: approx 0.02 (closed) to 0.55 (open)
            // Widened the range to 0.55 to make it start decreasing much later
            let avgCurl = Math.max(0, Math.min(1, (0.5 - area) / 0.48));

            // If at least 2 major fingers are extended, the hand is definitely NOT a fist (force open state)
            if (extendedCount >= 2) {
              avgCurl = 0;
            }

            // Only trigger isFist at the very last moment (92% closed AND no more than 1 finger extended)
            const isFist = avgCurl > 0.92 && extendedCount <= 1;

            // Advanced Snap Detection
            const thumbTip = landmarks[4];
            const middleTip = landmarks[12];
            const indexTip = landmarks[8];
            const indexMCP = landmarks[6];
            
            const isIndexCurled = indexTip.y > indexMCP.y;
            const pinchDist = Math.sqrt(Math.pow(thumbTip.x - middleTip.x, 2) + Math.pow(thumbTip.y - middleTip.y, 2));

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
    }
    requestRef.current = requestAnimationFrame(detect);
  };

  useEffect(() => {
    if (isReady && enabled) {
      detect();
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isReady, enabled]);

  return handData;
}
