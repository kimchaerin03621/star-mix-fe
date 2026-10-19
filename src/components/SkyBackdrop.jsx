import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getNebulae } from './nebula/nebulaRegistry';

// The dome behind everything: deep night sky with faint drifting clouds. It also
// listens to the music: each sounding star lights up the patch of sky around its
// own direction in its own color, so a loud drum fills the right side with white
// glow while a quiet bass leaves the left dark.
const MAX_STARS = 8;
const SKY_RADIUS = 45;
const REST_LEVEL = 0.04; // a star lights its patch of sky a little even when quiet
const SOUND_LEVEL_GAIN = 0.9; // how much its current loudness adds on top
const HIT_GAIN = 0.7;
const MAX_LEVEL = 0.9; // a star can never light its patch of sky beyond this // extra light on each new hit
const LEVEL_RISE_PER_SECOND = 16; // light comes up fast so a hit is seen...
const LEVEL_FALL_PER_SECOND = 4; // ...and fades slowly

const VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uStarDir[${MAX_STARS}];
  uniform vec3 uStarColor[${MAX_STARS}];
  uniform float uStarLevel[${MAX_STARS}];
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }
  float fbm(vec3 p) {
    float amplitude = 0.5;
    float sum = 0.0;
    for (int i = 0; i < 3; i++) {
      sum += amplitude * noise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      amplitude *= 0.5;
    }
    return sum;
  }

  void main() {
    vec3 dir = normalize(vDir);
    vec3 drift = vec3(uTime * 0.008, 0.0, uTime * 0.006);
    float cloud = smoothstep(0.42, 0.85, fbm(dir * 2.2 + drift));
    float hue = fbm(dir * 1.3 + vec3(5.0));
    vec3 tint = mix(vec3(0.38, 0.12, 0.46), vec3(0.10, 0.22, 0.52), hue);
    vec3 color = vec3(0.010, 0.012, 0.028) + tint * cloud * 0.07;

    for (int i = 0; i < ${MAX_STARS}; i++) {
      float facing = max(dot(dir, uStarDir[i]), 0.0);
      float halo = pow(facing, 10.0) * 0.28 + pow(facing, 36.0) * 0.5;
      // The clouds near a sounding star catch its light more than the empty sky does.
      color += uStarColor[i] * halo * uStarLevel[i] * (0.6 + cloud * 0.5);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

const colorCache = new Map();
const colorOf = (value) => {
  if (!colorCache.has(value)) colorCache.set(value, new THREE.Color(value));
  return colorCache.get(value);
};

// One sky exists at a time, so its uniforms live here and the frame loop updates them directly.
const skyUniforms = {
  uTime: { value: 0 },
  uStarDir: { value: Array.from({ length: MAX_STARS }, () => new THREE.Vector3(0, 0, -1)) },
  uStarColor: { value: Array.from({ length: MAX_STARS }, () => new THREE.Color(0, 0, 0)) },
  uStarLevel: { value: new Array(MAX_STARS).fill(0) },
};

export function SkyBackdrop() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
  }), []);

  const domeRef = useRef();
  const scratch = useMemo(() => ({ position: new THREE.Vector3() }), []);

  // Dev-only: lets the tests read what each star sounds like right now.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__starMixSound = () => [...getNebulae().entries()].map(([key, entry]) => ({
      key,
      pulse: entry.state.pulse,
      vol: entry.state.vol,
      low: entry.state.low,
      high: entry.state.high,
      hit: entry.state.hit,
    }));
    return () => { delete window.__starMixSound; };
  }, []);

  useFrame((state, delta) => {
    const { uTime, uStarDir, uStarColor, uStarLevel } = skyUniforms;
    uTime.value = state.clock.elapsedTime;
    // The dome travels with the viewer (it is the far sky), and each star's glow is measured
    // from where the viewer actually is, so it sits right behind the star from any angle.
    const viewer = state.camera.position;
    if (domeRef.current) domeRef.current.position.copy(viewer);
    const rise = 1 - Math.exp(-delta * LEVEL_RISE_PER_SECOND);
    const fall = 1 - Math.exp(-delta * LEVEL_FALL_PER_SECOND);

    const entries = [...getNebulae().values()].filter((entry) => entry.group.current);
    for (let i = 0; i < MAX_STARS; i += 1) {
      const entry = entries[i];
      if (!entry) {
        uStarLevel.value[i] += (0 - uStarLevel.value[i]) * fall;
        continue;
      }
      entry.group.current.getWorldPosition(scratch.position);
      uStarDir.value[i].copy(scratch.position).sub(viewer).normalize();
      // Pale stars (white, silver) would turn the sky milky grey, so their light is dimmed.
      const color = colorOf(entry.color);
      const luma = color.r * 0.3 + color.g * 0.59 + color.b * 0.11;
      uStarColor.value[i].copy(color).multiplyScalar(1 - 0.55 * THREE.MathUtils.smoothstep(luma, 0.45, 0.85));
      const target = Math.min(MAX_LEVEL, REST_LEVEL + entry.state.pulse * SOUND_LEVEL_GAIN + (entry.state.hit ?? 0) * HIT_GAIN);
      uStarLevel.value[i] += (target - uStarLevel.value[i]) * (target > uStarLevel.value[i] ? rise : fall);
    }
  });

  return (
    <mesh ref={domeRef} scale={[SKY_RADIUS, SKY_RADIUS, SKY_RADIUS]} raycast={() => null} renderOrder={-10}>
      <sphereGeometry args={[1, 48, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
