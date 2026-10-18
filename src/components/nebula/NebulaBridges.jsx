import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getNebulae } from './nebulaRegistry';
import { placeNode } from './nebulaPlacement';

// When two stars come close, the sides facing each other reach toward one another
// (see `uPull` in StarNebula) and thin threads join their nearest nodes, as if the
// two were about to merge. They never do: the stars keep their own space.
const BRIDGE_START = 3.2; // distance between star centers where they start to notice each other
const BRIDGE_FULL = 1.8; // distance where the connection is at its strongest
const THREADS_PER_PAIR = 16;
const SEGMENTS = 6; // each thread is a slightly curved line of this many pieces
const MAX_PAIRS = 10;
const REASSIGN_EVERY_FRAMES = 12; // how often threads re-pick their nodes (keeps them steady)
const MAX_USES_PER_NODE = 2;
const THREAD_BRIGHTNESS = 0.85;
const THREAD_SWAY = 0.06;
const FACING_CANDIDATES = 40; // per star: the nodes nearest the neighbour are the ones that can join
const THREAD_FADE_FROM = 0.45; // threads longer than this start to fade...
const THREAD_MAX_LENGTH = 1.2; // ...and are not drawn beyond this

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const colorCache = new Map();
const colorOf = (value) => {
  if (!colorCache.has(value)) colorCache.set(value, new THREE.Color(value));
  return colorCache.get(value);
};

const VERTICES_PER_THREAD = SEGMENTS * 2;

export function NebulaBridges() {
  const frameRef = useRef(0);
  const pairThreads = useRef(new Map());
  const scratch = useRef({
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    p: new THREE.Vector3(),
    q: new THREE.Vector3(),
    perp: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    colorMix: new THREE.Color(),
  });

  const { geometry, material } = useMemo(() => {
    const capacity = MAX_PAIRS * THREADS_PER_PAIR * VERTICES_PER_THREAD;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { geometry, material };
  }, []);

  // Dev-only: lets the tests read how long each thread is right now.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__starMixBridges = () => {
      const entries = [...getNebulae().values()].filter((entry) => entry.group.current);
      const out = [];
      pairThreads.current.forEach((threads, key) => {
        const [i, j] = key.split('-').map(Number);
        const first = entries[i];
        const second = entries[j];
        if (!first || !second) return;
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const lengths = threads.map((thread) => {
          const { layout: la } = first;
          const { layout: lb } = second;
          placeNode(a, la.cloud[thread.a], la.shape[thread.a], la.nodes[thread.a].seed, first.state).applyMatrix4(first.group.current.matrixWorld);
          placeNode(b, lb.cloud[thread.b], lb.shape[thread.b], lb.nodes[thread.b].seed, second.state).applyMatrix4(second.group.current.matrixWorld);
          return +a.distanceTo(b).toFixed(2);
        });
        out.push({ key, centerDistance: +first.center.distanceTo(second.center).toFixed(2), threads: threads.length, lengths });
      });
      return out;
    };
    return () => { delete window.__starMixBridges; };
  }, []);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((state) => {
    const { a, b, p, q, perp, up, colorMix } = scratch.current;
    const entries = [...getNebulae().values()].filter((entry) => entry.group.current);
    entries.forEach((entry) => {
      entry.pullInput.amount = 0;
      entry.group.current.updateWorldMatrix(true, false);
      entry.center = entry.center ?? new THREE.Vector3();
      entry.group.current.getWorldPosition(entry.center);
    });

    const positions = geometry.getAttribute('position');
    const colors = geometry.getAttribute('color');
    let vertex = 0;
    frameRef.current += 1;
    const reassign = frameRef.current % REASSIGN_EVERY_FRAMES === 0;
    const livePairs = new Set();

    const worldNode = (entry, index, out) => {
      const { layout } = entry;
      placeNode(out, layout.cloud[index], layout.shape[index], layout.nodes[index].seed, entry.state);
      return out.applyMatrix4(entry.group.current.matrixWorld);
    };

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const first = entries[i];
        const second = entries[j];
        const distance = first.center.distanceTo(second.center);
        const strength = 1 - smoothstep(BRIDGE_FULL, BRIDGE_START, distance);
        if (strength <= 0.01) continue;

        // Each star leans toward its nearest neighbour.
        [[first, second], [second, first]].forEach(([self, other]) => {
          if (strength > self.pullInput.amount) {
            self.pullInput.dir.subVectors(other.center, self.center).normalize();
            self.pullInput.amount = strength;
          }
        });

        const pairKey = `${i}-${j}`;
        livePairs.add(pairKey);
        let threads = pairThreads.current.get(pairKey);
        if (!threads || reassign) {
          threads = chooseThreads(first, second, worldNode);
          pairThreads.current.set(pairKey, threads);
        }

        const colorA = colorOf(first.color);
        const colorB = colorOf(second.color);
        threads.forEach((thread, threadIndex) => {
          if (vertex + VERTICES_PER_THREAD > positions.count) return;
          worldNode(first, thread.a, a);
          worldNode(second, thread.b, b);
          // Short threads are bright; long ones fade, and very long ones are skipped.
          const length = a.distanceTo(b);
          if (length > THREAD_MAX_LENGTH) return;
          const fade = 1 - smoothstep(THREAD_FADE_FROM, THREAD_MAX_LENGTH, length);
          perp.subVectors(b, a).cross(up).normalize();
          const sway = Math.sin(state.clock.elapsedTime * 0.9 + threadIndex * 1.7) * THREAD_SWAY;
          for (let s = 0; s < SEGMENTS; s += 1) {
            [s, s + 1].forEach((k, end) => {
              const t = k / SEGMENTS;
              const target = end === 0 ? p : q;
              target.lerpVectors(a, b, t).addScaledVector(perp, Math.sin(Math.PI * t) * sway);
              colorMix.copy(colorA).lerp(colorB, t).multiplyScalar(strength * fade * THREAD_BRIGHTNESS);
              positions.setXYZ(vertex + end, target.x, target.y, target.z);
              colors.setXYZ(vertex + end, colorMix.r, colorMix.g, colorMix.b);
            });
            vertex += 2;
          }
        });
      }
    }

    // Forget threads of pairs that drifted apart.
    pairThreads.current.forEach((_, key) => { if (!livePairs.has(key)) pairThreads.current.delete(key); });

    geometry.setDrawRange(0, vertex);
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  });

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} raycast={() => null} renderOrder={4} />;
}

