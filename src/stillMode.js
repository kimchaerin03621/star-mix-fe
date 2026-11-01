// Still mode (open the app with `?still`): everything that moves by itself is switched off, so a
// scene can be arranged by hand with the mouse and photographed. It only turns things off for
// that visit; nothing is removed, and without `?still` the app behaves exactly as before.
//   - no music, so stars do not pulse to it
//   - no webcam hand tracking
//   - no automatic return to the galaxy
//   - hovering a star does not draw its instrument
export const isStillMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('still');
