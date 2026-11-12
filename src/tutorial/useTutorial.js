import { useCallback, useEffect, useRef, useState } from 'react';
import { TUTORIAL, TUTORIAL_STEPS } from './tutorialSteps';
import { tutorialProbe } from './tutorialProbe';

// The tutorial's flow:
//   waiting -> intro (explanation) -> doing (they try it) -> success -> between -> next intro ... -> finale -> done
//  - waiting: until the scene is at rest and the visitor starts using a hand or the mouse
//  - intro:   the translucent explanation; the button closes it
//  - doing:   one line at the bottom while they try; success is read from the scene (tutorialProbe)

const angleBetween = (a, b) => {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, dot)));
};
const distanceBetween = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Did the visitor do this step? `watch` is this step's scratch: what the scene looked like when they began.
function didIt(stepId, probe, watch) {
  if (stepId === 'orbit') {
    watch.turned += angleBetween(watch.forward, probe.cameraForward);
    watch.forward = [...probe.cameraForward];
    return watch.turned >= TUTORIAL.TURN_RADIANS;
  }
  if (stepId === 'zoom') {
    watch.zoomed += Math.abs(Math.log(Math.max(probe.cameraDistance, 0.01) / Math.max(watch.zoomDistance, 0.01)));
    watch.zoomDistance = probe.cameraDistance;
    return watch.zoomed >= TUTORIAL.ZOOM_LOG;
  }

  // The rest are about the held region, measured from where it was when it was grabbed.
  if (!probe.heldKey) return false;
  if (stepId === 'grab') return distanceBetween(probe.heldPosition, probe.holdFrom) >= TUTORIAL.MOVE_TO_GRAB;
  if (stepId === 'push') return probe.heldDistance - probe.holdDistance >= TUTORIAL.DEPTH_CHANGE;
  if (stepId === 'pull') return probe.holdDistance - probe.heldDistance >= TUTORIAL.DEPTH_CHANGE;
  return false;
}

export function useTutorial({ enabled, handData }) {
  // ?tutorial=3 opens straight on step 3 (for reviewing the wording and the drawings).
  const [state, setState] = useState(() => {
    const jump = Number(new URLSearchParams(window.location.search).get('tutorial'));
    return jump >= 1 && jump <= TUTORIAL_STEPS.length ? { phase: 'intro', step: jump - 1 } : { phase: 'waiting', step: 0 };
  });
  const stateRef = useRef(state);
  const watchRef = useRef(null);
  const readySinceRef = useRef(0);
  const timersRef = useRef([]);

  const go = useCallback((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const later = useCallback((ms, action) => {
    timersRef.current.push(setTimeout(action, ms));
  }, []);

  // A hand showing up or the mouse moving is "the visitor is here".
  useEffect(() => {
    if (!enabled) return undefined;
    const mark = () => { tutorialProbe.lastInputAt = performance.now(); };
    const events = ['pointermove', 'pointerdown', 'wheel', 'keydown'];
    events.forEach((name) => window.addEventListener(name, mark, { passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, mark));
  }, [enabled]);
  useEffect(() => {
    if (enabled && handData.length > 0) tutorialProbe.lastInputAt = performance.now();
  }, [enabled, handData]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => {
      const now = performance.now();
      const current = stateRef.current;
      const probe = tutorialProbe;

      if (current.phase === 'waiting') {
        const active = probe.flightDone && now - probe.lastInputAt < TUTORIAL.ACTIVE_WINDOW_MS;
        if (!active) { readySinceRef.current = 0; return; }
        if (!readySinceRef.current) readySinceRef.current = now;
        if (now - readySinceRef.current >= TUTORIAL.START_DELAY_MS) go({ phase: 'intro', step: 0 });
        return;
      }

      if (current.phase === 'doing') {
        const step = TUTORIAL_STEPS[current.step];
        if (!didIt(step.id, probe, watchRef.current)) return;
        const isLast = current.step >= TUTORIAL_STEPS.length - 1;
        go({ phase: 'success', step: current.step });
        later(TUTORIAL.SUCCESS_MS, () => {
          if (isLast) {
            go({ phase: 'finale', step: current.step });
            later(TUTORIAL.FINALE_MS, () => go({ phase: 'done', step: current.step }));
          } else {
            go({ phase: 'between', step: current.step });
            later(TUTORIAL.NEXT_DELAY_MS, () => go({ phase: 'intro', step: current.step + 1 }));
          }
        });
      }
    }, 100);
    return () => {
      clearInterval(timer);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [enabled, go, later]);

  // The button: close the explanation and start watching for the visitor to do it.
  const confirm = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'intro') return;
    watchRef.current = {
      turned: 0,
      forward: [...tutorialProbe.cameraForward],
      zoomed: 0,
      zoomDistance: tutorialProbe.cameraDistance,
    };
    go({ phase: 'doing', step: current.step });
  }, [go]);

  const skip = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    go({ phase: 'done', step: stateRef.current.step });
  }, [go]);

  // Enter / Space confirms, Escape skips the whole tutorial.
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event) => {
      if (stateRef.current.phase === 'intro' && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        confirm();
      } else if (event.key === 'Escape' && stateRef.current.phase !== 'done') {
        skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, confirm, skip]);

  return { ...state, confirm, skip };
}
