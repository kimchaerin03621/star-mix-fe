import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FOCUS, LIQUID, MOTION, OCCLUDER, PLAIN, REGION, SHOCK, WAVE, WEB, WHITE_GRAPH_CENTER } from './graphConstants';
import { buildGraph, growRegions, nearestNode } from './graphLayout';
import { getRegions, regionShapes } from './graphRegistry';
import { isStillMode } from '../../stillMode';
import { readHeadPose } from '../../headPose';
import { buzzControllers, HAPTICS } from '../../audio/haptics';

// The space itself: a huge white Obsidian-style graph around the listener, in 3D. Each
// instrument colors one region of it (the nodes within a few links of its sounding node).
// Every other node stays as a flat, faint dot, with no effects at all. The graph never moves,
// only the colored regions do.
const MAX_REGIONS = 8;
const WOBBLE = 0.05; // how much farther a colored node drifts (meters), on top of the current every node follows
const NEAR_FADE = [1.2, 3.2]; // nodes closer to the eye than this fade out (a big blurry dot in your face is only a smudge)
const MAX_SCREEN_SIZE = 0.09; // no node is drawn bigger than this share of its distance to the eye
const FAR_DIM = [2.5, 12]; // colored nodes dim between these distances, for depth
const CORE_SIZE = 1.5; // a colored node is a solid disc this many times the node's size
const HALO_SIZE = 6.5; // soft pastel underlay around a colored node, in node sizes
const HALO_ALPHA = 0.14;
const HALO_PASTEL = 0.62; // how far the underlay's color is pulled toward white (same hue, lighter)

