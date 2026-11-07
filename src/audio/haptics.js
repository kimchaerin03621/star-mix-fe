// The low end of the music in the hands: a short buzz in the controllers on each strong hit, so the
// bass and drums are felt as well as heard. Quest only (a desktop has no controllers to buzz).
export const HAPTICS = {
  MAX_STRENGTH: 0.5, // never stronger than this (0..1): a hand-held motor, not a speaker
  DURATION_MS: 45, // one buzz
  MIN_GAP_MS: 90, // buzzes never closer than this, so a busy beat is a texture, not a constant hum
  HELD_BOOST: 1.8, // holding a star, you feel it more
  // How much each instrument is felt: the low ones most.
  FELT: { drum: 1, bass: 1, piano: 0.3, guitar: 0.3, vocal: 0.2 },
};

let lastBuzz = 0;

// `strength` is 0..1 (an instrument's weight times how hard the hit was).
export function buzzControllers(session, strength, held = false) {
  if (!session || strength <= 0) return;
  const now = performance.now();
  if (now - lastBuzz < HAPTICS.MIN_GAP_MS) return;
  lastBuzz = now;
  const level = Math.min(HAPTICS.MAX_STRENGTH, strength * HAPTICS.MAX_STRENGTH * (held ? HAPTICS.HELD_BOOST : 1));
  for (const source of session.inputSources ?? []) {
    try {
      const gamepad = source.gamepad;
      const actuator = gamepad?.hapticActuators?.[0];
      if (actuator?.pulse) actuator.pulse(level, HAPTICS.DURATION_MS);
      else gamepad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: HAPTICS.DURATION_MS, strongMagnitude: level, weakMagnitude: level * 0.6 });
    } catch {
      // A controller that refuses a buzz is simply skipped.
    }
  }
}
