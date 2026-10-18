import * as THREE from 'three';

// Where a node sits at a given moment. The shaders (StarNebula) and the bridges
// between stars (NebulaBridges) must agree exactly, so the formula lives here once:
// GLSL for the GPU, and a JS twin of it for the CPU.

// How far the nodes facing a neighbouring star stretch toward it (world units).
export const PULL_REACH = 0.9;

export const PLACEMENT_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uShape;
  uniform float uWobble;
  uniform float uPulse;
  uniform vec3 uPullDir;
  uniform float uPull;
  vec3 place(vec3 cloud, vec3 shape, float seed) {
    float t = uTime * (0.35 + seed * 0.5);
    vec3 wriggle = vec3(
      sin(t + seed * 13.0),
      sin(t * 1.27 + seed * 29.0),
      sin(t * 0.83 + seed * 47.0)
    ) * uWobble;
    vec3 base = mix(cloud, shape, uShape) * (1.0 + uPulse * 0.18);
    float facing = max(dot(normalize(base + vec3(0.0001)), uPullDir), 0.0);
    return base + uPullDir * (uPull * ${PULL_REACH.toFixed(3)} * facing * facing) + wriggle;
  }
`;

const scratch = new THREE.Vector3();

// JS twin of `place()`. `state` = { time, shape, wobble, pulse, pullDir, pull }.
export function placeNode(out, cloud, shape, seed, state) {
  const t = state.time * (0.35 + seed * 0.5);
  const grow = 1 + state.pulse * 0.18;
  out.set(
    (cloud[0] + (shape[0] - cloud[0]) * state.shape) * grow,
    (cloud[1] + (shape[1] - cloud[1]) * state.shape) * grow,
    (cloud[2] + (shape[2] - cloud[2]) * state.shape) * grow,
  );
  scratch.copy(out).addScalar(0.0001).normalize();
  const facing = Math.max(scratch.dot(state.pullDir), 0);
  out.addScaledVector(state.pullDir, state.pull * PULL_REACH * facing * facing);
  out.x += Math.sin(t + seed * 13) * state.wobble;
  out.y += Math.sin(t * 1.27 + seed * 29) * state.wobble;
  out.z += Math.sin(t * 0.83 + seed * 47) * state.wobble;
  return out;
}
