import { GRAPH, WHITE_GRAPH_CENTER } from './graphConstants';

// Builds the huge white graph the listener stands inside: nodes scattered around the head,
// each joined to its few nearest neighbours by a thin link, in the manner of Obsidian's
// graph view, but in 3D. The same graph is built every time.

// Small deterministic random generator, so the space looks the same every visit.
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

export function buildGraph(seedText = 'white-graph') {
  const random = seededRandom(seedText);
  const [cx, cy, cz] = WHITE_GRAPH_CENTER;
  const { NODE_COUNT, INNER_RADIUS, OUTER_RADIUS, FLATTEN, CLUMP_COUNT, CLUMP_SHARE, CLUMP_SPREAD, KEEP_CLEAR } = GRAPH;

  // Clumps (dense groups, like the sections of an Obsidian graph) among evenly spread nodes.
  const randomPoint = () => {
    const direction = [gaussian(random), gaussian(random), gaussian(random)];
    const length = Math.hypot(...direction) || 1;
    const inner3 = INNER_RADIUS ** 3;
    const radius = (inner3 + random() * (OUTER_RADIUS ** 3 - inner3)) ** (1 / 3);
    return [
      cx + (direction[0] / length) * radius,
      cy + (direction[1] / length) * radius * FLATTEN,
      cz + (direction[2] / length) * radius,
    ];
  };
  const clumpCenters = Array.from({ length: CLUMP_COUNT }, randomPoint);
  const tooClose = (point) => KEEP_CLEAR.some(([x, y, z, radius]) => Math.hypot(point[0] - x, point[1] - y, point[2] - z) < radius);

  const positions = [];
  let guard = 0;
  while (positions.length < NODE_COUNT && guard < NODE_COUNT * 50) {
    guard += 1;
    let point;
    if (random() < CLUMP_SHARE) {
      const clump = clumpCenters[Math.floor(random() * CLUMP_COUNT)];
      point = [
        clump[0] + gaussian(random) * CLUMP_SPREAD,
        clump[1] + gaussian(random) * CLUMP_SPREAD * FLATTEN,
        clump[2] + gaussian(random) * CLUMP_SPREAD,
      ];
    } else {
      point = randomPoint();
    }
    if (!tooClose(point)) positions.push(point);
  }

  // Links: each node to its nearest neighbours (never very long), so the graph reads as
  // one connected web. Region borders follow these links.
  const count = positions.length;
  const links = [];
  const linked = new Set();
  const addLink = (a, b) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || linked.has(key)) return false;
    linked.add(key);
    links.push([a, b]);
    return true;
  };
  for (let i = 0; i < count; i += 1) {
    const near = [];
    for (let j = 0; j < count; j += 1) {
      if (j === i) continue;
      const d = Math.hypot(positions[i][0] - positions[j][0], positions[i][1] - positions[j][1], positions[i][2] - positions[j][2]);
      if (d < GRAPH.MAX_LINK_LENGTH) near.push([d, j]);
    }
    near.sort((a, b) => a[0] - b[0]);
    near.slice(0, GRAPH.LINKS_PER_NODE).forEach(([, j]) => addLink(i, j));
    if (near[GRAPH.LINKS_PER_NODE] && near[GRAPH.LINKS_PER_NODE][0] < GRAPH.EXTRA_LINK_LENGTH) addLink(i, near[GRAPH.LINKS_PER_NODE][1]);
  }

  const adjacency = Array.from({ length: count }, () => []);
  links.forEach(([a, b]) => { adjacency[a].push(b); adjacency[b].push(a); });

  // Hubs (nodes with many links) are drawn a little bigger.
  const nodes = positions.map((position, i) => ({
    position,
    seed: random(),
    size: GRAPH.NODE_SIZE + adjacency[i].length * GRAPH.NODE_SIZE_PER_LINK + random() * GRAPH.NODE_SIZE_RANDOM,
  }));

  return { count, nodes, links, adjacency };
}

// The node nearest a point, skipping any in `taken` (a Set of node indexes).
export function nearestNode(graph, point, taken) {
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < graph.count; i += 1) {
    if (taken && taken.has(i)) continue;
    const p = graph.nodes[i].position;
    const d = (p[0] - point.x) ** 2 + (p[1] - point.y) ** 2 + (p[2] - point.z) ** 2;
    if (d < bestDistance) { bestDistance = d; best = i; }
  }
  return { index: best, distance: Math.sqrt(bestDistance) };
}

// Each region grows from its seed node, link by link, up to `maxHops` links away. All regions
// grow at the same pace and a node goes to whichever reaches it first, so no node ever
// belongs to two regions. Returns, per node, its region number (-1 = none) and hop count.
export function growRegions(graph, seeds, maxHops) {
  const region = new Int8Array(graph.count).fill(-1);
  const hops = new Int8Array(graph.count).fill(-1);
  let frontier = [];
  seeds.forEach((seed, index) => {
    if (seed < 0 || region[seed] !== -1) return;
    region[seed] = index;
    hops[seed] = 0;
    frontier.push(seed);
  });
  for (let hop = 1; hop <= maxHops; hop += 1) {
    const next = [];
    frontier.forEach((node) => {
      graph.adjacency[node].forEach((other) => {
        if (region[other] !== -1) return;
        region[other] = region[node];
        hops[other] = hop;
        next.push(other);
      });
    });
    frontier = next;
  }
  return { region, hops };
}
