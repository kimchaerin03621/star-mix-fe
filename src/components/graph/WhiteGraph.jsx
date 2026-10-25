import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OCCLUDER, PLAIN, REGION } from './graphConstants';
import { buildGraph, growRegions, nearestNode } from './graphLayout';
import { getRegions } from './graphRegistry';
import { isStillMode } from '../../stillMode';

// The space itself: a huge white Obsidian-style graph around the listener, in 3D. Each
// instrument colors one region of it (the nodes within a few links of its sounding node).
// Every other node stays as a flat, faint dot, with no effects at all. The graph never moves,
// only the colored regions do.
const MAX_REGIONS = 8;
const WOBBLE = 0.05; // how far a colored node drifts (meters); plain nodes stay still
const NEAR_FADE = [1.2, 3.2]; // nodes closer to the eye than this fade out (a big blurry dot in your face is only a smudge)
const MAX_SCREEN_SIZE = 0.09; // no node is drawn bigger than this share of its distance to the eye
const FAR_DIM = [2.5, 12]; // colored nodes dim between these distances, for depth
const GLOW_SIZE = 4.2; // a colored node's soft glow is drawn this many times wider than the node itself
const HALO_SIZE = 7; // glow around a colored node, in node sizes
const HALO_ALPHA = 0.16;

