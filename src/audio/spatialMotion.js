import * as THREE from 'three';

// Makes a sound's movement through space easier to hear. Real 3D audio is subtle: a star
// that moves only changes a little in level and angle. Three things are exaggerated, all
// worked out from where the star is relative to the listener's head:
//   - its direction: sideways and up/down angles are widened, so moving it across the front
//     swings the sound further left and right (straight ahead stays straight ahead);
//   - its loudness: nearer is clearly louder, farther clearly quieter;
//   - its brightness: farther sounds lose their high frequencies, like sound across a room.
// A star at its starting distance sounds exactly as it did before.
export const SPATIAL_MOTION = {
  AZIMUTH_STRETCH: 1.4, // sideways angle times this
  ELEVATION_STRETCH: 1.3, // up/down angle times this
  REFERENCE_DISTANCE: 4.2, // the distance the stars start at: level 1, bright
  LOUDNESS_CURVE: 1.2, // gain = (reference / distance) ^ this (stars can only go about 8 m out)
  MIN_GAIN: 0.2,
  MAX_GAIN: 2.0,
  BRIGHT_CUTOFF_HZ: 20000, // lowpass when at or nearer than the reference distance
  MIN_CUTOFF_HZ: 2800, // and the darkest it gets, far away
  CUTOFF_CURVE: 1.4,
};

const MAX_AZIMUTH = Math.PI * 0.98;
const MAX_ELEVATION = Math.PI * 0.45;

const inverse = new THREE.Quaternion();
const local = new THREE.Vector3();

// Where the sound is placed for a star at `starPosition`, for a head at `headPosition` facing
// `headQuaternion`. Same distance as the star, wider angles. Writes into `out`.
export function placeSound(out, starPosition, headPosition, headQuaternion) {
  local.subVectors(starPosition, headPosition);
  const distance = local.length();
  if (distance < 0.05) return out.copy(starPosition);

  inverse.copy(headQuaternion).invert();
  local.applyQuaternion(inverse);

  // Head space: -z is straight ahead, +x is to the right, +y is up.
  const azimuth = Math.atan2(local.x, -local.z);
  const elevation = Math.asin(THREE.MathUtils.clamp(local.y / distance, -1, 1));
  const wideAzimuth = THREE.MathUtils.clamp(azimuth * SPATIAL_MOTION.AZIMUTH_STRETCH, -MAX_AZIMUTH, MAX_AZIMUTH);
  const wideElevation = THREE.MathUtils.clamp(elevation * SPATIAL_MOTION.ELEVATION_STRETCH, -MAX_ELEVATION, MAX_ELEVATION);

  local.set(
    Math.sin(wideAzimuth) * Math.cos(wideElevation),
    Math.sin(wideElevation),
    -Math.cos(wideAzimuth) * Math.cos(wideElevation),
  ).multiplyScalar(distance);
  return out.copy(local.applyQuaternion(headQuaternion)).add(headPosition);
}

// Level for a sound at this distance from the head.
export function distanceGain(distance) {
  const { REFERENCE_DISTANCE, LOUDNESS_CURVE, MIN_GAIN, MAX_GAIN } = SPATIAL_MOTION;
  const gain = (REFERENCE_DISTANCE / Math.max(distance, 0.1)) ** LOUDNESS_CURVE;
  return Math.min(MAX_GAIN, Math.max(MIN_GAIN, gain));
}

// Where the lowpass sits for a sound at this distance: wide open up to the reference distance.
export function distanceCutoff(distance) {
  const { REFERENCE_DISTANCE, CUTOFF_CURVE, BRIGHT_CUTOFF_HZ, MIN_CUTOFF_HZ } = SPATIAL_MOTION;
  if (distance <= REFERENCE_DISTANCE) return BRIGHT_CUTOFF_HZ;
  const cutoff = BRIGHT_CUTOFF_HZ * (REFERENCE_DISTANCE / distance) ** CUTOFF_CURVE;
  return Math.max(MIN_CUTOFF_HZ, cutoff);
}
