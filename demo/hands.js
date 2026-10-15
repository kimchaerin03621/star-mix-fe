// Builds hands shaped exactly like the output of src/hooks/useHandTracking.js, so
// the scripted demo drives the app the way a real, recognised hand would.

const POSES = {
  openPalm: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  fist: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  rock: { thumb: false, index: true, middle: false, ring: false, pinky: true },
  indexOnly: { thumb: false, index: true, middle: false, ring: false, pinky: false },
  thumbOnly: { thumb: true, index: false, middle: false, ring: false, pinky: false },
  cameraMove: { thumb: true, index: true, middle: true, ring: false, pinky: false },
};

// `x`/`y` are where the hand appears on screen (0..1 from the top-left). The
// tracker reports the mirrored camera image, hence `1 - x` below.
export function makeHand({ id, handedness = 'Right', x, y, pose, scale = 0.65 }) {
  const fingers = POSES[pose];
  const cameraX = 1 - x;
  return {
    x: cameraX,
    y,
    scale,
    fingers,
    isFist: pose === 'fist',
    thumbIndexDistance: pose === 'openPalm' ? 1.4 : 1.8,
    thumbIndexReach: pose === 'fist' ? 0.9 : 2.2,
    thumbIndexAngle: 35,
    thumbTip: { x: cameraX + 0.02, y: y - 0.03 },
    indexTip: { x: cameraX - 0.02, y: y - 0.06 },
    timestamp: performance.now(),
    trackingId: id,
    handedness,
    gestures: {
      openPalm: pose === 'openPalm',
      indexOnly: pose === 'indexOnly',
      thumbOnly: pose === 'thumbOnly',
      cameraMove: pose === 'cameraMove',
      zoom: false,
      rock: pose === 'rock',
    },
  };
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = easeInOut;
