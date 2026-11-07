// A large hall's reverb, made from noise that dies away: no sound file needed. Sent from the mix
// and added back quietly, it makes the space around the stars feel vast.
export const REVERB = {
  SECONDS: 3.6, // how long the tail rings
  DECAY: 2.4, // higher = the tail drops away faster at first
  PRE_DELAY: 0.03, // seconds before the tail starts, so the dry sound stays clear
  DARKEN: 0.55, // 0..1: how much the tail loses its highs as it fades (a hall absorbs treble)
  WET: 0.3, // how loud the tail is against the dry sound
};

export function createHallImpulse(ctx) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * REVERB.SECONDS);
  const delay = Math.floor(rate * REVERB.PRE_DELAY);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let i = delay; i < length; i += 1) {
      const t = (i - delay) / (length - delay);
      const noise = Math.random() * 2 - 1;
      // One-pole lowpass whose cutoff falls as the tail fades: the highs die first.
      const smooth = 1 - REVERB.DARKEN * (0.3 + 0.7 * t);
      low += (noise - low) * smooth;
      data[i] = low * Math.pow(1 - t, REVERB.DECAY);
    }
  }
  return buffer;
}

// Adds the reverb to a mix: `from` goes on to `to` as before, and a quiet copy of it also goes
// through the hall and into `to`.
export function addHallReverb(ctx, from, to) {
  const convolver = ctx.createConvolver();
  convolver.buffer = createHallImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = REVERB.WET;
  from.connect(convolver);
  convolver.connect(wet);
  wet.connect(to);
  return { convolver, wet };
}