const SHARED_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec3 uEye;
  uniform vec3 uColor[${MAX_REGIONS}];
  uniform float uLevel[${MAX_REGIONS}];
  uniform float uHigh[${MAX_REGIONS}];
  uniform float uHit[${MAX_REGIONS}];
  uniform float uAge[${MAX_REGIONS}];
  uniform float uFocus[${MAX_REGIONS}];
  uniform vec3 uSeed[${MAX_REGIONS}];
  uniform vec3 uHoldPos[${MAX_REGIONS}];
  uniform vec3 uHoldOffset[${MAX_REGIONS * LIQUID.VARIANTS}];
  uniform float uHoldPull[${MAX_REGIONS}];
  uniform float uHoldSpeed[${MAX_REGIONS}];
  uniform float uSwell[${MAX_REGIONS}];
  uniform float uMusic;
  uniform float uShock[${MAX_REGIONS}];
  uniform float uShockAge[${MAX_REGIONS * SHOCK.SLOTS}];
  uniform float uShockPower[${MAX_REGIONS * SHOCK.SLOTS}];
  uniform float uBreath;
  uniform float uKick[${MAX_REGIONS}];
  uniform float uRegionRadius[${MAX_REGIONS}];
  attribute vec3 aPos;
  attribute float aSeed;
  attribute float aRegion;
  attribute float aAmount;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;

  // Only colored nodes drift; amount is how colored the point is.
  // A slow current that moves the whole graph like something alive. It depends only on where a
  // point is, so neighbouring nodes drift together (a swell, not a tremble), and a link follows
  // its two nodes without stretching oddly.
  vec3 current(vec3 p) {
    float t = uTime * ${MOTION.SPEED.toFixed(2)};
    vec3 q = p * ${MOTION.SCALE.toFixed(2)};
    // Two layers of swell, one broad and one tighter, so the motion never settles into a pattern.
    vec3 broad = vec3(
      sin(q.y * 1.3 + t) + sin(q.z * 0.9 - t * 0.7),
      sin(q.z * 1.1 + t * 0.8) + sin(q.x * 0.7 + t * 0.6),
      sin(q.x * 1.2 - t * 0.9) + sin(q.y * 0.8 + t * 0.5)
    );
    vec3 r = p * ${(MOTION.SCALE * 2.3).toFixed(2)};
    vec3 fine = vec3(
      sin(r.z * 1.2 - t * 1.3) + sin(r.y * 0.8 + t * 0.9),
      sin(r.x * 1.1 + t * 1.1) + sin(r.z * 0.9 - t * 0.8),
      sin(r.y * 1.3 - t * 1.0) + sin(r.x * 0.7 + t * 1.2)
    );
    return (broad + fine * ${MOTION.FINE.toFixed(2)}) * ${(MOTION.DISTANCE / 2).toFixed(3)};
  }

  // A wave that runs outward from each sounding star, as strong as that instrument is loud.
  vec3 ripple(vec3 p) {
    vec3 push = vec3(0.0);
    for (int i = 0; i < ${MAX_REGIONS}; i++) {
      if (uLevel[i] > 0.0) {
        vec3 q = p - uHoldPos[i];
        float r = length(q);
        float wave = sin(r * ${WAVE.FREQUENCY.toFixed(2)} - uTime * ${WAVE.SPEED.toFixed(2)}) * exp(-r * ${WAVE.REACH.toFixed(2)});
        push += q / max(r, 0.001) * wave * uSwell[i] * ${WAVE.RIPPLE.toFixed(3)};
      }
    }
    return push;
  }

  // A held star drags the nodes around it like a liquid: they trail behind it and lean toward it,
  // then (the star stopping) flow back to where they were.
  vec3 liquid(vec3 p, float seed) {
    vec3 push = vec3(0.0);
    for (int i = 0; i < ${MAX_REGIONS}; i++) {
      if (uLevel[i] > 0.0) {
        vec3 q = p - uHoldPos[i];
        float f = exp(-dot(q, q) / ${(LIQUID.RADIUS * LIQUID.RADIUS).toFixed(2)});
        // Each node follows its own spring (one of several, or a blend of two), so they wobble out of step.
        float u = fract(seed * 7.31) * ${(LIQUID.VARIANTS - 1).toFixed(1)};
        int k0 = int(floor(u));
        int k1 = min(k0 + 1, ${LIQUID.VARIANTS - 1});
        vec3 lagOffset = mix(uHoldOffset[i * ${LIQUID.VARIANTS} + k0], uHoldOffset[i * ${LIQUID.VARIANTS} + k1], fract(u));
        // While the star is moving every node keeps wobbling in its own way, in step with the speed.
        vec3 jiggle = vec3(sin(uTime * 5.5 + seed * 31.0), sin(uTime * 6.5 + seed * 17.0), sin(uTime * 4.8 + seed * 43.0)) * uHoldSpeed[i] * ${LIQUID.JIGGLE.toFixed(3)};
        push += (lagOffset * ${LIQUID.LAG_GAIN.toFixed(2)} + jiggle - q * uHoldPull[i] * ${LIQUID.PULL.toFixed(2)}) * f;
      }
    }
    return push;
  }

  // The shell of light a hit sends outward: xyz = its color, w = how strongly this point is in it.
  vec4 shock(vec3 p) {
    float total = 0.0;
    vec3 col = vec3(0.0);
    for (int i = 0; i < ${MAX_REGIONS}; i++) {
      if (uShock[i] > 0.0) {
        float r = length(p - uHoldPos[i]);
        for (int k = 0; k < ${SHOCK.SLOTS}; k++) {
          float age = uShockAge[i * ${SHOCK.SLOTS} + k];
          float d = (r - age * ${SHOCK.SPEED.toFixed(2)}) / ${SHOCK.WIDTH.toFixed(2)};
          float s = exp(-d * d) * exp(-age * ${SHOCK.FADE.toFixed(2)}) * uShock[i] * uShockPower[i * ${SHOCK.SLOTS} + k];
          total += s;
          col += uColor[i] * s;
        }
      }
    }
    return vec4(col / max(total, 0.001), min(total, 1.0));
  }

  // The recoil of a region as its star sends a shell out: it swells from its center, then settles.
  vec3 recoil(vec3 p, float amount) {
    int r = int(aRegion + 0.5);
    if (r < 0) return vec3(0.0);
    return (p - uSeed[r]) * uKick[r] * amount * ${SHOCK.RECOIL.toFixed(3)};
  }

  vec3 drift(vec3 p, float seed, float amount) {
    float t = uTime * (0.25 + seed * 0.3) * 0.5;
    // Each node also has a little life of its own.
    // Every node floats on its own: its own speed, its own direction, its own phase. Nothing is shared.
    float ownTime = uTime * (${MOTION.OWN_SPEED[0].toFixed(2)} + fract(seed * 53.0) * ${(MOTION.OWN_SPEED[1] - MOTION.OWN_SPEED[0]).toFixed(2)});
    float ownSize = 0.6 + 0.4 * fract(seed * 91.0);
    vec3 own = vec3(
      sin(ownTime * 0.9 + seed * 13.0) + 0.4 * sin(ownTime * 1.9 + seed * 71.0),
      sin(ownTime * 1.1 + seed * 29.0) + 0.4 * sin(ownTime * 1.7 + seed * 37.0),
      sin(ownTime * 0.8 + seed * 47.0) + 0.4 * sin(ownTime * 2.1 + seed * 59.0)
    ) * ${MOTION.OWN.toFixed(3)} * ownSize;
    // Colored nodes (a sounding region) move more.
    vec3 lively = vec3(sin(t + seed * 13.0), sin(t * 1.2 + seed * 29.0), sin(t * 0.8 + seed * 47.0)) * ${WOBBLE.toFixed(3)} * amount;
    return p + current(p) * (1.0 + uMusic * ${WAVE.MUSIC_BOOST.toFixed(2)}) + own + lively + ripple(p) + liquid(p, seed) + recoil(p, amount) + (p - vec3(${WHITE_GRAPH_CENTER.map((v) => v.toFixed(2)).join(', ')})) * uBreath * ${SHOCK.BREATH.toFixed(3)};
  }

  // Mixes the region color over the white graph; returns how colored this point is (0..1).
  float tint(float baseWhite) {
    int r = int(aRegion + 0.5);
    float strength = 0.0;
    vec3 regionColor = vec3(1.0);
    if (r >= 0) {
      strength = clamp(pow(aAmount, 0.6) * uLevel[r], 0.0, 1.0);
      regionColor = uColor[r];
    }
    vColor = mix(vec3(baseWhite), regionColor, strength);
    return strength;
  }

  // Is this plain point between the eye and a colored region, in the region's line of sight?
  // 1 = hide it, 0 = show it. Worked out every frame from where the eye is now, so what is
  // hidden follows wherever you look.
  float occluded() {
    float hide = 0.0;
    vec3 toPoint = aPos - uEye;
    for (int i = 0; i < ${MAX_REGIONS}; i++) {
      if (uLevel[i] > 0.0) {
        vec3 toCenter = uSeed[i] - uEye;
        float centerDistance = length(toCenter);
        vec3 axis = toCenter / max(centerDistance, 0.001);
        float along = dot(toPoint, axis);
        float side = length(toPoint - axis * along);
        float radius = uRegionRadius[i];
        float inFront = smoothstep(0.0, ${OCCLUDER.DEPTH_FADE.toFixed(2)}, centerDistance - along) * step(0.0, along);
        float inside = 1.0 - smoothstep(0.75 * radius, radius, side);
        hide = max(hide, inFront * inside);
      }
    }
    return hide;
  }

  // A ring that runs outward from the sounding node on each new hit, link by link.
  float wave(int r) {
    float hop = (1.0 - aAmount) * ${(REGION.HOPS + 1).toFixed(1)};
    float front = uAge[r] * 7.0;
    return exp(-pow(hop - front, 2.0) * 1.2) * exp(-uAge[r] * 1.6) * aAmount;
  }

  // How much this point's region is being pointed at (0.6) or held (1).
  float focusOf() {
    int r = int(aRegion + 0.5);
    return r >= 0 ? uFocus[r] : 0.0;
  }
  // A pointed-at region breathes a little; a held one is steady.
  float breath(float focus) {
    return 1.0 + ${FOCUS.BREATH.toFixed(2)} * sin(uTime * 5.0) * (1.0 - smoothstep(0.7, 0.95, focus));
  }

  float depthDim(float dist) {
    return mix(1.0, 0.18, smoothstep(${FAR_DIM[0].toFixed(1)}, ${FAR_DIM[1].toFixed(1)}, dist));
  }
  // Plain dots and links: near ones brighter and bigger, far ones fainter and smaller.
  float plainDepth(float dist) {
    return smoothstep(${PLAIN.DEPTH_RANGE[0].toFixed(1)}, ${PLAIN.DEPTH_RANGE[1].toFixed(1)}, dist);
  }
  float plainGain(float dist) {
    return mix(${PLAIN.NEAR_GAIN.toFixed(2)}, ${PLAIN.FAR_GAIN.toFixed(2)}, plainDepth(dist));
  }
  float nearFade(float dist) {
    return smoothstep(${NEAR_FADE[0].toFixed(2)}, ${NEAR_FADE[1].toFixed(2)}, dist);
  }
