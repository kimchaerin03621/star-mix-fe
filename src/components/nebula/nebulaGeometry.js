import * as THREE from 'three';
import { sampleInstrumentOutline } from '../instrumentIcons';

// Lays out one star's nebula: a few dozen nodes joined by thin links, in the
// manner of Obsidian's graph view. Every node has two homes: a loose, organic
// cloud, and a spot on the outline of its instrument. The shader blends between
// them, so the cluster can wriggle freely and gather into the instrument.

const NODE_COUNT = 300;
const HUB_SHARE = 0.07;
const CLOUD_RADIUS = 0.85; // overall size of the free-form cluster (nodes spread apart, not enlarged)
export const NEBULA_RADIUS = CLOUD_RADIUS;
const SUB_CLUSTERS = 4; // dense clumps inside it, tied together by a few long links
const SHAPE_SIZE = 1.6; // size of the instrument outline
const CLOUD_LINKS_PER_NODE = 3;
const OUTLINE_NODES = 110; // nodes that draw the instrument; the rest scatter around it as dust
const DUST_SPREAD = 0.1;
const SHAPE_LINKS_PER_NODE = 2;
const SHAPE_LINK_MAX_LENGTH = 0.38;
const LONG_LINKS = 24;

// Small deterministic random generator, so a star looks the same every time.
function seededRandom(seedText) {
  let hash = 1779033703;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = Math.imul(hash ^ seedText.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gaussian = (random) => (random() + random() + random() - 1.5) / 1.5;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function nearestNeighbours(points, index, count) {
  return points
    .map((point, other) => ({ other, d: other === index ? Infinity : distance(points[index], point) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count);
}

export function buildNebula({ instrument, seedKey, color }) {
  const random = seededRandom(`${seedKey}:${instrument}`);

  // Several dense clumps, like the sections of an Obsidian graph.
  const clumpCenters = Array.from({ length: SUB_CLUSTERS }, () => [
    gaussian(random) * CLOUD_RADIUS * 0.7,
    gaussian(random) * CLOUD_RADIUS * 0.7,
    gaussian(random) * CLOUD_RADIUS * 0.5,
  ]);
  const cloud = Array.from({ length: NODE_COUNT }, () => {
    const center = clumpCenters[Math.floor(random() * SUB_CLUSTERS)];
    return [
      center[0] + gaussian(random) * CLOUD_RADIUS * 0.4,
      center[1] + gaussian(random) * CLOUD_RADIUS * 0.4,
      center[2] + gaussian(random) * CLOUD_RADIUS * 0.3,
    ];
  });

  const outline = sampleInstrumentOutline(instrument, OUTLINE_NODES, random);
  const spots = outline
    ? Array.from({ length: NODE_COUNT }, (_, i) => {
      if (i < OUTLINE_NODES) return { point: outline[i], onOutline: true };
      const near = outline[Math.floor(random() * outline.length)];
      return {
        point: [near[0] + gaussian(random) * DUST_SPREAD, near[1] + gaussian(random) * DUST_SPREAD],
        onOutline: false,
      };
    })
    : cloud.map(([x, y]) => ({ point: [x / CLOUD_RADIUS / 2, y / CLOUD_RADIUS / 2], onOutline: false }));
  const shapeTargets = spots.map(({ point: [x, y] }) => [x * SHAPE_SIZE, y * SHAPE_SIZE, (random() - 0.5) * 0.04]);

  // Give each outline spot to the nearest still-free cloud node, so the morph is a
  // gentle drift rather than every node crossing the whole cluster.
  const free = new Set(cloud.keys());
  const shape = new Array(NODE_COUNT);
  const onOutline = new Array(NODE_COUNT).fill(false);
  const order = shapeTargets.map((_, i) => i).sort(() => random() - 0.5);
  order.forEach((targetIndex) => {
    let best = -1;
    let bestDistance = Infinity;
    free.forEach((cloudIndex) => {
      const d = distance(cloud[cloudIndex], shapeTargets[targetIndex]);
      if (d < bestDistance) { bestDistance = d; best = cloudIndex; }
    });
    free.delete(best);
    shape[best] = shapeTargets[targetIndex];
    onOutline[best] = spots[targetIndex].onOutline;
  });

  const base = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const nodes = cloud.map((_, i) => {
    const isHub = random() < HUB_SHARE;
    const tone = new THREE.Color().setHSL(
      (hsl.h + (random() - 0.5) * 0.08 + 1) % 1,
      Math.min(1, hsl.s * (1.0 + random() * 0.6)),
      // Lightness follows the star's own (a white star stays white, a violet one violet).
      isHub ? Math.min(0.95, hsl.l + 0.3) : Math.min(0.95, Math.max(0.4, hsl.l * (0.8 + random() * 0.35))),
    );
    return {
      seed: random(),
      size: isHub ? 0.075 + random() * 0.03 : 0.022 + random() * 0.024,
      color: tone,
      index: i,
    };
  });

  // Links: a few nearest neighbours in the cloud, a few long ones across it, and
  // the neighbours along the instrument outline. Each is tagged with its set (0 =
  // cloud, 1 = shape) so the shader can fade between them.
  const links = [];
  const seen = new Set();
  const addLink = (a, b, set) => {
    const key = `${Math.min(a, b)}-${Math.max(a, b)}-${set}`;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    links.push([a, b, set]);
  };
  cloud.forEach((_, i) => nearestNeighbours(cloud, i, CLOUD_LINKS_PER_NODE).forEach(({ other }) => addLink(i, other, 0)));
  for (let i = 0; i < LONG_LINKS; i += 1) addLink(Math.floor(random() * NODE_COUNT), Math.floor(random() * NODE_COUNT), 0);
  // Outline links join only the nodes that draw the instrument.
  const outlineIndices = shape.map((_, i) => i).filter((i) => onOutline[i]);
  const outlineOnly = outlineIndices.map((i) => shape[i]);
  outlineIndices.forEach((nodeIndex, i) => {
    nearestNeighbours(outlineOnly, i, SHAPE_LINKS_PER_NODE)
      .filter(({ d }) => d < SHAPE_LINK_MAX_LENGTH)
      .forEach(({ other }) => addLink(nodeIndex, outlineIndices[other], 1));
  });

  return { cloud, shape, nodes, links, outerNodes: outermostNodes(cloud, 50) };
}

// The nodes farthest from the center: the ones that can reach toward a neighbour.
function outermostNodes(cloud, count) {
  return cloud
    .map((point, index) => ({ index, r: Math.hypot(point[0], point[1], point[2]) }))
    .sort((a, b) => b.r - a.r)
    .slice(0, count)
    .map(({ index }) => index);
}

// Node data for instanced quads (one instance per node).
export function nodeAttributes({ cloud, shape, nodes }) {
  const count = nodes.length;
  const aCloud = new Float32Array(count * 3);
  const aShape = new Float32Array(count * 3);
  const aSeed = new Float32Array(count);
  const aSize = new Float32Array(count);
  const aColor = new Float32Array(count * 3);
  nodes.forEach((node, i) => {
    aCloud.set(cloud[i], i * 3);
    aShape.set(shape[i], i * 3);
    aSeed[i] = node.seed;
    aSize[i] = node.size;
    aColor.set([node.color.r, node.color.g, node.color.b], i * 3);
  });
  return { aCloud, aShape, aSeed, aSize, aColor };
}

// Link data for line segments (two vertices per link, each carrying its node's data).
export function linkAttributes({ cloud, shape, nodes, links }) {
  const count = links.length * 2;
  const aCloud = new Float32Array(count * 3);
  const aShape = new Float32Array(count * 3);
  const aSeed = new Float32Array(count);
  const aColor = new Float32Array(count * 3);
  const aSet = new Float32Array(count);
  links.forEach(([a, b, set], linkIndex) => {
    [a, b].forEach((nodeIndex, end) => {
      const v = linkIndex * 2 + end;
      aCloud.set(cloud[nodeIndex], v * 3);
      aShape.set(shape[nodeIndex], v * 3);
      aSeed[v] = nodes[nodeIndex].seed;
      const c = nodes[nodeIndex].color;
      aColor.set([c.r, c.g, c.b], v * 3);
      aSet[v] = set;
    });
  });
  return { aCloud, aShape, aSeed, aColor, aSet, count };
}
