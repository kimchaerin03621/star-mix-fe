import { useEffect, useRef } from 'react';

const CHECK_INTERVAL_MS = 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart'];

// Calls `onIdle` once nobody has used the experience for `idleMs`, so the next
// visitor starts from the beginning. Hands in view, the mouse and the keyboard
// all count as activity.
export function useIdleReturn(handData, enabled, onIdle, idleMs) {
  const lastActivityRef = useRef(0);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (handData.length > 0) lastActivityRef.current = performance.now();
  }, [handData]);

  useEffect(() => {
    if (!enabled) return undefined;

    lastActivityRef.current = performance.now();
    const markActive = () => { lastActivityRef.current = performance.now(); };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, markActive));

    const timer = setInterval(() => {
      if (performance.now() - lastActivityRef.current >= idleMs) {
        lastActivityRef.current = performance.now();
        onIdleRef.current();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, markActive));
    };
  }, [enabled, idleMs]);
}
