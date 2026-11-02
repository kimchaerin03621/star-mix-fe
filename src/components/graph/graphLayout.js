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

// Points kept in cubes of one size, so "what is near this point" looks at 27 cubes instead of
// every point. `near` calls back for every stored point in the cubes around a point (some of them
// may be a little farther than the cube size: the caller checks the real distance).
class SpaceGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  cellOf(point) {
    return [Math.floor(point[0] / this.cellSize), Math.floor(point[1] / this.cellSize), Math.floor(point[2] / this.cellSize)];
  }

  add(point, index) {
    const [x, y, z] = this.cellOf(point);
    const key = `${x},${y},${z}`;
    const entry = [point, index];
    if (this.cells.has(key)) this.cells.get(key).push(entry);
    else this.cells.set(key, [entry]);
  }

  near(point, visit) {
    const [x, y, z] = this.cellOf(point);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const entries = this.cells.get(`${x + dx},${y + dy},${z + dz}`);
          if (entries) for (let e = 0; e < entries.length; e += 1) visit(entries[e][0], entries[e][1]);
        }
      }
    }
  }
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
  const spacingSquared = GRAPH.MIN_SPACING ** 2;
  const grid = new Map();
  const cellOf = (p) => [Math.floor(p[0] / GRAPH.MIN_SPACING), Math.floor(p[1] / GRAPH.MIN_SPACING), Math.floor(p[2] / GRAPH.MIN_SPACING)];
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
    if (tooClose(point)) continue;
    // Keep nodes from piling up on one another, so the graph is even all through.
    const cell = cellOf(point);
    let crowded = false;
    for (let dx = -1; dx <= 1 && !crowded; dx += 1) {
      for (let dy = -1; dy <= 1 && !crowded; dy += 1) {
        for (let dz = -1; dz <= 1 && !crowded; dz += 1) {
          const others = grid.get(`${cell[0] + dx},${cell[1] + dy},${cell[2] + dz}`);
          crowded = others?.some((o) => (o[0] - point[0]) ** 2 + (o[1] - point[1]) ** 2 + (o[2] - point[2]) ** 2 < spacingSquared);
        }
      }
    }
    if (crowded) continue;
    positions.push(point);
    const key = cell.join(',');
    if (grid.has(key)) grid.get(key).push(point);
    else grid.set(key, [point]);
  }

  // Thin out only the crowded spots: a node is dropped when too many nodes already sit close
  // around it. Sparse parts of the graph are left exactly as they were.
  const crowdSquared = GRAPH.CROWD_RADIUS ** 2;
  const spread = [];
  const crowdGrid = new SpaceGrid(GRAPH.CROWD_RADIUS);
  positions.forEach((point) => {
    let neighbours = 0;
    crowdGrid.near(point, (other) => {
      const dx = point[0] - other[0];
      const dy = point[1] - other[1];
      const dz = point[2] - other[2];
      if (dx * dx + dy * dy + dz * dz < crowdSquared) neighbours += 1;
    });
    if (neighbours < GRAPH.CROWD_MAX) {
      spread.push(point);
      crowdGrid.add(point);
    }
  });
  positions.length = 0;
  positions.push(...spread);

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
  const linkGrid = new SpaceGrid(GRAPH.MAX_LINK_LENGTH);
  positions.forEach((point, index) => linkGrid.add(point, index));
  for (let i = 0; i < count; i += 1) {
    const near = [];
    linkGrid.near(positions[i], (other, j) => {
      if (j === i) return;
      const d = Math.hypot(positions[i][0] - other[0], positions[i][1] - other[1], positions[i][2] - other[2]);
      if (d < GRAPH.MAX_LINK_LENGTH) near.push([d, j]);
    });
    near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    near.slice(0, GRAPH.LINKS_PER_NODE).forEach(([, j]) => addLink(i, j));
    if (near[GRAPH.LINKS_PER_NODE] && near[GRAPH.LINKS_PER_NODE][0] < GRAPH.EXTRA_LINK_LENGTH) addLink(i, near[GRAPH.LINKS_PER_NODE][1]);
  }

  const adjacency = Array.from({ length: count }, () => []);
  links.forEach(([a, b]) => { adjacency[a].push(b); adjacency[b].push(a); });

  // Hubs (the best-connected nodes) are drawn big and bright; the rest stay small.
  const degrees = adjacency.map((list) => list.length).sort((a, b) => b - a);
  const hubDegree = degrees[Math.floor(count * GRAPH.HUB_SHARE)] ?? Infinity;
  const nodes = positions.map((position, i) => {
    const isHub = adjacency[i].length > hubDegree;
    return {
      position,
      seed: random(),
      isHub,
      size: isHub
        ? GRAPH.HUB_SIZE + random() * GRAPH.HUB_SIZE_RANDOM
        : GRAPH.NODE_SIZE + adjacency[i].length * GRAPH.NODE_SIZE_PER_LINK * 0.5 + random() * GRAPH.NODE_SIZE_RANDOM,
    };
  });

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
export function growRegions(graph, seeds, maxHops, minNodes = 0, hardMaxHops = maxHops) {
  const region = new Int8Array(graph.count).fill(-1);
  const hops = new Int8Array(graph.count).fill(-1);
  const frontiers = seeds.map(() => []);
  const sizes = new Array(seeds.length).fill(0);
  const reach = new Array(seeds.length).fill(0); // the last link count each region grew to
  seeds.forEach((seed, index) => {
    if (seed < 0 || region[seed] !== -1) return;
    region[seed] = index;
    hops[seed] = 0;
    sizes[index] = 1;
    frontiers[index].push(seed);
  });
  // A region keeps growing past maxHops (up to hardMaxHops) while it has fewer than minNodes
  // nodes, so one that starts in a sparse part of the graph is not much smaller than the rest.
  for (let hop = 1; hop <= hardMaxHops; hop += 1) {
    let grew = false;
    frontiers.forEach((frontier, owner) => {
      if (frontier.length === 0) return;
      if (hop > maxHops && sizes[owner] >= minNodes) {
        frontiers[owner] = [];
        return;
      }
      const next = [];
      frontier.forEach((node) => {
        graph.adjacency[node].forEach((other) => {
          if (region[other] !== -1) return;
          region[other] = owner;
          hops[other] = hop;
          sizes[owner] += 1;
          reach[owner] = hop;
          next.push(other);
        });
      });
      frontiers[owner] = next;
      if (next.length > 0) grew = true;
    });
    if (!grew) break;
  }
  return { region, hops, reach: reach.map((value) => Math.max(value, maxHops)) };
}
