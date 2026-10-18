import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GHOST, REGION } from './graphConstants';
import { buildGraph, growRegions, nearestNode } from './graphLayout';
import { getRegions } from './graphRegistry';

// The space itself: a huge white Obsidian-style graph around the listener, in 3D. Each
// instrument colors one region of it (the nodes within a few links of its sounding node);
// the rest stays white. The graph never moves, only the colored regions do.
const MAX_REGIONS = 8;
const WOBBLE = 0.05; // how far a node drifts (meters), so the graph breathes
const NEAR_FADE = [1.2, 3.2]; // nodes closer to the eye than this fade out (a big blurry dot in your face is only a smudge)
const MAX_SCREEN_SIZE = 0.035; // no node is drawn bigger than this share of its distance to the eye
const FAR_DIM = [2.5, 12]; // and nodes dim between these distances, for depth
const HALO_SIZE = 7; // glow around a colored node, in node sizes
const HALO_ALPHA = 0.16

const SHARED_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor[${MAX_REGIONS}];
  uniform float uLevel[${MAX_REGIONS}];
  uniform float uHigh[${MAX_REGIONS}];
  uniform float uHit[${MAX_REGIONS}];
  uniform float uAge[${MAX_REGIONS}];
  uniform vec3 uSeed[${MAX_REGIONS}];
  attribute vec3 aPos;
  attribute float aSeed;
  attribute float aRegion;
  attribute float aAmount;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;

  vec3 drift(vec3 p, float seed) {
    float t = uTime * (0.25 + seed * 0.3);
    return p + vec3(sin(t + seed * 13.0), sin(t * 1.2 + seed * 29.0), sin(t * 0.8 + seed * 47.0)) * ${WOBBLE.toFixed(3)};
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

  // How much of the plain white graph shows here: only near a colored region.
  float ghost() {
    float nearest = 1000.0;
    for (int i = 0; i < ${MAX_REGIONS}; i++) {
      if (uLevel[i] > 0.0) nearest = min(nearest, distance(aPos, uSeed[i]));
    }
    return ${GHOST.VISIBILITY.toFixed(2)} * (1.0 - smoothstep(${GHOST.FULL_WITHIN.toFixed(1)}, ${GHOST.GONE_BEYOND.toFixed(1)}, nearest));
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

const NODE_VERTEX = /* glsl */ `
  ${SHARED_GLSL}
  attribute float aSize;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(drift(aPos, aSeed), 1.0);
    float dist = length(viewPosition.xyz);
    float strength = tint(0.62);
    int r = int(aRegion + 0.5);
    float high = r >= 0 ? uHigh[r] * (1.0 - aAmount) : 0.0;
    float hit = r >= 0 ? uHit[r] * aAmount : 0.0;
    float ring = r >= 0 ? wave(r) : 0.0;
    float sparkle = high * (0.5 + 0.5 * sin(uTime * 14.0 + aSeed * 60.0));
    float size = aSize * (1.0 + strength * 1.4 + sparkle * 1.3 + hit * 0.6 + ring * 1.2);
    size = min(size, dist * ${MAX_SCREEN_SIZE.toFixed(3)});
    vColor *= (1.0 + hit * 0.6 + sparkle + ring * 0.9);
    vAlpha = mix(ghost(), 1.0, strength) * mix(depthDim(dist), 1.0, strength * 0.7) * nearFade(dist);
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
    float disc = 1.0 - smoothstep(0.7, 1.0, d);
    gl_FragColor = vec4(vColor, disc * vAlpha);
  }
`;

// A soft glow behind each colored node, so a region reads as an area and not just a few dots.
const HALO_VERTEX = /* glsl */ `
  ${SHARED_GLSL}
  attribute float aSize;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(drift(aPos, aSeed), 1.0);
    float dist = length(viewPosition.xyz);
    float strength = tint(0.0);
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
    vec4 viewPosition = modelViewMatrix * vec4(drift(aPos, aSeed), 1.0);
    float dist = length(viewPosition.xyz);
    float strength = tint(0.55);
    int r = int(aRegion + 0.5);
    float hit = r >= 0 ? uHit[r] * aAmount : 0.0;
    float ring = r >= 0 ? wave(r) : 0.0;
    vColor *= (1.0 + hit * 0.5 + ring * 0.8);
    vAlpha = mix(ghost() * 0.36, 0.9, strength) * mix(depthDim(dist), 1.0, strength * 0.7) * nearFade(dist);
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
  dirty: true,
};

export function WhiteGraph() {
  const { graph, nodeGeometry, linkGeometry, nodeMaterial, linkMaterial, haloMaterial } = useMemo(() => {
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

    const haloMaterial = new THREE.ShaderMaterial({
      uniforms: graphUniforms,
      vertexShader: HALO_VERTEX,
      fragmentShader: HALO_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    quad.dispose();
    return { graph, nodeGeometry, linkGeometry, nodeMaterial, linkMaterial, haloMaterial };
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
    haloMaterial.dispose();
  }, [nodeGeometry, linkGeometry, nodeMaterial, linkMaterial, haloMaterial]);

  useFrame((state, delta) => {
    graphUniforms.uTime.value = state.clock.elapsedTime;

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
      const active = interaction.current.hovered || interaction.current.grabbed ? REGION.HOVER_STRENGTH : 0;
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
    });
    for (let i = entries.length; i < MAX_REGIONS; i += 1) graphUniforms.uLevel.value[i] = 0;
  });

  return (
    <group>
      <lineSegments geometry={linkGeometry} material={linkMaterial} frustumCulled={false} raycast={() => null} renderOrder={1} />
      <mesh geometry={nodeGeometry} material={haloMaterial} frustumCulled={false} raycast={() => null} renderOrder={0} />
      <mesh geometry={nodeGeometry} material={nodeMaterial} frustumCulled={false} raycast={() => null} renderOrder={2} />
    </group>
  );
}
