import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HAND_GESTURE_CONFIG as CONFIG } from '../hand-tracking/gestureConfig';

const distance2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const angleBetween2D = (origin, a, b) => {
  const ax = a.x - origin.x;
  const ay = a.y - origin.y;
  const bx = b.x - origin.x;
  const by = b.y - origin.y;
  const magnitude = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (magnitude === 0) return 0;
  const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / magnitude));
  return Math.acos(cosine) * (180 / Math.PI);
};

const isFingerExtended = (landmarks, tipIndex, pipIndex, margin = 1.12) => {
  const wrist = landmarks[0];
  return distance2D(landmarks[tipIndex], wrist) > distance2D(landmarks[pipIndex], wrist) * margin;
};

export function useHandTracking(videoRef, enabled = true) {
  const [handData, setHandData] = useState([]); 
  const [isReady, setIsReady] = useState(false);
  const landmarkerRef = useRef(null);
  const requestRef = useRef();
  const lastDetectTimeRef = useRef(0);
  
  const trackedHandsRef = useRef([]);
  const nextTrackingIdRef = useRef(1);

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
          const detections = results.landmarks.map((landmarks, index) => {
            const wrist = landmarks[0];
            const middleMCP = landmarks[9];
            const palmLandmarks = [wrist, landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
            const x = palmLandmarks.reduce((sum, point) => sum + point.x, 0) / palmLandmarks.length;
            const y = palmLandmarks.reduce((sum, point) => sum + point.y, 0) / palmLandmarks.length;
            const palmSize = Math.max(distance2D(wrist, middleMCP), 0.001);
            const scale = palmSize * 4;

            const fingers = {
              thumb: isFingerExtended(landmarks, 4, 3, 1.08),
              index: isFingerExtended(landmarks, 8, 6),
              middle: isFingerExtended(landmarks, 12, 10),
              ring: isFingerExtended(landmarks, 16, 14),
              pinky: isFingerExtended(landmarks, 20, 18),
            };

            const thumbIndexDistance = distance2D(landmarks[4], landmarks[8]) / palmSize;
            const thumbIndexMidpoint = {
              x: (landmarks[4].x + landmarks[8].x) / 2,
              y: (landmarks[4].y + landmarks[8].y) / 2,
            };
            const thumbIndexReach = distance2D(wrist, thumbIndexMidpoint) / palmSize;
            const fourFingersFolded = !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;
            // In a fist, the thumb/index tips stay close to the palm. During a
            // pinch they may touch each other, but the joined tips remain
            // extended away from the wrist.
            const isFist = fourFingersFolded && thumbIndexReach < CONFIG.FIST_TIP_REACH_THRESHOLD;
            const zoomAngleOrigin = {
              x: (landmarks[2].x + landmarks[5].x) / 2,
              y: (landmarks[2].y + landmarks[5].y) / 2,
            };
            const thumbIndexAngle = angleBetween2D(zoomAngleOrigin, landmarks[4], landmarks[8]);
            const rawHandedness = results.handednesses?.[index]?.[0]?.categoryName || 'Unknown';
            const handednessScore = results.handednesses?.[index]?.[0]?.score || 0;

            return {
              x,
              y,
              scale,
              fingers,
              isFist,
              thumbIndexDistance,
              thumbIndexReach,
              thumbIndexAngle,
              thumbTip: { x: landmarks[4].x, y: landmarks[4].y },
              indexTip: { x: landmarks[8].x, y: landmarks[8].y },
              rawHandedness,
              handednessScore,
              timestamp: now,
            };
          });

          const previousTracks = trackedHandsRef.current;
          const usedTrackIds = new Set();
          const nextTracks = [];
          const hands = detections.map((detection) => {
            let bestTrack = null;
            let bestDistance = Infinity;
            previousTracks.forEach((track) => {
              if (usedTrackIds.has(track.id)) return;
              const positionDistance = Math.hypot(detection.x - track.x, detection.y - track.y);
              const handednessPenalty = track.handedness === detection.rawHandedness ? 0 : 0.06;
              const score = positionDistance + handednessPenalty;
              if (positionDistance < 0.28 && score < bestDistance) {
                bestDistance = score;
                bestTrack = track;
              }
            });

            const track = bestTrack || {
              id: nextTrackingIdRef.current++,
              handedness: detection.rawHandedness,
              pendingHandedness: null,
              pendingFrames: 0,
            };
            usedTrackIds.add(track.id);

            if (detection.rawHandedness !== track.handedness && detection.handednessScore >= 0.7) {
              if (track.pendingHandedness === detection.rawHandedness) track.pendingFrames += 1;
              else {
                track.pendingHandedness = detection.rawHandedness;
                track.pendingFrames = 1;
              }
              if (track.pendingFrames >= 5) {
                track.handedness = detection.rawHandedness;
                track.pendingHandedness = null;
                track.pendingFrames = 0;
              }
            } else {
              track.pendingHandedness = null;
              track.pendingFrames = 0;
            }

            track.x = detection.x;
            track.y = detection.y;
            nextTracks.push(track);

            const { thumb, index, middle, ring, pinky } = detection.fingers;
            // A real pinch often bends the index tip enough that the generic
            // "finger extended" test becomes false. Keep Zoom active through
            // that final pinch range, while a separated Thumb Only pose remains
            // available for depth control.
            const isZoom = !detection.isFist && thumb && !middle && !ring && !pinky && (
              index || detection.thumbIndexDistance <= CONFIG.ZOOM_PINCH_DISTANCE
            );
            return {
              ...detection,
              trackingId: track.id,
              handedness: track.handedness,
              gestures: {
                openPalm: thumb && index && middle && ring && pinky,
                indexOnly: !thumb && index && !middle && !ring && !pinky,
                thumbOnly: thumb && !index && !middle && !ring && !pinky && !isZoom,
                cameraMove: thumb && index && middle && !ring && !pinky,
                zoom: isZoom,
              },
            };
          });

          trackedHandsRef.current = nextTracks;
          setHandData(hands.map((hand) => ({
            x: hand.x,
            y: hand.y,
            scale: hand.scale,
            fingers: hand.fingers,
            isFist: hand.isFist,
            thumbIndexDistance: hand.thumbIndexDistance,
            thumbIndexReach: hand.thumbIndexReach,
            thumbIndexAngle: hand.thumbIndexAngle,
            thumbTip: hand.thumbTip,
            indexTip: hand.indexTip,
            timestamp: hand.timestamp,
            trackingId: hand.trackingId,
            handedness: hand.handedness,
            gestures: hand.gestures,
          })));
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
