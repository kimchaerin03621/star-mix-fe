import { useEffect, useRef, useState } from 'react';
import { HAND_GESTURE_CONFIG as CONFIG } from './gestureConfig';

// Fires `onTrigger` once the rock sign has been held for ROCK_HOLD_MS.
// Returns the hold progress (0..1) for on-screen feedback. After firing, the
// sign has to be released before it can fire again, and a short dropout in
// tracking does not reset the hold.
export function useUnmixGesture(handData, enabled, onTrigger) {
  const [progress, setProgress] = useState(0);
  const holdStartRef = useRef(null);
  const lastSeenRef = useRef(0);
  const armedRef = useRef(true);
  const onTriggerRef = useRef(onTrigger);

  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    const now = performance.now();
    const rockHand = enabled ? handData.find((hand) => hand.gestures?.rock) : null;

    if (!rockHand) {
      if (now - lastSeenRef.current > CONFIG.ROCK_GRACE_MS) {
        holdStartRef.current = null;
        armedRef.current = true;
        setProgress(0);
      }
      return;
    }

    lastSeenRef.current = now;
    if (!armedRef.current) return;
    if (holdStartRef.current === null) holdStartRef.current = now;

    const nextProgress = Math.min(1, (now - holdStartRef.current) / CONFIG.ROCK_HOLD_MS);
    if (nextProgress >= 1) {
      armedRef.current = false;
      holdStartRef.current = null;
      setProgress(0);
      onTriggerRef.current();
    } else {
      setProgress(nextProgress);
    }
  }, [handData, enabled]);

  return progress;
}
