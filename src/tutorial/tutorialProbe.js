// What the tutorial needs to know about the scene, written every frame by the 3D side and read by the
// tutorial a few times a second. It is a plain object (no React state), so nothing re-renders.
// It follows the scene, not the input device, so a hand and a mouse count the same.
export const tutorialProbe = {
  flightDone: false, // the entry fly-in has finished (or was skipped)
  heldKey: null, // the region being held right now (by hand or mouse), if any
  heldDistance: 0, // how far the held region is from the viewer's head
  heldPosition: [0, 0, 0],
  holdFrom: [0, 0, 0], // where the held region was, and how far from the head, when it was grabbed
  holdDistance: 0,
  cameraForward: [0, 0, -1], // which way the view faces
  cameraDistance: 1, // how far the view is from the point it turns around (zoom)
  lastInputAt: 0, // when a hand or the mouse last did something
};

// Dev only: lets the tests (and a curious developer) read it.
if (import.meta.env?.DEV && typeof window !== 'undefined') window.__tutorialProbe = tutorialProbe;