const SHARED_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec3 uEye;
  uniform vec3 uColor[${MAX_REGIONS}];
  uniform float uLevel[${MAX_REGIONS}];
  uniform float uHigh[${MAX_REGIONS}];
  uniform float uHit[${MAX_REGIONS}];
  uniform float uAge[${MAX_REGIONS}];
  uniform vec3 uSeed[${MAX_REGIONS}];
  uniform float uRegionRadius[${MAX_REGIONS}];
  attribute vec3 aPos;
  attribute float aSeed;
  attribute float aRegion;
  attribute float aAmount;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;

  // Only colored nodes drift; amount is how colored the point is.
  vec3 drift(vec3 p, float seed, float amount) {
    float t = uTime * (0.25 + seed * 0.3);
    return p + vec3(sin(t + seed * 13.0), sin(t * 1.2 + seed * 29.0), sin(t * 0.8 + seed * 47.0)) * ${WOBBLE.toFixed(3)} * amount;
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

  float depthDim(float dist) {
    return mix(1.0, 0.18, smoothstep(${FAR_DIM[0].toFixed(1)}, ${FAR_DIM[1].toFixed(1)}, dist));
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
    vColor = vec3(1.0);
    float size = min(aSize * ${PLAIN.SIZE_SCALE.toFixed(2)}, dist * ${MAX_SCREEN_SIZE.toFixed(3)});
    vAlpha = ${PLAIN.ALPHA.toFixed(3)} * (1.0 - strength) * (1.0 - occluded()) * nearFade(dist);
#else
    int r = int(aRegion + 0.5);
    float high = r >= 0 ? uHigh[r] * (1.0 - aAmount) : 0.0;
    float hit = r >= 0 ? uHit[r] * aAmount : 0.0;
    float ring = r >= 0 ? wave(r) : 0.0;
    float sparkle = high * (0.5 + 0.5 * sin(uTime * 14.0 + aSeed * 60.0));
    // Nodes twinkle gently, like the nebula stars.
    float twinkle = 0.8 + 0.2 * sin(uTime * 2.0 + aSeed * 40.0);
    float size = aSize * twinkle * ${GLOW_SIZE.toFixed(1)} * (1.0 + strength * 1.1 + sparkle * 1.3 + hit * 0.6 + ring * 1.2);
    size = min(size, dist * ${MAX_SCREEN_SIZE.toFixed(3)});
    vColor *= (1.0 + hit * 0.6 + sparkle + ring * 0.9);
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
    // A soft glow with a brighter core (the same look as the nebula star nodes).
    float glow = pow(clamp(1.0 - d, 0.0, 1.0), 1.6);
    float core = smoothstep(0.35, 0.0, d);
    gl_FragColor = vec4(vColor * (0.7 + core * 0.9), glow * vAlpha);
#endif
  }
`;

// A soft glow behind each colored node, so a region reads as an area and not just a few dots.
const HALO_VERTEX = /* glsl */ `
  ${SHARED_GLSL}
  attribute float aSize;
  void main() {
    float strength = tint(0.0);
    vec4 viewPosition = modelViewMatrix * vec4(drift(aPos, aSeed, strength), 1.0);
    float dist = length(viewPosition.xyz);
    vAlpha = ${HALO_ALPHA.toFixed(2)} * strength * strength * mix(depthDim(dist), 1.0, 0.6) * nearFade(dist);
    float size = min(aSize * ${HALO_SIZE.toFixed(1)}, dist * 0.12) * step(0.02, strength);
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
    float glow = exp(-d * d * 3.5) * (1.0 - smoothstep(0.8, 1.0, d));
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
    vColor = vec3(1.0);
    vAlpha = ${PLAIN.ALPHA.toFixed(3)} * (1.0 - strength) * (1.0 - occluded()) * nearFade(dist);
#else
    int r = int(aRegion + 0.5);
    float hit = r >= 0 ? uHit[r] * aAmount : 0.0;
    float ring = r >= 0 ? wave(r) : 0.0;
    vColor *= (1.0 + hit * 0.5 + ring * 0.8);
    vAlpha = strength * 0.9 * mix(depthDim(dist), 1.0, strength * 0.7) * nearFade(dist);
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
  uSeed: { value: Array.from({ length: MAX_REGIONS }, () => new THREE.Vector3()) },
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
  dirty: true,
};

export function WhiteGraph() {
  const { graph, nodeGeometry, linkGeometry, nodeMaterial, linkMaterial, plainNodeMaterial, plainLinkMaterial, haloMaterial } = useMemo(() => {
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
      blending: THREE.AdditiveBlending,
    });
    const linkMaterial = new THREE.ShaderMaterial({
      uniforms: graphUniforms,
      vertexShader: LINK_VERTEX,
      fragmentShader: LINK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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
      blending: THREE.AdditiveBlending,
    });

    quad.dispose();
    return { graph, nodeGeometry, linkGeometry, nodeMaterial, linkMaterial, plainNodeMaterial, plainLinkMaterial, haloMaterial };
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
      return {
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
  }, [nodeGeometry, linkGeometry, nodeMaterial, linkMaterial, plainNodeMaterial, plainLinkMaterial, haloMaterial]);

  useFrame((state, delta) => {
    graphUniforms.uTime.value = state.clock.elapsedTime;
    // Where the eye is right now: plain nodes in front of a colored region are hidden from here.
    graphUniforms.uEye.value.copy(state.camera.position);

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
      const { region, hops } = growRegions(graph, seeds, REGION.HOPS);
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
      for (let i = 0; i < graph.count; i += 1) {
        store.targetRegion[i] = region[i];
        store.targetAmount[i] = region[i] >= 0 ? 1 - hops[i] / (REGION.HOPS + 1) : 0;
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
      store.dirty = moving;
    }

    // 4. Each region's color and how loud it is right now.
    entries.forEach(([, entry], index) => {
      const { sound, interaction } = entry;
      // (Still mode: pointing at a region does not light it up.)
      const active = !isStillMode && (interaction.current.hovered || interaction.current.grabbed) ? REGION.HOVER_STRENGTH : 0;
      graphUniforms.uColor.value[index].copy(colorOf(entry.color));
      graphUniforms.uLevel.value[index] = Math.min(
        1.4,
        REGION.REST_STRENGTH + Math.min(1, sound.current.vol * 1.6) * REGION.SOUND_STRENGTH + active + sound.current.hit * 0.3,
      );
      graphUniforms.uHigh.value[index] = sound.current.high;
      graphUniforms.uHit.value[index] = sound.current.hit;
      graphUniforms.uAge.value[index] = sound.current.age;
      const seed = store.seeds[index];
      if (seed >= 0) graphUniforms.uSeed.value[index].fromArray(graph.nodes[seed].position);
      graphUniforms.uRegionRadius.value[index] = store.regionRadius[index] ?? 1.5;
    });
    for (let i = entries.length; i < MAX_REGIONS; i += 1) graphUniforms.uLevel.value[i] = 0;
  });

  return (
    <group>
      <lineSegments geometry={linkGeometry} material={plainLinkMaterial} frustumCulled={false} raycast={() => null} renderOrder={-2} />
      <mesh geometry={nodeGeometry} material={plainNodeMaterial} frustumCulled={false} raycast={() => null} renderOrder={-1} />
      <mesh geometry={nodeGeometry} material={haloMaterial} frustumCulled={false} raycast={() => null} renderOrder={0} />
      <lineSegments geometry={linkGeometry} material={linkMaterial} frustumCulled={false} raycast={() => null} renderOrder={1} />
      <mesh geometry={nodeGeometry} material={nodeMaterial} frustumCulled={false} raycast={() => null} renderOrder={2} />
    </group>
  );
}
