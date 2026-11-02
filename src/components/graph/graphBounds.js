import { GRAPH, WHITE_GRAPH_CENTER } from './graphConstants';

// How far a region can be taken: as far as the graph reaches, no farther. Past the edge there are
// no nodes to color, so the region would be left behind at the edge while its star floated off.
// The graph is a ball squashed top to bottom (FLATTEN), so the limit is the same squashed shape.
export const GRAPH_LIMIT_RADIUS = GRAPH.OUTER_RADIUS - 0.8;

// Pulls `point` back inside the limit if it is outside. Returns true when it had to move it.
export function clampToGraph(point) {
  const [cx, cy, cz] = WHITE_GRAPH_CENTER;
  const dx = point.x - cx;
  const dy = (point.y - cy) / GRAPH.FLATTEN;
  const dz = point.z - cz;
  const size = Math.hypot(dx, dy, dz);
  if (size <= GRAPH_LIMIT_RADIUS) return false;
  const scale = GRAPH_LIMIT_RADIUS / size;
  point.set(cx + dx * scale, cy + dy * scale * GRAPH.FLATTEN, cz + dz * scale);
  return true;
}