`;

// Both the plain material (#define PLAIN) and the colored (glowing) material use these:
// each draws only its own nodes and sends the other's off screen.
const NODE_VERTEX = /* glsl */ `
  ${SHARED_GLSL}
  attribute float aSize;
  void main() {
    float strength = tint(0.85);
#ifdef PLAIN
    if (strength > 0.995) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
#else
    if (strength < 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
#endif
    vec4 viewPosition = modelViewMatrix * vec4(drift(aPos, aSeed, strength), 1.0);
    float dist = length(viewPosition.xyz);
#ifdef PLAIN
    // A flat faint dot: no glow, no twinkle, no motion.
    vec4 sh = shock(aPos);
    vColor = mix(vec3(1.0), sh.rgb, min(1.0, sh.w * 1.4));
    float depthSize = mix(${PLAIN.NEAR_SIZE.toFixed(2)}, ${PLAIN.FAR_SIZE.toFixed(2)}, plainDepth(dist));
    float size = min(aSize * ${PLAIN.SIZE_SCALE.toFixed(2)} * depthSize, dist * ${PLAIN.MAX_SCREEN_SIZE.toFixed(3)});
    vAlpha = (${PLAIN.ALPHA.toFixed(3)} * plainGain(dist) + sh.w * ${SHOCK.ALPHA.toFixed(2)} * mix(depthDim(dist), 1.0, 0.5)) * (1.0 - strength) * (1.0 - occluded()) * nearFade(dist);
#else
    int r = int(aRegion + 0.5);
    float high = r >= 0 ? uHigh[r] * (1.0 - aAmount) : 0.0;
    float hit = r >= 0 ? uHit[r] * aAmount : 0.0;
    float ring = r >= 0 ? wave(r) : 0.0;
    float sparkle = high * (0.5 + 0.5 * sin(uTime * 1.6 + aSeed * 60.0)) * 0.5;
    // Nodes glimmer very slowly, never flash.
    float twinkle = 0.92 + 0.08 * sin(uTime * 0.9 + aSeed * 40.0);
    float focus = focusOf();
    float size = aSize * twinkle * ${CORE_SIZE.toFixed(1)} * (1.0 + strength * 0.5 + sparkle * 1.3 + hit * 0.6 + ring * 1.2 + focus * ${FOCUS.GROW.toFixed(2)} * breath(focus));
    size = min(size, dist * ${MAX_SCREEN_SIZE.toFixed(3)});
    // The true color, opaque: it is laid over the pale underlay, not added to the black.
    vColor = min(vColor * (1.0 + hit * 0.25 + sparkle * 0.3 + ring * 0.35 + focus * ${(FOCUS.BRIGHTEN * 0.4).toFixed(2)}), vec3(1.0));
    vAlpha = strength * mix(depthDim(dist), 1.0, strength * 0.7) * nearFade(dist);
#endif
    viewPosition.xy += position.xy * size;
    gl_Position = projectionMatrix * viewPosition;
    vUv = position.xy + 0.5;
  }
`;

const NODE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
#ifdef PLAIN
    float disc = 1.0 - smoothstep(0.7, 1.0, d);
    gl_FragColor = vec4(vColor, disc * vAlpha);
#else
    // A small crisp disc in the region's own color.
    float disc = 1.0 - smoothstep(0.55, 0.95, d);
    gl_FragColor = vec4(vColor, disc * vAlpha);
#endif
  }
`;

// A soft glow behind each colored node, so a region reads as an area and not just a few dots.
const HALO_VERTEX = /* glsl */ `
  ${SHARED_GLSL}
  attribute float aSize;
  void main() {
    float strength = tint(0.0);
    // The underlay is the same hue, pulled toward white (a pastel of the region's color).
    int hr = int(aRegion + 0.5);
    vColor = mix(hr >= 0 ? uColor[hr] : vec3(1.0), vec3(1.0), ${HALO_PASTEL.toFixed(2)});
    vec4 viewPosition = modelViewMatrix * vec4(drift(aPos, aSeed, strength), 1.0);
    float dist = length(viewPosition.xyz);
    float focus = focusOf();
    vAlpha = ${HALO_ALPHA.toFixed(2)} * (1.0 + focus * ${FOCUS.HALO.toFixed(1)}) * strength * strength * mix(depthDim(dist), 1.0, 0.6) * nearFade(dist);
    float size = min(aSize * ${HALO_SIZE.toFixed(1)} * (1.0 + focus * 0.4 * breath(focus)), dist * 0.12) * step(0.02, strength);
    viewPosition.xy += position.xy * size;
    gl_Position = projectionMatrix * viewPosition;
    vUv = position.xy + 0.5;
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float glow = exp(-d * d * 3.0) * (1.0 - smoothstep(0.7, 1.0, d));
    gl_FragColor = vec4(vColor, glow * vAlpha);
  }
`;

const LINK_VERTEX = /* glsl */ `
  ${SHARED_GLSL}
  void main() {
    // (A link is never sent off screen: only its alpha changes, so a link between a plain and a
    // colored node fades smoothly between the two instead of streaking across the screen.)
    float strength = tint(0.75);
    vec4 viewPosition = modelViewMatrix * vec4(drift(aPos, aSeed, strength), 1.0);
    float dist = length(viewPosition.xyz);
#ifdef PLAIN
    vec4 sh = shock(aPos);
    vColor = mix(vec3(1.0), sh.rgb, min(1.0, sh.w * 1.4));
    vAlpha = (${PLAIN.ALPHA.toFixed(3)} * plainGain(dist) + sh.w * ${(SHOCK.ALPHA * 0.8).toFixed(2)} * mix(depthDim(dist), 1.0, 0.5)) * (1.0 - strength) * (1.0 - occluded()) * nearFade(dist);
#else
    int r = int(aRegion + 0.5);
    float hit = r >= 0 ? uHit[r] * aAmount : 0.0;
    float ring = r >= 0 ? wave(r) : 0.0;
    float focus = focusOf();
    vColor = min(vColor * (1.0 + hit * 0.2 + ring * 0.3 + focus * ${(FOCUS.BRIGHTEN * 0.3).toFixed(2)}), vec3(1.0));
    vAlpha = strength * 0.55 * (1.0 + focus * 0.4) * mix(depthDim(dist), 1.0, strength * 0.7) * nearFade(dist);
#endif
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const LINK_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

// The hairlines inside a region (and the white ones between regions): each line runs from the
// region's color to a paler version of it. Their alpha follows how colored their two ends are.
const WEB_VERTEX = /* glsl */ `
  ${SHARED_GLSL}
  attribute float aEnd;
  void main() {
    float strength = tint(0.0);
    vec4 viewPosition = modelViewMatrix * vec4(drift(aPos, aSeed, strength), 1.0);
    float dist = length(viewPosition.xyz);
    int r = int(aRegion + 0.5);
    vec3 base = r >= 0 ? uColor[r] : vec3(1.0);
#ifdef CONNECT
    vColor = vec3(1.0);
    vAlpha = ${WEB.CONNECT_ALPHA.toFixed(3)} * strength * mix(depthDim(dist), 1.0, 0.6) * nearFade(dist);
#else
    float focus = focusOf();
    vColor = mix(base, mix(base, vec3(1.0), ${WEB.PASTEL.toFixed(2)}), aEnd);
    vAlpha = ${WEB.ALPHA.toFixed(3)} * strength * strength * (1.0 + focus * 0.6) * mix(depthDim(dist), 1.0, 0.7) * nearFade(dist);
#endif
    gl_Position = projectionMatrix * viewPosition;
  }
`;

// A set of line segments whose ends are graph nodes; which nodes is chosen at run time.
function makeLineSet(maxLines) {
  const geometry = new THREE.BufferGeometry();
  const vertices = maxLines * 2;
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute('aPos', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(vertices), 1));
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(new Float32Array(vertices), 1));
  geometry.setAttribute('aRegion', new THREE.BufferAttribute(new Float32Array(vertices).fill(-1), 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAmount', new THREE.BufferAttribute(new Float32Array(vertices), 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  return { geometry, maxLines, nodeOf: new Int32Array(vertices), lines: 0 };
}

function fillLineSet(set, graph, pairs) {
  const count = Math.min(pairs.length, set.maxLines);
  const aPos = set.geometry.getAttribute('aPos');
  const aSeed = set.geometry.getAttribute('aSeed');
  const aEnd = set.geometry.getAttribute('aEnd');
  for (let k = 0; k < count; k += 1) {
    pairs[k].forEach((node, end) => {
      const v = k * 2 + end;
      aPos.array.set(graph.nodes[node].position, v * 3);
      aSeed.array[v] = graph.nodes[node].seed;
      aEnd.array[v] = end;
      set.nodeOf[v] = node;
    });
  }
  set.lines = count;
  set.geometry.setDrawRange(0, count * 2);
  aPos.needsUpdate = true;
  aSeed.needsUpdate = true;
  aEnd.needsUpdate = true;
}

// Each line end takes on its node's current region and how colored it is.
function syncLineSet(set) {
  const aRegion = set.geometry.getAttribute('aRegion');
  const aAmount = set.geometry.getAttribute('aAmount');
  for (let v = 0; v < set.lines * 2; v += 1) {
    aRegion.array[v] = store.nodeRegion[set.nodeOf[v]];
    aAmount.array[v] = store.nodeAmount[set.nodeOf[v]];
  }
  aRegion.needsUpdate = true;
  aAmount.needsUpdate = true;
}

const headScratch = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
const colorCache = new Map();
const colorOf = (value) => {
  if (!colorCache.has(value)) colorCache.set(value, new THREE.Color(value));
  return colorCache.get(value);
};

// One graph exists at a time; the frame loop updates these directly.
const graphUniforms = {
  uTime: { value: 0 },
  uColor: { value: Array.from({ length: MAX_REGIONS }, () => new THREE.Color(1, 1, 1)) },
  uLevel: { value: new Array(MAX_REGIONS).fill(0) },
  uHigh: { value: new Array(MAX_REGIONS).fill(0) },
  uHit: { value: new Array(MAX_REGIONS).fill(0) },
  uAge: { value: new Array(MAX_REGIONS).fill(9) },
  uFocus: { value: new Array(MAX_REGIONS).fill(0) },
  uSeed: { value: Array.from({ length: MAX_REGIONS }, () => new THREE.Vector3()) },
  uHoldPos: { value: Array.from({ length: MAX_REGIONS }, () => new THREE.Vector3()) },
  uHoldOffset: { value: Array.from({ length: MAX_REGIONS * LIQUID.VARIANTS }, () => new THREE.Vector3()) },
  uHoldPull: { value: new Array(MAX_REGIONS).fill(0) },
  uHoldSpeed: { value: new Array(MAX_REGIONS).fill(0) },
  uSwell: { value: new Array(MAX_REGIONS).fill(0) },
  uMusic: { value: 0 },
  uShock: { value: new Array(MAX_REGIONS).fill(0) },
  uShockAge: { value: new Array(MAX_REGIONS * SHOCK.SLOTS).fill(99) },
  uShockPower: { value: new Array(MAX_REGIONS * SHOCK.SLOTS).fill(0) },
  uBreath: { value: 0 },
  uKick: { value: new Array(MAX_REGIONS).fill(0) },
  uRegionRadius: { value: new Array(MAX_REGIONS).fill(1.5) },
  uEye: { value: new THREE.Vector3() },
};

// What the frame loop reads and writes. Rebuilt with the graph (the graph is built once).
const store = {
  nodeRegion: new Float32Array(0),
  nodeAmount: new Float32Array(0),
  linkRegion: new Float32Array(0),
  linkAmount: new Float32Array(0),
  targetRegion: new Int8Array(0),
  targetAmount: new Float32Array(0),
  seeds: [],
  seedKeys: [],
  regionRadius: [],
  focus: new Map(),
  lag: new Map(), // each held star's trailing point (a spring that follows it)
  starAt: new Map(), // where each star was a frame ago
  speed: new Map(), // how fast each star is moving (eased)
  held: new Map(), // how much each region is being held (eased 0..1)
  kick: new Map(), // how far each region is swelled by its sound (eased)
  shells: new Map(), // each region's travelling shells: how old each is and how strong
  smooth: new Map(), // each region's sound (volume, hits, highs), eased so it swells rather than flashes
  dirty: true,
};

export function WhiteGraph() {
  const { graph, nodeGeometry, linkGeometry, nodeMaterial, linkMaterial, plainNodeMaterial, plainLinkMaterial, haloMaterial, webSet, connectSet, webMaterial, connectMaterial } = useMemo(() => {
    const graph = buildGraph();
    const count = graph.count;
    const linkCount = graph.links.length;

    // Per-node data that changes while the regions move: which region and how strongly.
    Object.assign(store, {
      nodeRegion: new Float32Array(count).fill(-1),
      nodeAmount: new Float32Array(count),
      linkRegion: new Float32Array(linkCount * 2).fill(-1),
      linkAmount: new Float32Array(linkCount * 2),
      targetRegion: new Int8Array(count).fill(-1),
      targetAmount: new Float32Array(count),
      seeds: [],
      seedKeys: [],
      dirty: true,
    });

    const quad = new THREE.PlaneGeometry(1, 1);
    const nodeGeometry = new THREE.InstancedBufferGeometry();
    nodeGeometry.index = quad.index;
    nodeGeometry.setAttribute('position', quad.getAttribute('position'));
    const aPos = new Float32Array(count * 3);
    const aSeed = new Float32Array(count);
    const aSize = new Float32Array(count);
    graph.nodes.forEach((node, i) => {
      aPos.set(node.position, i * 3);
      aSeed[i] = node.seed;
      aSize[i] = node.size;
    });
    nodeGeometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
    nodeGeometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    nodeGeometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 1));
    nodeGeometry.setAttribute('aRegion', new THREE.InstancedBufferAttribute(store.nodeRegion, 1).setUsage(THREE.DynamicDrawUsage));
    nodeGeometry.setAttribute('aAmount', new THREE.InstancedBufferAttribute(store.nodeAmount, 1).setUsage(THREE.DynamicDrawUsage));
    nodeGeometry.instanceCount = count;

    const linkGeometry = new THREE.BufferGeometry();
    const linkPos = new Float32Array(linkCount * 2 * 3);
    const linkSeed = new Float32Array(linkCount * 2);
    graph.links.forEach(([a, b], i) => {
      linkPos.set(graph.nodes[a].position, i * 6);
      linkPos.set(graph.nodes[b].position, i * 6 + 3);
      linkSeed[i * 2] = graph.nodes[a].seed;
      linkSeed[i * 2 + 1] = graph.nodes[b].seed;
    });
    linkGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linkCount * 2 * 3), 3));
    linkGeometry.setAttribute('aPos', new THREE.BufferAttribute(linkPos, 3));
    linkGeometry.setAttribute('aSeed', new THREE.BufferAttribute(linkSeed, 1));
    linkGeometry.setAttribute('aRegion', new THREE.BufferAttribute(store.linkRegion, 1).setUsage(THREE.DynamicDrawUsage));
    linkGeometry.setAttribute('aAmount', new THREE.BufferAttribute(store.linkAmount, 1).setUsage(THREE.DynamicDrawUsage));

    const nodeMaterial = new THREE.ShaderMaterial({
      uniforms: graphUniforms,
      vertexShader: NODE_VERTEX,
      fragmentShader: NODE_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const linkMaterial = new THREE.ShaderMaterial({
      uniforms: graphUniforms,
      vertexShader: LINK_VERTEX,
      fragmentShader: LINK_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });

    // The same shaders again for the plain nodes and links: faint, flat, normal blending.
    const plainNodeMaterial = new THREE.ShaderMaterial({
      uniforms: graphUniforms,
      defines: { PLAIN: '' },
      vertexShader: NODE_VERTEX,
      fragmentShader: NODE_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const plainLinkMaterial = new THREE.ShaderMaterial({
      uniforms: graphUniforms,
      defines: { PLAIN: '' },
      vertexShader: LINK_VERTEX,
      fragmentShader: LINK_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });

    const haloMaterial = new THREE.ShaderMaterial({
      uniforms: graphUniforms,
      vertexShader: HALO_VERTEX,
      fragmentShader: HALO_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });

    const webSet = makeLineSet(WEB.MAX_PER_REGION * MAX_REGIONS);
    const connectSet = makeLineSet(WEB.MAX_CONNECT);
    const webMaterial = new THREE.ShaderMaterial({
      uniforms: graphUniforms,
      vertexShader: WEB_VERTEX,
      fragmentShader: LINK_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const connectMaterial = new THREE.ShaderMaterial({
      uniforms: graphUniforms,
      defines: { CONNECT: '' },
      vertexShader: WEB_VERTEX,
      fragmentShader: LINK_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });

    quad.dispose();
    return { graph, nodeGeometry, linkGeometry, nodeMaterial, linkMaterial, plainNodeMaterial, plainLinkMaterial, haloMaterial, webSet, connectSet, webMaterial, connectMaterial };
  }, []);

  const scratch = useMemo(() => ({ position: new THREE.Vector3() }), []);

  // Dev-only: lets the tests read the regions.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__starMixGraph = () => {
      const counts = new Map();
      let colored = 0;
      for (let i = 0; i < graph.count; i += 1) {
        const region = store.targetRegion[i];
        if (region >= 0) {
          counts.set(region, (counts.get(region) ?? 0) + 1);
          colored += 1;
        }
      }
      const centroid = [0, 0, 0];
      graph.nodes.forEach((node) => node.position.forEach((value, axis) => { centroid[axis] += value / graph.count; }));
      return {
        centroid,
        // Positions of the colored nodes of each region (for tests that click on what is drawn).
        regionNodes: Object.fromEntries(store.seedKeys.map((key, index) => [key, graph.nodes.filter((_, i) => store.targetRegion[i] === index).map((node) => node.position)])),
        focus: Object.fromEntries([...store.focus].map(([key, value]) => [key, +value.toFixed(2)])),
        shapes: Object.fromEntries([...regionShapes].map(([key, shape]) => [key, { center: shape.center.map((v) => +v.toFixed(2)), radius: +shape.radius.toFixed(2) }])),
        nodeCount: graph.count,
        linkCount: graph.links.length,
        coloredNodes: colored,
        regions: store.seedKeys.map((key, index) => ({
          key,
          seedNode: store.seeds[index],
          seedPosition: store.seeds[index] >= 0 ? graph.nodes[store.seeds[index]].position : null,
          nodes: counts.get(index) ?? 0,
        })),
      };
    };
    return () => { delete window.__starMixGraph; };
  }, [graph]);

  useEffect(() => () => {
    nodeGeometry.dispose();
    linkGeometry.dispose();
    nodeMaterial.dispose();
    linkMaterial.dispose();
    plainNodeMaterial.dispose();
    plainLinkMaterial.dispose();
    haloMaterial.dispose();
    webSet.geometry.dispose();
    connectSet.geometry.dispose();
    webMaterial.dispose();
    connectMaterial.dispose();
  }, [nodeGeometry, linkGeometry, nodeMaterial, linkMaterial, plainNodeMaterial, plainLinkMaterial, haloMaterial, webSet, connectSet, webMaterial, connectMaterial]);

  useFrame((state, delta) => {
    graphUniforms.uTime.value = state.clock.elapsedTime;
    // Where the eye is right now: plain nodes in front of a colored region are hidden from here.
    // The real head (between the eyes) decides what is hidden in front of a region: in a headset the
    // scene camera's own position is not where the eyes are, and the hidden patch would drift off.
    graphUniforms.uEye.value.copy(readHeadPose(state, headScratch).position);

    // React may build the graph twice in development; always write into the arrays that
    // the geometries on screen actually use.
    store.nodeRegion = nodeGeometry.getAttribute('aRegion').array;
    store.nodeAmount = nodeGeometry.getAttribute('aAmount').array;
    store.linkRegion = linkGeometry.getAttribute('aRegion').array;
    store.linkAmount = linkGeometry.getAttribute('aAmount').array;
    if (store.targetRegion.length !== graph.count) {
      store.targetRegion = new Int8Array(graph.count).fill(-1);
      store.targetAmount = new Float32Array(graph.count);
      store.seeds = [];
      store.seedKeys = [];
      store.dirty = true;
    }

    const entries = [...getRegions().entries()].filter(([, entry]) => entry.group.current).slice(0, MAX_REGIONS);

    // 1. Where does each instrument sound from? The graph node nearest its star; it only
    //    moves when another node is clearly nearer (so the color does not flicker).
    const keys = entries.map(([key]) => key);
    const taken = new Set();
    let changed = keys.length !== store.seedKeys.length || keys.some((key, i) => key !== store.seedKeys[i]);
    const seeds = entries.map(([key, entry], index) => {
      entry.group.current.getWorldPosition(scratch.position);
      const previous = store.seedKeys[index] === key ? store.seeds[index] ?? -1 : -1;
      const best = nearestNode(graph, scratch.position, taken);
      let chosen = best.index;
      if (previous >= 0 && !taken.has(previous)) {
        const p = graph.nodes[previous].position;
        const previousDistance = Math.hypot(p[0] - scratch.position.x, p[1] - scratch.position.y, p[2] - scratch.position.z);
        if (previousDistance - best.distance < REGION.SEED_STICKINESS) chosen = previous;
      }
      taken.add(chosen);
      if (chosen !== store.seeds[index]) changed = true;
      return chosen;
    });

    // 2. Grow every region from its node, link by link; they never share a node.
    if (changed) {
      store.seeds = seeds;
      store.seedKeys = keys;
      const { region, hops, reach: hopReach } = growRegions(graph, seeds, REGION.HOPS, REGION.MIN_NODES, REGION.MAX_HOPS);
      // How wide each region looks from outside (most of its nodes), for hiding what is in front of it.
      store.regionRadius = seeds.map((seed, regionIndex) => {
        if (seed < 0) return 1.5;
        const center = graph.nodes[seed].position;
        const distances = [];
        for (let i = 0; i < graph.count; i += 1) {
          if (region[i] !== regionIndex) continue;
          const p = graph.nodes[i].position;
          distances.push(Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]));
        }
        distances.sort((x, y) => x - y);
        return (distances[Math.floor(distances.length * OCCLUDER.PERCENTILE)] ?? 0) + OCCLUDER.EXTRA_RADIUS;
      });
      // The click area of each region: around the middle of its colored nodes, out to nearly all of them.
      regionShapes.clear();
      seeds.forEach((seed, regionIndex) => {
        if (seed < 0) return;
        const members = [];
        for (let i = 0; i < graph.count; i += 1) if (region[i] === regionIndex) members.push(graph.nodes[i].position);
        if (members.length === 0) return;
        const center = [0, 1, 2].map((axis) => members.reduce((sum, p) => sum + p[axis], 0) / members.length);
        const reach = members
          .map((p) => Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]))
          .sort((x, y) => x - y);
        regionShapes.set(keys[regionIndex], { center, nodes: members, radius: (reach[Math.floor(reach.length * 0.85)] ?? 0) + 0.2 });
      });
      // The hairlines: each node reaches out to others of its own region; a few white lines join regions.
      const members = seeds.map(() => []);
      for (let i = 0; i < graph.count; i += 1) if (region[i] >= 0) members[region[i]].push(i);
      const webPairs = [];
      const radiusSquared = WEB.RADIUS * WEB.RADIUS;
      members.forEach((list) => {
        let made = 0;
        for (let n = 0; n < list.length && made < WEB.MAX_PER_REGION; n += 1) {
          const i = list[n];
          let mine = 0;
          for (let tries = 0; tries < WEB.PER_NODE * 3 && mine < WEB.PER_NODE && made < WEB.MAX_PER_REGION; tries += 1) {
            const j = list[Math.floor(Math.random() * list.length)];
            if (j === i) continue;
            const a = graph.nodes[i].position;
            const b = graph.nodes[j].position;
            if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 > radiusSquared) continue;
            webPairs.push([i, j]);
            made += 1;
            mine += 1;
          }
        }
      });
      const connectPairs = [];
      for (let a = 0; a < members.length; a += 1) {
        for (let b = a + 1; b < members.length; b += 1) {
          if (members[a].length === 0 || members[b].length === 0) continue;
          for (let k = 0; k < WEB.CONNECT_PER_PAIR; k += 1) {
            connectPairs.push([members[a][Math.floor(Math.random() * members[a].length)], members[b][Math.floor(Math.random() * members[b].length)]]);
          }
        }
      }
      fillLineSet(webSet, graph, webPairs);
      fillLineSet(connectSet, graph, connectPairs);
      for (let i = 0; i < graph.count; i += 1) {
        store.targetRegion[i] = region[i];
        store.targetAmount[i] = region[i] >= 0 ? 1 - hops[i] / (hopReach[region[i]] + 1) : 0;
      }
      store.dirty = true;
    }

    // 3. Ease the nodes toward their targets: an old color fades out before a new one comes in.
    if (store.dirty) {
      let moving = false;
      const fadeOut = delta * REGION.FADE_OUT_PER_SECOND;
      const fadeIn = Math.min(1, delta * REGION.FADE_IN_PER_SECOND);
      for (let i = 0; i < graph.count; i += 1) {
        const targetRegion = store.targetRegion[i];
        if (store.nodeRegion[i] !== targetRegion) {
          store.nodeAmount[i] -= fadeOut;
          if (store.nodeAmount[i] <= 0) {
            store.nodeAmount[i] = 0;
            store.nodeRegion[i] = targetRegion;
          }
          moving = true;
        } else {
          const gap = store.targetAmount[i] - store.nodeAmount[i];
          if (Math.abs(gap) > 0.002) {
            store.nodeAmount[i] += gap * fadeIn;
            moving = true;
          }
        }
      }
      graph.links.forEach(([a, b], i) => {
        store.linkRegion[i * 2] = store.nodeRegion[a];
        store.linkAmount[i * 2] = store.nodeAmount[a];
        store.linkRegion[i * 2 + 1] = store.nodeRegion[b];
        store.linkAmount[i * 2 + 1] = store.nodeAmount[b];
      });
      nodeGeometry.getAttribute('aRegion').needsUpdate = true;
      nodeGeometry.getAttribute('aAmount').needsUpdate = true;
      linkGeometry.getAttribute('aRegion').needsUpdate = true;
      linkGeometry.getAttribute('aAmount').needsUpdate = true;
      syncLineSet(webSet);
      syncLineSet(connectSet);
      store.dirty = moving;
    }

    // 4. Each region's color and how loud it is right now.
    entries.forEach(([key, entry], index) => {
      const { sound, interaction } = entry;
      // (Still mode: pointing at a region does not light it up.)
      // Pointed at (palm, mouse, controller) or held: eases in and out so it never blinks.
      const wanted = isStillMode ? 0 : interaction.current.grabbed ? FOCUS.HELD : interaction.current.hovered ? FOCUS.HOVER : 0;
      const eased = (store.focus.get(key) ?? 0) + (wanted - (store.focus.get(key) ?? 0)) * Math.min(1, delta * FOCUS.EASE_PER_SECOND);
      store.focus.set(key, eased);
      graphUniforms.uFocus.value[index] = eased;
      const active = 0;
      graphUniforms.uColor.value[index].copy(colorOf(entry.color));
      // The sound reaches the color through a slow ease (quick to rise, slower to fall), so the
      // region swells and sinks with the music instead of flashing on every beat.
      const heard = store.smooth.get(key) ?? { vol: 0, hit: 0, high: 0 };
      const ease = (current, target) => current + (target - current) * Math.min(1, delta * (target > current ? REGION.SOUND_RISE : REGION.SOUND_FALL));
      heard.vol = ease(heard.vol, sound.current.vol);
      heard.hit = ease(heard.hit, sound.current.hit);
      heard.high = ease(heard.high, sound.current.high);
      store.smooth.set(key, heard);
      graphUniforms.uLevel.value[index] = Math.min(
        1.4,
        REGION.REST_STRENGTH + Math.min(1, heard.vol * 1.6) * REGION.SOUND_STRENGTH + active + heard.hit * 0.3,
      );
      graphUniforms.uHigh.value[index] = heard.high;
      graphUniforms.uHit.value[index] = heard.hit;
      graphUniforms.uAge.value[index] = sound.current.age;
      graphUniforms.uSwell.value[index] = Math.min(1, heard.vol * 1.4);
      graphUniforms.uShock.value[index] = isStillMode ? 0 : (SHOCK.WEIGHT[entry.instrument] ?? 0.8);

      // Shells: each hit (or, for a star that sounds steadily, every little while) starts a new one in
      // the oldest free slot. The shells already travelling are never cut off by it.
      let shell = store.shells.get(key);
      if (!shell) {
        shell = { ages: new Array(SHOCK.SLOTS).fill(99), power: new Array(SHOCK.SLOTS).fill(0), lastAge: 9, since: 9 };
        store.shells.set(key, shell);
      }
      shell.since += delta;
      const struck = sound.current.age < shell.lastAge - 0.0001;
      shell.lastAge = sound.current.age;
      const sustained = heard.vol > SHOCK.SUSTAIN_VOLUME && shell.since > SHOCK.SUSTAIN_EVERY;
      if (struck || sustained) {
        let oldest = 0;
        for (let k = 1; k < SHOCK.SLOTS; k += 1) if (shell.ages[k] > shell.ages[oldest]) oldest = k;
        shell.ages[oldest] = 0;
        shell.power[oldest] = struck ? 1 : Math.min(0.9, 0.4 + heard.vol);
        shell.since = 0;
        // A sharp hit of a low instrument is felt in the controllers too.
        if (struck && !isStillMode) {
          const session = state.gl.xr?.isPresenting ? state.gl.xr.getSession?.() : null;
          buzzControllers(session, (HAPTICS.FELT[entry.instrument] ?? 0.2) * Math.min(1, sound.current.hit + 0.3), interaction.current.grabbed);
        }
      }
      for (let k = 0; k < SHOCK.SLOTS; k += 1) {
        shell.ages[k] = Math.min(99, shell.ages[k] + delta);
        graphUniforms.uShockAge.value[index * SHOCK.SLOTS + k] = shell.ages[k];
        graphUniforms.uShockPower.value[index * SHOCK.SLOTS + k] = shell.ages[k] > 3 ? 0 : shell.power[k];
      }
      // The region swells with its instrument's loudness right now (a sharp hit adds a push on top),
      // quick to follow it up and slower to settle.
      const wantedKick = Math.min(1, sound.current.vol * 1.6) + sound.current.hit * SHOCK.RECOIL_HIT;
      const kickNow = store.kick.get(key) ?? 0;
      const kick = kickNow + (wantedKick - kickNow) * Math.min(1, delta * (wantedKick > kickNow ? SHOCK.RECOIL_RISE : SHOCK.RECOIL_FALL));
      store.kick.set(key, kick);
      graphUniforms.uKick.value[index] = Math.min(1.3, kick) * (isStillMode ? 0 : 1);

      // The star's real position, and a point that follows it on a spring: the lag between them is
      // what makes the nodes around it flow like a liquid.
      entry.group.current.getWorldPosition(scratch.position);
      let lags = store.lag.get(key);
      if (!lags) {
        lags = Array.from({ length: LIQUID.VARIANTS }, () => ({ position: scratch.position.clone(), velocity: new THREE.Vector3() }));
        store.lag.set(key, lags);
      }
      const step = Math.min(delta, 0.05);
      // How fast the star is moving right now (m/s, eased so it does not flicker).
      const previousStar = store.starAt.get(key);
      const rawSpeed = previousStar && step > 0 ? Math.min(3, previousStar.distanceTo(scratch.position) / step) : 0;
      store.starAt.set(key, scratch.position.clone());
      const speed = (store.speed.get(key) ?? 0) + (rawSpeed - (store.speed.get(key) ?? 0)) * Math.min(1, delta * 12);
      store.speed.set(key, speed);
      graphUniforms.uHoldSpeed.value[index] = speed;
      lags.forEach((lag, k) => {
        if (lag.position.distanceTo(scratch.position) > 3) { lag.position.copy(scratch.position); lag.velocity.set(0, 0, 0); }
        // Springs of different stiffness and looseness: their wobbles drift apart.
        const t = k / (LIQUID.VARIANTS - 1) - 0.5;
        const spring = LIQUID.SPRING * (1 + t * 1.6 * LIQUID.SPREAD);
        const damping = LIQUID.DAMPING * (1 - t * 0.9 * LIQUID.SPREAD);
        lag.velocity.addScaledVector(scratch.position.clone().sub(lag.position), spring * step).multiplyScalar(Math.max(0, 1 - damping * step));
        lag.position.addScaledVector(lag.velocity, step);
        const offset = lag.position.clone().sub(scratch.position);
        if (offset.length() > LIQUID.MAX_OFFSET) offset.setLength(LIQUID.MAX_OFFSET);
        graphUniforms.uHoldOffset.value[index * LIQUID.VARIANTS + k].copy(offset);
      });
      const held = (store.held.get(key) ?? 0) + ((interaction.current.grabbed ? 1 : 0) - (store.held.get(key) ?? 0)) * Math.min(1, delta * 6);
      store.held.set(key, held);
      graphUniforms.uHoldPos.value[index].copy(scratch.position);
      graphUniforms.uHoldPull.value[index] = held;
      const seed = store.seeds[index];
      if (seed >= 0) graphUniforms.uSeed.value[index].fromArray(graph.nodes[seed].position);
      graphUniforms.uRegionRadius.value[index] = store.regionRadius[index] ?? 1.5;
    });
    for (let i = entries.length; i < MAX_REGIONS; i += 1) { graphUniforms.uLevel.value[i] = 0; graphUniforms.uKick.value[i] = 0; }
    // The room breathes with the bass: a slow swell that follows the bass region's loudness.
    const bassIndex = entries.findIndex(([, e]) => e.instrument === 'bass');
    const bassNow = bassIndex >= 0 ? graphUniforms.uSwell.value[bassIndex] : 0;
    graphUniforms.uBreath.value += (bassNow - graphUniforms.uBreath.value) * Math.min(1, delta * 1.5);
    graphUniforms.uMusic.value = entries.length ? entries.reduce((sum, _, index) => sum + graphUniforms.uSwell.value[index], 0) / entries.length : 0;
  });

  return (
    <group>
      <lineSegments geometry={linkGeometry} material={plainLinkMaterial} frustumCulled={false} raycast={() => null} renderOrder={-2} />
      <mesh geometry={nodeGeometry} material={plainNodeMaterial} frustumCulled={false} raycast={() => null} renderOrder={-1} />
      <mesh geometry={nodeGeometry} material={haloMaterial} frustumCulled={false} raycast={() => null} renderOrder={0} />
      <lineSegments geometry={connectSet.geometry} material={connectMaterial} frustumCulled={false} raycast={() => null} renderOrder={-1.5} />
      <lineSegments geometry={linkGeometry} material={linkMaterial} frustumCulled={false} raycast={() => null} renderOrder={1} />
      <lineSegments geometry={webSet.geometry} material={webMaterial} frustumCulled={false} raycast={() => null} renderOrder={1.5} />
      <mesh geometry={nodeGeometry} material={nodeMaterial} frustumCulled={false} raycast={() => null} renderOrder={2} />
    </group>
  );
}