// Picks the node pairs (one from each star, among their outermost nodes) that are
// closest to each other right now, using any one node at most a couple of times.
function chooseThreads(first, second, worldNode) {
  // The nodes of each star that are nearest the other star right now.
  const facing = (entry, towards) => entry.layout.cloud
    .map((_, index) => ({ index, position: worldNode(entry, index, new THREE.Vector3()) }))
    .map((node) => ({ ...node, d: node.position.distanceToSquared(towards) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, FACING_CANDIDATES);
  const nodesA = facing(first, second.center);
  const nodesB = facing(second, first.center);

  const candidates = [];
  nodesA.forEach((na) => {
    nodesB.forEach((nb) => {
      candidates.push({ a: na.index, b: nb.index, d: na.position.distanceToSquared(nb.position) });
    });
  });
  candidates.sort((x, y) => x.d - y.d);

  const uses = new Map();
  const chosen = [];
  for (const candidate of candidates) {
    if (chosen.length >= THREADS_PER_PAIR) break;
    const useA = uses.get(`a${candidate.a}`) ?? 0;
    const useB = uses.get(`b${candidate.b}`) ?? 0;
    if (useA >= MAX_USES_PER_NODE || useB >= MAX_USES_PER_NODE) continue;
    uses.set(`a${candidate.a}`, useA + 1);
    uses.set(`b${candidate.b}`, useB + 1);
    chosen.push({ a: candidate.a, b: candidate.b });
  }
  return chosen;
}
